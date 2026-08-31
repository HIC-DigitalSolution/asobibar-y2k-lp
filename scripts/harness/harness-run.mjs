/**
 * Run the `harness/scenarios/*.yaml` whose stage and changed paths match.
 *
 * Which paths matter and which commands run belong to the scenario, not to the hook.
 * The hook only knows which stage to ask for, so adding an acceptance check for a new
 * area of the app means adding a YAML file — never editing `.githooks/`.
 */

import { spawn } from "node:child_process";
import net from "node:net";

import {
	EXECUTABLE_STAGES,
	HarnessConfigError,
	MANUAL_STAGE,
	loadScenarios,
	SCENARIOS_DIR,
} from "./lib/harness-config.mjs";
import { changedFiles, PROJECT_ROOT, resolvePushBase } from "./lib/harness-git.mjs";
import { HarnessYamlError } from "./lib/harness-yaml.mjs";

/**
 * Anchor to the project before anything resolves a relative path: `harness/scenarios` in
 * the loader, and every step's `run:`/`cwd:`. A git hook runs at the repo root, so
 * without this a scenario step would execute in the wrong directory entirely.
 */
process.chdir(PROJECT_ROOT);

const REQUIRE_TIMEOUT_MS = 2000;

function printUsage() {
	console.error(`usage:
  node scripts/harness/harness-run.mjs --stage <${EXECUTABLE_STAGES.join("|")}> [options]

options:
  --base <git-ref>   select scenarios from the <git-ref>...HEAD diff
  --staged           select from the git index
  --worktree         select from uncommitted changes
  --all              ignore path matching and run every scenario in the stage
  --dry-run          print what would run and stop
  --scenarios <dir>  scenario directory (default: ${SCENARIOS_DIR})

notes:
  - stage: ${MANUAL_STAGE} scenarios are written for humans/agents and never execute here.
  - Default diff: the git index for pre-commit; @{upstream}...HEAD for pre-push.
  - HARNESS_BASE=<ref> overrides the pre-push base.
`);
}

function parseArgs(argv) {
	const args = [...argv];
	const options = {
		stage: undefined,
		mode: undefined,
		base: undefined,
		all: false,
		dryRun: false,
		scenariosDir: undefined,
	};

	while (args.length > 0) {
		const arg = args.shift();

		if (arg === "--") {
			continue;
		}
		if (arg === "--stage") {
			options.stage = args.shift();
			continue;
		}
		if (arg === "--base") {
			options.mode = "base";
			options.base = args.shift();
			continue;
		}
		if (arg === "--staged") {
			options.mode = "staged";
			continue;
		}
		if (arg === "--worktree") {
			options.mode = "worktree";
			continue;
		}
		if (arg === "--all") {
			options.all = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--scenarios") {
			options.scenariosDir = args.shift();
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

	if (!options.stage) {
		console.error("--stage is required.");
		printUsage();
		process.exit(1);
	}
	if (!EXECUTABLE_STAGES.includes(options.stage)) {
		console.error(`stage cannot be executed: ${options.stage} (allowed: ${EXECUTABLE_STAGES.join(", ")})`);
		process.exit(1);
	}
	if (options.mode === "base" && !options.base) {
		console.error("--base requires a git ref.");
		process.exit(1);
	}

	return options;
}

async function resolveDiffOptions(options) {
	if (options.mode) {
		return { mode: options.mode, base: options.base };
	}
	if (options.stage === "pre-commit") {
		return { mode: "staged" };
	}

	const base = await resolvePushBase();

	return base ? { mode: "base", base } : { mode: "worktree" };
}

function selectScenarios(scenarios, options, files) {
	return scenarios
		.filter((scenario) => scenario.stage === options.stage)
		.map((scenario) => {
			if (options.all) {
				return { scenario, matched: files, selected: true };
			}

			const regExps = scenario.paths.map((pattern) => new RegExp(pattern));
			const matched = files.filter((filePath) => regExps.some((regExp) => regExp.test(filePath)));

			return { scenario, matched, selected: matched.length > 0 };
		});
}

function checkTcp(requirement) {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host: requirement.host, port: requirement.port });
		const finish = (ok) => {
			socket.destroy();
			resolve(ok);
		};

		socket.setTimeout(REQUIRE_TIMEOUT_MS);
		socket.once("connect", () => finish(true));
		socket.once("timeout", () => finish(false));
		socket.once("error", () => finish(false));
	});
}

