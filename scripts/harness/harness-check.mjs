/**
 * Verify the invariants in `harness/contracts/*.yaml` against a diff.
 *
 * The decision logic lives in the contracts, not in this file. This script only
 * collects the diff, runs each invariant's registered check, and turns failures into
 * a non-zero exit. Adding a rule should mean editing YAML, not editing JavaScript.
 */

import { CHECK_STATUS } from "./lib/harness-checks.mjs";
import { HarnessConfigError, loadContracts } from "./lib/harness-config.mjs";
import { changedFiles, PROJECT_ROOT, readFileAtDiff, resolvePushBase, resolveScope, trackedFiles } from "./lib/harness-git.mjs";
import { HarnessYamlError } from "./lib/harness-yaml.mjs";

/**
 * Everything downstream resolves paths against cwd: `harness/contracts` in the config
 * loader, and the size check's stat() on a project-relative path. A git hook runs at the
 * repo root, which is not this directory when the harness lives in a subdirectory — so
 * anchor once, here, rather than threading a root through every call site.
 */
process.chdir(PROJECT_ROOT);

/** A diff bigger than this in base mode almost certainly means the base ref is stale. */
const STALE_BASE_FILE_COUNT = 500;

const STATUS_LABEL = {
	[CHECK_STATUS.pass]: "pass",
	[CHECK_STATUS.fail]: "FAIL",
	[CHECK_STATUS.skip]: "skip",
	[CHECK_STATUS.manual]: "manual",
};

function printUsage() {
	console.error(`usage:
  node scripts/harness/harness-check.mjs               # uncommitted changes + untracked
  node scripts/harness/harness-check.mjs --staged      # the git index (pre-commit)
  node scripts/harness/harness-check.mjs --base <ref>  # <ref>...HEAD
  node scripts/harness/harness-check.mjs --upstream    # @{upstream}...HEAD, or worktree if unset
  node scripts/harness/harness-check.mjs --all         # every tracked file (baseline scan)
  node scripts/harness/harness-check.mjs --contracts <dir>

notes:
  - Invariants live in harness/contracts/*.yaml, not in this script.
  - An invariant that cannot be machine-verified reports "manual", never "pass".
  - HARNESS_BASE=<ref> overrides the ref used by --upstream.
  - --all answers "what does this repo look like today?", not "is this change ok?".
    Use it once when adopting the harness, to record the baseline. The gates stay
    diff-scoped, so existing debt never blocks a commit that did not cause it.
`);
}

function parseArgs(argv) {
	const args = [...argv];
	const options = { mode: "worktree", base: undefined, contractsDir: undefined, useUpstream: false, all: false };

	while (args.length > 0) {
		const arg = args.shift();

		if (arg === "--") {
			continue;
		}
		if (arg === "--staged") {
			options.mode = "staged";
			continue;
		}
		if (arg === "--base") {
			options.mode = "base";
			options.base = args.shift();
			continue;
		}
		if (arg === "--upstream") {
			options.useUpstream = true;
			continue;
		}
		if (arg === "--all") {
			options.all = true;
			continue;
		}
		if (arg === "--contracts") {
			options.contractsDir = args.shift();
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		}

		console.error(`unknown argument: ${arg}`);
		printUsage();
		process.exit(1);
	}

	if (options.mode === "base" && !options.base) {
		console.error("--base requires a git ref.");
		process.exit(1);
	}

	return options;
}

function printResult(invariant, result) {
	const label = STATUS_LABEL[result.status] ?? result.status;
	const write = result.status === CHECK_STATUS.fail ? console.error : console.log;

	write(`  [${label}] ${invariant.id}: ${result.message}`);

	if (result.status === CHECK_STATUS.fail) {
		console.error(`         invariant: ${invariant.statement}`);

		if (invariant.rule) {
			console.error(`         rule: ${invariant.rule}`);
		}
	}

	for (const detail of result.details ?? []) {
		for (const line of String(detail).split("\n")) {
			write(line === "" ? "" : `    ${line}`);
		}
	}
}

async function resolveDiffOptions(options) {
	if (!options.useUpstream || options.mode !== "worktree") {
		return { mode: options.mode, base: options.base };
	}

	const base = await resolvePushBase();

	return base ? { mode: "base", base } : { mode: "worktree" };
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const contracts = await loadContracts(options.contractsDir);
	const diffOptions = options.all ? { mode: "worktree" } : await resolveDiffOptions(options);
	const files = options.all ? await trackedFiles(".") : await changedFiles(diffOptions);

	const diffLabel = options.all ? "ALL tracked files" : diffOptions.mode === "base" ? `base ${diffOptions.base}` : diffOptions.mode;
	const scope = await resolveScope();

	// State the subtree out loud when the harness is not at the repo root. "0 files" has
	// two very different meanings — nothing changed, or the harness is looking in the
	// wrong place — and printing the scope keeps them distinguishable.
	if (scope.prefix) {
		console.log(`harness-check: scope=${scope.prefix}/ within ${scope.repoRoot}`);
	}

	console.log(`harness-check: diff=${diffLabel} files=${files.length}`);

	if (diffOptions.mode === "base" && files.length > STALE_BASE_FILE_COUNT) {
		console.log(
			`harness-check: note — ${files.length} changed files against ${diffOptions.base}. ` +
				"If that ref is stale, the result is about the whole backlog rather than your change. " +
				"Set HARNESS_BASE to a closer ref.",
		);
	}

	if (files.length === 0) {
		console.log("harness-check: empty diff.");
	}

	const context = {
		files,
		mode: diffOptions.mode,
		readFileAtDiff: (filePath) => readFileAtDiff(filePath, diffOptions),
	};

	let failed = 0;
	let manual = 0;

	for (const contract of contracts) {
		console.log(`harness-check: ${contract.name} (${contract.source})`);

		for (const invariant of contract.invariants) {
			const result = await invariant.check.definition.run(invariant.check.params, context);

			if (result.status === CHECK_STATUS.fail) {
				failed += 1;
			}
			if (result.status === CHECK_STATUS.manual) {
				manual += 1;
			}

			printResult(invariant, result);
		}
	}

	if (failed > 0) {
		console.error(`harness-check: ${failed} invariant(s) failed.`);
		process.exit(1);
	}

	console.log(`harness-check: all machine-verified invariants passed. ${manual} still need a human.`);
}

main().catch((error) => {
	if (error instanceof HarnessConfigError || error instanceof HarnessYamlError) {
		console.error(`harness-check: harness definitions are invalid.\n${error.message}`);
		process.exit(1);
	}

	console.error(error);
	process.exit(1);
});
