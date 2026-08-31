/**
 * Read-only permission audit, driven by what this project actually ran.
 *
 * Reads the Claude Code session transcripts for the current repo, replays every Bash
 * command against the merged allow/deny rules, and reports which ones would have
 * prompted — then ranks the rules that would remove the most prompts.
 *
 * It never writes a settings file. Deciding what to grant is a judgement about blast
 * radius, and it belongs to a human looking at the classification, not to a script
 * optimising a number.
 *
 *   node scripts/harness/permission-audit.mjs
 *   node scripts/harness/permission-audit.mjs --days 7
 *   node scripts/harness/permission-audit.mjs --session <id|latest>
 *   node scripts/harness/permission-audit.mjs --simulate "sort *,find *,flutter test *"
 *   node scripts/harness/permission-audit.mjs --list-uncovered
 */

import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/* -------------------------------------------------------------------------- */
/* classification — fail safe: anything unrecognised is REVIEW, never SAFE      */
/* -------------------------------------------------------------------------- */

/** Non-mutating: cannot change the tree, the remote, a database, or a deployment. */
const SAFE = new Set([
	"ls", "cat", "head", "tail", "wc", "grep", "rg", "echo", "printf", "pwd", "stat",
	"file", "which", "date", "basename", "dirname", "cut", "uniq", "diff", "jq", "cd",
	"true", "false", "column", "nl", "comm", "cmp", "realpath", "du", "df", "env",
]);

/** Has a real mutation path, or reaches outside this machine. Never auto-grant. */
const UNSAFE = new Set([
	"rm", "rmdir", "mv", "cp", "dd", "sudo", "chmod", "chown", "chgrp", "ln", "kill",
	"killall", "xargs", "eval", "exec", "curl", "wget", "ssh", "scp", "rsync", "nc",
	"npm", "npx", "yarn", "pnpm", "pip", "pip3", "brew", "gcloud", "aws", "vercel",
	"supabase", "psql", "fastlane", "pod", "gem", "docker", "open", "defaults", "launchctl",
]);

/** Safety depends on the subcommand or flags — report, never assume. */
const REVIEW = new Set([
	"git", "flutter", "dart", "node", "python", "python3", "sh", "bash", "zsh", "make",
	"sed", "find", "sort", "awk", "perl", "ruby", "tee", "tr", "touch", "mkdir", "gh",
]);

function classify(token) {
	if (UNSAFE.has(token)) return "UNSAFE";
	if (SAFE.has(token)) return "SAFE";
	if (REVIEW.has(token)) return "REVIEW";
	return "REVIEW";
}

/* -------------------------------------------------------------------------- */
/* shell parsing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Split a command into the segments Claude Code evaluates separately.
 *
 * Quote- and paren-aware on purpose: a naive split on `|` tears
 * `grep -E "material|widgets"` into fragments and invents commands that were never
 * run, which inflates the "uncovered" count with noise.
 */
export function splitSegments(command) {
	const segments = [];
	let current = "";
	let quote = null;
	let depth = 0;

	for (let i = 0; i < command.length; i += 1) {
		const ch = command[i];

		if (quote) {
			current += ch;
			if (ch === quote && command[i - 1] !== "\\") quote = null;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "(" || ch === "{") depth += 1;
		if (ch === ")" || ch === "}") depth = Math.max(0, depth - 1);

		if (depth === 0) {
			const two = command.slice(i, i + 2);
			if (two === "&&" || two === "||") {
				segments.push(current);
				current = "";
				i += 1;
				continue;
			}
			if (ch === "|" || ch === ";" || ch === "\n") {
				segments.push(current);
				current = "";
				continue;
			}
		}

		current += ch;
	}

	segments.push(current);

	return segments.map((s) => s.trim()).filter(Boolean);
}

/** The command word of a segment, skipping leading VAR=value assignments. */
export function leadingToken(segment) {
	const words = segment.split(/\s+/).filter(Boolean);

	for (const word of words) {
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) continue;
		return word.replace(/^\$?\(+/, "");
	}

	return words[0] ?? "";
}

/** A rule that is a shell construct rather than a command — no prefix rule can cover it. */
const SHELL_CONSTRUCT = /^(for|while|until|do|done|if|then|else|elif|fi|case|esac|function|\{|\}|\()/;

function toRegExp(pattern) {
	return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*")}$`, "s");
}

/* -------------------------------------------------------------------------- */
/* settings + transcripts                                                      */
/* -------------------------------------------------------------------------- */

async function readJson(file) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return undefined;
	}
}

async function loadRules() {
	const files = [
		path.join(os.homedir(), ".claude", "settings.json"),
		path.join(".claude", "settings.json"),
		path.join(".claude", "settings.local.json"),
	];
	const allow = [];
	const deny = [];

	for (const file of files) {
		const settings = await readJson(file);
		const permissions = settings?.permissions;

		if (!permissions) continue;

		for (const rule of permissions.allow ?? []) if (rule.startsWith("Bash(")) allow.push(rule.slice(5, -1));
		for (const rule of permissions.deny ?? []) if (rule.startsWith("Bash(")) deny.push(rule.slice(5, -1));
	}

	return { allow, deny, files };
}

