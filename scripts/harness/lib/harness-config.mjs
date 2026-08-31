/**
 * Loads and validates `harness/**` definitions.
 *
 * Root-level, not under `.claude/` or `.codex/`: the same contracts bind Codex, Claude
 * Code, and a human running the git hooks. A tool-specific home would imply otherwise.
 *
 * Everything here fails loudly at load time rather than degrading at run time:
 * an unknown `check.type`, an unknown param key, a missing required param, or a
 * malformed regex all abort the run. A harness that skips what it cannot understand
 * reports success on rules it never evaluated, which is worse than having no gate.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { CHECKS } from "./harness-checks.mjs";
import { parseHarnessYaml } from "./harness-yaml.mjs";

export const CONTRACTS_DIR = path.join("harness", "contracts");
export const SCENARIOS_DIR = path.join("harness", "scenarios");

export const MANUAL_STAGE = "manual";
export const EXECUTABLE_STAGES = ["pre-commit", "pre-push"];

const CONTRACT_KEYS = ["name", "summary", "inputs", "outputs", "invariants"];
const INVARIANT_KEYS = ["id", "statement", "rule", "check"];
const SCENARIO_KEYS = ["name", "summary", "stage", "match", "requires", "steps"];
const MATCH_KEYS = ["paths"];
const REQUIRE_KEYS = ["type", "host", "port", "command", "hint"];
const STEP_KEYS = ["name", "run", "cwd", "env"];
const SECTION_KEYS = ["headings", "must_contain"];
const REQUIRE_TYPES = ["tcp", "command"];

export class HarnessConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = "HarnessConfigError";
	}
}

function fail(source, message) {
	throw new HarnessConfigError(`${source}: ${message}`);
}

function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKnownKeys(source, where, value, allowed) {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key)) {
			fail(source, `${where} has an unknown key: ${key} (allowed: ${allowed.join(", ")})`);
		}
	}
}

function requireMap(source, where, value) {
	if (!isPlainObject(value)) {
		fail(source, `${where} must be a map.`);
	}

	return value;
}

function requireString(source, where, value) {
	if (typeof value !== "string" || value.trim() === "") {
		fail(source, `${where} must be a non-empty string.`);
	}

	return value;
}

function requireStringArray(source, where, value) {
	if (!Array.isArray(value) || value.length === 0) {
		fail(source, `${where} must be a list with at least one entry.`);
	}

	return value.map((item, index) => requireString(source, `${where}[${index}]`, item));
}

function requireRegExpArray(source, where, value) {
	return requireStringArray(source, where, value).map((pattern) => {
		try {
			new RegExp(pattern);
		} catch (error) {
			fail(source, `${where} has an invalid regular expression: ${pattern} (${error.message})`);
		}

		return pattern;
	});
}

function requireSectionArray(source, where, value) {
	if (!Array.isArray(value) || value.length === 0) {
		fail(source, `${where} must be a list with at least one entry.`);
	}

	return value.map((item, index) => {
		const at = `${where}[${index}]`;
		const section = requireMap(source, at, item);

		assertKnownKeys(source, at, section, SECTION_KEYS);
		requireStringArray(source, `${at}.headings`, section.headings);

		if (section.must_contain !== undefined && section.must_contain !== null) {
			requireString(source, `${at}.must_contain`, section.must_contain);
		}

		return section;
	});
}

/**
 * Param typing is by key suffix, so a new check type gets validation for free:
 * `*_paths` / `*_patterns` are regex lists, `*_sections` are heading groups,
 * `*_threshold` / `*_kb` / `*_count` are positive integers, anything else is a string.
 */
function validateCheckParams(source, where, check) {
	const definition = CHECKS.get(check.type);

	if (!definition) {
		fail(
			source,
			`unknown check.type: ${check.type} (implemented: ${[...CHECKS.keys()].join(", ")}). ` +
				"Do not declare an invariant that nothing verifies — use type: manual if it cannot be checked.",
		);
	}

	const allowed = ["type", ...definition.requiredParams, ...definition.optionalParams];

	assertKnownKeys(source, where, check, allowed);

	for (const key of definition.requiredParams) {
		if (check[key] === undefined || check[key] === null) {
			fail(source, `${where}.${key} is required.`);
		}
	}

	const params = {};

	for (const [key, value] of Object.entries(check)) {
		if (key === "type") {
			continue;
		}

		if (key.endsWith("_paths") || key.endsWith("_patterns")) {
			params[key] = requireRegExpArray(source, `${where}.${key}`, value);
			continue;
		}
		if (key.endsWith("_sections")) {
			params[key] = requireSectionArray(source, `${where}.${key}`, value);
			continue;
		}
		if (key.endsWith("_threshold") || key.endsWith("_kb") || key.endsWith("_count")) {
			if (!Number.isInteger(value) || value < 1) {
				fail(source, `${where}.${key} must be an integer >= 1.`);
			}
			params[key] = value;
			continue;
		}

		params[key] = requireString(source, `${where}.${key}`, value);
	}

	return { type: check.type, definition, params };
}

