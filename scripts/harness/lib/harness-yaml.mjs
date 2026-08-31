/**
 * YAML subset parser for `.claude/harness/**` contract and scenario files.
 *
 * The harness must run in repos with no dependency manifest at all (a static site, a
 * Flutter app), so it uses node builtins only. This parser therefore supports exactly what the harness schema
 * needs: block maps, block sequences, and scalars (plain / single-quoted / double-quoted).
 *
 * Flow syntax (`[a, b]`, `{a: b}`), block scalars (`|`, `>`), anchors, and multi-document
 * files are NOT silently ignored — they throw. A harness whose definitions can be
 * misread is worse than no harness.
 */

const KEY_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const UNSUPPORTED_SCALAR_PREFIX = /^[|>[{&*!]/;

export class HarnessYamlError extends Error {
	constructor(message) {
		super(message);
		this.name = "HarnessYamlError";
	}
}

function tokenize(text, source) {
	const lines = [];

	text.split(/\r?\n/).forEach((rawLine, index) => {
		const lineNumber = index + 1;
		const line = rawLine.replace(/\s+$/, "");

		if (line === "") {
			return;
		}
		if (/^\s*#/.test(line)) {
			return;
		}
		if (/^\s*-{3,}\s*$/.test(line)) {
			throw new HarnessYamlError(`${source}:${lineNumber}: document separators (---) are not supported.`);
		}
		if (/^\s*\t/.test(line)) {
			throw new HarnessYamlError(`${source}:${lineNumber}: tabs cannot be used for indentation. Use spaces.`);
		}

		const indent = line.length - line.trimStart().length;
		lines.push({ indent, content: line.trimStart(), lineNumber });
	});

	return lines;
}

function isSequenceEntry(content) {
	return content === "-" || content.startsWith("- ");
}

/**
 * Only treat `foo: bar` as a map entry when the key looks like an identifier.
 * Without this, Japanese prose in a `manual` note ("理由: ..." / "対応: ...") would be
 * parsed as a map key and the note would be silently mangled.
 */
function splitMapEntry(content) {
	const match = /^([^:]*):(?:[ \t]+(.*))?$/.exec(content);

	if (!match) {
		return undefined;
	}

	const key = match[1].trim();

	if (!KEY_PATTERN.test(key)) {
		return undefined;
	}

	return { key, inline: match[2] };
}

function stripInlineComment(raw) {
	const match = /\s+#/.exec(raw);

	if (!match) {
		return raw;
	}

	return raw.slice(0, match.index).replace(/\s+$/, "");
}

function parseDoubleQuoted(raw, source, lineNumber) {
	let result = "";

	for (let index = 1; index < raw.length - 1; index += 1) {
		const char = raw[index];

		if (char !== "\\") {
			result += char;
			continue;
		}

		index += 1;
		const escaped = raw[index];

		if (escaped === "n") {
			result += "\n";
		} else if (escaped === "t") {
			result += "\t";
		} else if (escaped === '"' || escaped === "\\") {
			result += escaped;
		} else {
			throw new HarnessYamlError(`${source}:${lineNumber}: unsupported escape: \\${escaped}`);
		}
	}

	return result;
}

function parseScalar(rawValue, source, lineNumber) {
	const raw = rawValue.trim();

	if (raw.startsWith('"')) {
		if (!raw.endsWith('"') || raw.length < 2) {
			throw new HarnessYamlError(`${source}:${lineNumber}: unterminated double quote.`);
		}
		return parseDoubleQuoted(raw, source, lineNumber);
	}

	if (raw.startsWith("'")) {
		if (!raw.endsWith("'") || raw.length < 2) {
			throw new HarnessYamlError(`${source}:${lineNumber}: unterminated single quote.`);
		}
		return raw.slice(1, -1).replaceAll("''", "'");
	}

	if (UNSUPPORTED_SCALAR_PREFIX.test(raw)) {
		throw new HarnessYamlError(
			`${source}:${lineNumber}: unsupported YAML syntax: ${raw[0]} (flow style and block scalars are not supported)`,
		);
	}

	const value = stripInlineComment(raw);

	if (value === "" || value === "null" || value === "~") {
		return null;
	}
	if (value === "true") {
		return true;
	}
	if (value === "false") {
		return false;
	}
	if (/^-?\d+$/.test(value)) {
		return Number.parseInt(value, 10);
	}
	if (/^-?\d+\.\d+$/.test(value)) {
		return Number.parseFloat(value);
	}

	return value;
}

class Parser {
	constructor(lines, source) {
		this.lines = lines;
		this.source = source;
		this.index = 0;
	}

	peek() {
		return this.lines[this.index];
	}

	fail(line, message) {
		throw new HarnessYamlError(`${this.source}:${line.lineNumber}: ${message}`);
	}

	parseBlock(indent) {
		const line = this.peek();

		if (!line) {
			return null;
		}

		return isSequenceEntry(line.content) ? this.parseSequence(indent) : this.parseMap(indent);
	}

	parseMap(indent) {
		const result = {};

		while (this.index < this.lines.length) {
			const line = this.peek();

			if (line.indent < indent) {
				break;
			}
			if (line.indent > indent) {
				this.fail(line, "indentation is too deep.");
			}
			if (isSequenceEntry(line.content)) {
				this.fail(line, "a list item appeared in the middle of a map.");
			}

			const entry = splitMapEntry(line.content);

			if (!entry) {
				this.fail(line, `cannot read as a map "key: value": ${line.content}`);
			}
			if (entry.key in result) {
				this.fail(line, `duplicate key: ${entry.key}`);
			}

			this.index += 1;

			if (entry.inline !== undefined && entry.inline.trim() !== "") {
				result[entry.key] = parseScalar(entry.inline, this.source, line.lineNumber);
				continue;
			}

			const next = this.peek();

			result[entry.key] = next && next.indent > indent ? this.parseBlock(next.indent) : null;
		}

		return result;
	}

	parseSequence(indent) {
		const result = [];

		while (this.index < this.lines.length) {
			const line = this.peek();

			if (line.indent < indent) {
				break;
			}
			if (line.indent > indent) {
				this.fail(line, "indentation is too deep.");
			}
			if (!isSequenceEntry(line.content)) {
				this.fail(line, "a map key appeared in the middle of a list.");
			}

			const rest = line.content.slice(1).trimStart();

			if (rest === "") {
				this.index += 1;
				const next = this.peek();
				result.push(next && next.indent > indent ? this.parseBlock(next.indent) : null);
				continue;
			}

			if (isSequenceEntry(rest)) {
				this.fail(line, "a nested list cannot start on the same line.");
			}

			const nestedIndent = indent + (line.content.length - rest.length);

			if (splitMapEntry(rest)) {
				this.lines[this.index] = { indent: nestedIndent, content: rest, lineNumber: line.lineNumber };
				result.push(this.parseMap(nestedIndent));
				continue;
			}

			result.push(parseScalar(rest, this.source, line.lineNumber));
			this.index += 1;
		}

		return result;
	}
}

export function parseHarnessYaml(text, source = "<yaml>") {
	const lines = tokenize(text, source);

	if (lines.length === 0) {
		return null;
	}
	if (lines[0].indent !== 0) {
		throw new HarnessYamlError(`${source}:${lines[0].lineNumber}: the first line is indented.`);
	}

	const parser = new Parser(lines, source);
	const value = parser.parseBlock(0);
	const rest = parser.peek();

	if (rest) {
		throw new HarnessYamlError(`${source}:${rest.lineNumber}: unparsed trailing line: ${rest.content}`);
	}

	return value;
}