function sanitizeCwd(cwd) {
	return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

async function transcriptFiles(options) {
	const dir = path.join(os.homedir(), ".claude", "projects", sanitizeCwd(process.cwd()));
	let entries;

	try {
		entries = (await readdir(dir)).filter((e) => e.endsWith(".jsonl"));
	} catch {
		throw new Error(`no transcripts found at ${dir}`);
	}

	const withTime = [];

	for (const entry of entries) {
		const full = path.join(dir, entry);
		const info = await stat(full);

		withTime.push({ file: full, id: entry.replace(/\.jsonl$/, ""), mtime: info.mtimeMs });
	}

	withTime.sort((a, b) => b.mtime - a.mtime);

	if (options.session === "latest") return withTime.slice(0, 1);
	if (options.session) return withTime.filter((t) => t.id.startsWith(options.session));
	if (options.days) {
		const cutoff = Date.now() - options.days * 86400000;
		return withTime.filter((t) => t.mtime >= cutoff);
	}

	return withTime.slice(0, 1);
}

async function collectCalls(files) {
	const commands = [];
	const toolCounts = new Map();

	for (const { file } of files) {
		const text = await readFile(file, "utf8");

		for (const line of text.split("\n")) {
			if (!line.trim()) continue;

			let record;

			try {
				record = JSON.parse(line);
			} catch {
				continue;
			}

			const content = record?.message?.content;

			if (!Array.isArray(content)) continue;

			for (const block of content) {
				if (block?.type !== "tool_use") continue;

				toolCounts.set(block.name, (toolCounts.get(block.name) ?? 0) + 1);

				if (block.name === "Bash" && block.input?.command) commands.push(block.input.command);
			}
		}
	}

	return { commands, toolCounts };
}

/* -------------------------------------------------------------------------- */
/* evaluation                                                                  */
/* -------------------------------------------------------------------------- */

function makeMatcher(allow, deny) {
	const allowRx = allow.map(toRegExp);
	const denyRx = deny.map(toRegExp);

	return {
		segmentAllowed: (segment) => allowRx.some((rx) => rx.test(segment)),
		segmentDenied: (segment) => denyRx.some((rx) => rx.test(segment)),
	};
}

function evaluate(commands, allow, deny) {
	const { segmentAllowed, segmentDenied } = makeMatcher(allow, deny);
	let covered = 0;
	let denied = 0;
	const uncovered = [];

	for (const command of commands) {
		const segments = splitSegments(command);

		if (segments.some(segmentDenied)) {
			denied += 1;
			continue;
		}
		if (segments.every(segmentAllowed)) {
			covered += 1;
			continue;
		}

		uncovered.push({ command, segments: segments.filter((s) => !segmentAllowed(s)) });
	}

	return { covered, denied, uncovered };
}

/** Greedy: repeatedly add the candidate rule that unblocks the most commands. */
function rankCandidates(commands, allow, deny) {
	const seen = new Map();

	for (const { segments } of evaluate(commands, allow, deny).uncovered) {
		for (const segment of segments) {
			const token = leadingToken(segment);

			if (!token || SHELL_CONSTRUCT.test(token)) continue;

			// Subcommand-aware for tools whose safety depends on it.
			const words = segment.split(/\s+/).filter(Boolean);
			const candidate = REVIEW.has(token) && words.length > 1 && /^[a-z][\w-]*$/.test(words[1])
				? `${token} ${words[1]} *`
				: `${token} *`;

			seen.set(candidate, (seen.get(candidate) ?? 0) + 1);
		}
	}

	const ranked = [];
	let current = [...allow];
	let baseline = evaluate(commands, current, deny).covered;
	const pool = new Set(seen.keys());

	while (pool.size > 0) {
		let best = null;

		for (const candidate of pool) {
			const gain = evaluate(commands, [...current, candidate], deny).covered - baseline;

			if (gain > 0 && (!best || gain > best.gain)) best = { candidate, gain };
		}

		if (!best) break;

		ranked.push({ ...best, verdict: classify(leadingToken(best.candidate)) });
		current = [...current, best.candidate];
		baseline += best.gain;
		pool.delete(best.candidate);
	}

	return { ranked, unreachable: [...pool].map((c) => ({ candidate: c, occurrences: seen.get(c) })) };
}

/* -------------------------------------------------------------------------- */
/* cli                                                                         */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
	const options = { days: 0, session: undefined, simulate: [], listUncovered: false };
	const args = [...argv];

	while (args.length > 0) {
		const arg = args.shift();

		if (arg === "--days") options.days = Number.parseInt(args.shift(), 10);
		else if (arg === "--session") options.session = args.shift();
		else if (arg === "--simulate") options.simulate = (args.shift() ?? "").split(",").map((s) => s.trim()).filter(Boolean);
		else if (arg === "--list-uncovered") options.listUncovered = true;
		else if (arg === "--help" || arg === "-h") {
			console.log(`usage: node scripts/harness/permission-audit.mjs [options]

  --days <n>          scan sessions modified in the last n days (default: newest session)
  --session <id>      scan one session, or "latest"
  --simulate "a,b"    measure what adding these Bash rules would do
  --list-uncovered    print the uncovered command segments

Reports only. It never edits a settings file.`);
			process.exit(0);
		} else {
			console.error(`unknown argument: ${arg}`);
			process.exit(1);
		}
	}

	return options;
}