function checkCommand(requirement) {
	return new Promise((resolve) => {
		const child = spawn("command -v " + requirement.command, { shell: true, stdio: "ignore" });

		child.on("error", () => resolve(false));
		child.on("close", (code) => resolve(code === 0));
	});
}

function describeRequirement(requirement) {
	return requirement.type === "tcp" ? `tcp ${requirement.host}:${requirement.port}` : `command ${requirement.command}`;
}

async function checkRequirements(scenario) {
	for (const requirement of scenario.requires) {
		const ok = requirement.type === "tcp" ? await checkTcp(requirement) : await checkCommand(requirement);

		if (!ok) {
			console.error(`harness-run: ${scenario.name} requirement not met (${describeRequirement(requirement)})`);

			if (requirement.hint) {
				console.error(`harness-run: ${requirement.hint}`);
			}

			return false;
		}
	}

	return true;
}

function runStep(step) {
	return new Promise((resolve) => {
		const child = spawn(step.run, {
			shell: true,
			stdio: "inherit",
			cwd: step.cwd,
			env: { ...process.env, ...step.env },
		});

		child.on("error", (error) => {
			console.error(`harness-run: cannot start step: ${error.message}`);
			resolve(1);
		});
		child.on("close", (code) => resolve(code ?? 1));
	});
}

function describeStep(step) {
	const parts = [];

	if (step.cwd) {
		parts.push(`cwd=${step.cwd}`);
	}

	for (const [key, value] of Object.entries(step.env)) {
		parts.push(`${key}=${value}`);
	}

	return parts.length > 0 ? `${step.run}  (${parts.join(" ")})` : step.run;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const scenarios = await loadScenarios(options.scenariosDir);
	const diffOptions = await resolveDiffOptions(options);
	const files = await changedFiles(diffOptions);

	const diffLabel = diffOptions.mode === "base" ? `base ${diffOptions.base}` : diffOptions.mode;

	console.log(`harness-run: stage=${options.stage} diff=${diffLabel} files=${files.length}`);

	if (scenarios.length === 0) {
		console.log(`harness-run: no scenarios in ${options.scenariosDir ?? SCENARIOS_DIR}.`);
		return;
	}

	const selections = selectScenarios(scenarios, options, files);

	if (selections.length === 0) {
		console.log(`harness-run: no scenario declares stage=${options.stage}.`);
		return;
	}

	for (const { scenario, selected } of selections) {
		if (!selected) {
			console.log(`harness-run: skip ${scenario.name} (no matching path changed)`);
		}
	}

	const targets = selections.filter((selection) => selection.selected);

	if (targets.length === 0) {
		console.log("harness-run: nothing to run.");
		return;
	}

	for (const { scenario, matched } of targets) {
		console.log(`harness-run: run ${scenario.name} (${scenario.source})`);

		for (const filePath of matched.slice(0, 10)) {
			console.log(`  - ${filePath}`);
		}
		if (matched.length > 10) {
			console.log(`  - ... and ${matched.length - 10} more`);
		}

		if (options.dryRun) {
			for (const requirement of scenario.requires) {
				console.log(`  requires: ${describeRequirement(requirement)}`);
			}
			for (const step of scenario.steps) {
				console.log(`  step: ${step.name}\n    ${describeStep(step)}`);
			}
			continue;
		}

		if (!(await checkRequirements(scenario))) {
			process.exit(1);
		}

		for (const step of scenario.steps) {
			console.log(`harness-run: step ${step.name}`);

			const code = await runStep(step);

			if (code !== 0) {
				console.error(`harness-run: ${scenario.name} failed at step: ${step.name}`);
				process.exit(code);
			}
		}
	}

	console.log(options.dryRun ? "harness-run: dry-run complete." : "harness-run: all scenarios passed.");
}

main().catch((error) => {
	if (error instanceof HarnessConfigError || error instanceof HarnessYamlError) {
		console.error(`harness-run: harness definitions are invalid.\n${error.message}`);
		process.exit(1);
	}

	console.error(error);
	process.exit(1);
});