function validateContract(source, document) {
	const contract = requireMap(source, "contract", document);

	assertKnownKeys(source, "contract", contract, CONTRACT_KEYS);
	requireString(source, "contract.name", contract.name);

	if (!Array.isArray(contract.invariants) || contract.invariants.length === 0) {
		fail(source, "contract.invariants must be a list with at least one entry.");
	}

	const seen = new Set();
	const invariants = contract.invariants.map((item, index) => {
		const where = `contract.invariants[${index}]`;
		const invariant = requireMap(source, where, item);

		assertKnownKeys(source, where, invariant, INVARIANT_KEYS);
		requireString(source, `${where}.id`, invariant.id);
		requireString(source, `${where}.statement`, invariant.statement);

		if (seen.has(invariant.id)) {
			fail(source, `duplicate invariant id: ${invariant.id}`);
		}
		seen.add(invariant.id);

		const check = requireMap(source, `${where}.check`, invariant.check);

		requireString(source, `${where}.check.type`, check.type);

		return {
			id: invariant.id,
			statement: invariant.statement,
			rule: invariant.rule ?? undefined,
			check: validateCheckParams(source, `${where}.check`, check),
		};
	});

	return { source, name: contract.name, summary: contract.summary ?? undefined, invariants };
}

function validateScenario(source, document) {
	const scenario = requireMap(source, "scenario", document);

	assertKnownKeys(source, "scenario", scenario, SCENARIO_KEYS);
	requireString(source, "scenario.name", scenario.name);

	const stage = requireString(source, "scenario.stage", scenario.stage);

	if (stage !== MANUAL_STAGE && !EXECUTABLE_STAGES.includes(stage)) {
		fail(source, `unknown stage: ${stage} (allowed: ${[MANUAL_STAGE, ...EXECUTABLE_STAGES].join(", ")})`);
	}

	if (stage === MANUAL_STAGE) {
		if (scenario.match || scenario.requires) {
			fail(source, "stage: manual cannot declare match / requires — nothing executes it.");
		}

		return {
			source,
			name: scenario.name,
			summary: scenario.summary ?? undefined,
			stage,
			steps: requireStringArray(source, "scenario.steps", scenario.steps),
			paths: [],
			requires: [],
		};
	}

	const match = requireMap(source, "scenario.match", scenario.match);

	assertKnownKeys(source, "scenario.match", match, MATCH_KEYS);

	const paths = requireRegExpArray(source, "scenario.match.paths", match.paths);
	const requires = (scenario.requires ?? []).map((item, index) => {
		const where = `scenario.requires[${index}]`;
		const requirement = requireMap(source, where, item);

		assertKnownKeys(source, where, requirement, REQUIRE_KEYS);

		if (!REQUIRE_TYPES.includes(requirement.type)) {
			fail(source, `${where}.type must be one of ${REQUIRE_TYPES.join(", ")}: ${requirement.type}`);
		}

		if (requirement.type === "tcp") {
			requireString(source, `${where}.host`, requirement.host);

			if (!Number.isInteger(requirement.port)) {
				fail(source, `${where}.port must be an integer.`);
			}
		} else {
			requireString(source, `${where}.command`, requirement.command);
		}

		return {
			type: requirement.type,
			host: requirement.host ?? undefined,
			port: requirement.port ?? undefined,
			command: requirement.command ?? undefined,
			hint: requirement.hint ?? undefined,
		};
	});

	if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
		fail(source, "scenario.steps must be a list with at least one entry.");
	}

	const steps = scenario.steps.map((item, index) => {
		const where = `scenario.steps[${index}]`;
		const step = requireMap(source, where, item);

		assertKnownKeys(source, where, step, STEP_KEYS);
		requireString(source, `${where}.run`, step.run);

		const env = {};

		for (const [key, value] of Object.entries(step.env ?? {})) {
			env[key] = requireString(source, `${where}.env.${key}`, value);
		}

		return {
			name: step.name ?? step.run,
			run: step.run,
			cwd: step.cwd ?? undefined,
			env,
		};
	});

	return { source, name: scenario.name, summary: scenario.summary ?? undefined, stage, paths, requires, steps };
}

async function loadYamlFiles(dir) {
	let entries;

	try {
		entries = await readdir(dir);
	} catch {
		throw new HarnessConfigError(`cannot read ${dir}. Harness definitions are missing.`);
	}

	const files = entries.filter((entry) => entry.endsWith(".yaml") || entry.endsWith(".yml")).sort();
	const documents = [];

	for (const file of files) {
		const source = path.join(dir, file);
		const text = await readFile(source, "utf8");

		documents.push({ source, document: parseHarnessYaml(text, source) });
	}

	return documents;
}

export async function loadContracts(dir = CONTRACTS_DIR) {
	const documents = await loadYamlFiles(dir);

	if (documents.length === 0) {
		throw new HarnessConfigError(`no contract found in ${dir}.`);
	}

	return documents.map(({ source, document }) => validateContract(source, document));
}

export async function loadScenarios(dir = SCENARIOS_DIR) {
	const documents = await loadYamlFiles(dir);

	return documents.map(({ source, document }) => validateScenario(source, document));
}