function pct(n, total) {
	return total === 0 ? 0 : Math.round((n / total) * 100);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const { allow, deny, files: settingsFiles } = await loadRules();
	const files = await transcriptFiles(options);

	if (files.length === 0) {
		console.log("permission-audit: no matching transcripts.");
		return;
	}

	const { commands, toolCounts } = await collectCalls(files);

	console.log(`permission-audit: ${files.length} session(s), ${commands.length} Bash call(s)`);
	console.log(`  rules: ${allow.length} allow, ${deny.length} deny (from ${settingsFiles.length} settings files)`);

	const otherTools = [...toolCounts.entries()].filter(([name]) => name !== "Bash").sort((a, b) => b[1] - a[1]);

	if (otherTools.length > 0) {
		console.log(`  other tool calls: ${otherTools.map(([n, c]) => `${n}=${c}`).join(" ")}`);
	}

	if (commands.length === 0) return;

	const result = evaluate(commands, allow, deny);
	const prompts = result.uncovered.length;

	console.log("");
	console.log("COVERAGE");
	console.log(`  auto-allowed : ${result.covered} (${pct(result.covered, commands.length)}%)`);
	console.log(`  blocked      : ${result.denied}`);
	console.log(`  prompted     : ${prompts} (${pct(prompts, commands.length)}%)`);

	const compound = result.uncovered.filter((u) => splitSegments(u.command).length > 1).length;

	console.log("");
	console.log("WHY THEY PROMPTED");
	console.log(`  compound commands (&& | ;) : ${compound} of ${prompts}`);
	console.log("  Every segment must be allowed, so one un-allowed piece prompts the whole command.");

	const constructs = result.uncovered.filter((u) => u.segments.some((s) => SHELL_CONSTRUCT.test(leadingToken(s)))).length;

	console.log(`  shell constructs (for/while/if/subshell) : ${constructs} — no prefix rule can ever cover these.`);

	if (options.simulate.length > 0) {
		const after = evaluate(commands, [...allow, ...options.simulate], deny);

		console.log("");
		console.log("SIMULATION");
		console.log(`  rules added   : ${options.simulate.join(", ")}`);
		console.log(`  coverage      : ${result.covered} -> ${after.covered} (${pct(after.covered, commands.length)}%)`);
		console.log(`  prompts saved : ${after.covered - result.covered}`);

		for (const rule of options.simulate) {
			const verdict = classify(leadingToken(rule));

			if (verdict !== "SAFE") console.log(`  ${verdict}: "${rule}" — classify this before granting it.`);
		}
	}

	const { ranked, unreachable } = rankCandidates(commands, allow, deny);

	if (ranked.length > 0) {
		console.log("");
		console.log("CANDIDATE RULES (greedy — each gain assumes the ones above it are added)");
		console.log("  gain  verdict  rule");

		for (const { candidate, gain, verdict } of ranked) {
			console.log(`  ${String(gain).padStart(4)}  ${verdict.padEnd(7)}  Bash(${candidate})`);
		}

		console.log("");
		console.log("  SAFE   = non-mutating; may go in the committed .claude/settings.json");
		console.log("  REVIEW = depends on subcommand/flags; narrow it, or pair it with a deny rule");
		console.log("  UNSAFE = mutating or outward-facing; leave it prompting");
	}

	if (unreachable.length > 0) {
		console.log("");
		console.log(`UNREACHABLE BY A RULE: ${unreachable.length} candidate(s) appear only inside commands that`);
		console.log("  stay uncovered for another reason (a loop, a heredoc, or an UNSAFE sibling segment).");
	}

	if (options.listUncovered) {
		console.log("");
		console.log("UNCOVERED SEGMENTS");
		for (const { segments } of result.uncovered) {
			for (const segment of segments) console.log(`  ${segment.slice(0, 140)}`);
		}
	}

	console.log("");
	console.log("This tool reports. Grants are a human decision: read-only -> committed");
	console.log(".claude/settings.json, mutating -> gitignored .claude/settings.local.json.");
}

main().catch((error) => {
	console.error(`permission-audit: ${error.message}`);
	process.exit(1);
});
