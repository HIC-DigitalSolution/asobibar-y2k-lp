import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { HarnessConfigError, loadContracts, loadScenarios } from "./harness-config.mjs";

async function dirWith(name, text) {
	const dir = await mkdtemp(path.join(tmpdir(), "harness-"));

	await writeFile(path.join(dir, name), text, "utf8");

	return dir;
}

const VALID_CONTRACT = [
	"name: test-contract",
	"invariants:",
	"  - id: plan-required",
	"    statement: structural changes carry an exec-plan.",
	"    check:",
	"      type: exec-plan-required",
	"      plan_paths:",
	"        - ^plans/",
	"      structural_paths:",
	"        - ^scripts/",
	"      source_paths:",
	"        - ^lib/src/",
].join("\n");

test("loads a valid contract", async () => {
	const dir = await dirWith("c.yaml", VALID_CONTRACT);
	const [contract] = await loadContracts(dir);

	assert.equal(contract.name, "test-contract");
	assert.equal(contract.invariants[0].id, "plan-required");
	assert.equal(contract.invariants[0].check.type, "exec-plan-required");
});

test("an unknown check.type fails at load time, not silently", async () => {
	const dir = await dirWith(
		"c.yaml",
		["name: c", "invariants:", "  - id: x", "    statement: s", "    check:", "      type: vibes"].join("\n"),
	);

	await assert.rejects(() => loadContracts(dir), HarnessConfigError);
});

test("an unknown param key fails at load time", async () => {
	const dir = await dirWith("c.yaml", `${VALID_CONTRACT}\n      typo_paths:\n        - ^x/`);

	await assert.rejects(() => loadContracts(dir), HarnessConfigError);
});

test("a missing required param fails at load time", async () => {
	const dir = await dirWith(
		"c.yaml",
		[
			"name: c",
			"invariants:",
			"  - id: x",
			"    statement: s",
			"    check:",
			"      type: forbidden-content",
			"      applies_to_paths:",
			"        - ^lib/",
		].join("\n"),
	);

	await assert.rejects(() => loadContracts(dir), HarnessConfigError);
});

test("an invalid regex fails at load time", async () => {
	const dir = await dirWith(
		"c.yaml",
		[
			"name: c",
			"invariants:",
			"  - id: x",
			"    statement: s",
			"    check:",
			"      type: forbidden-path",
			"      forbidden_paths:",
			"        - '['",
		].join("\n"),
	);

	await assert.rejects(() => loadContracts(dir), HarnessConfigError);
});

test("duplicate invariant ids fail at load time", async () => {
	const dir = await dirWith(
		"c.yaml",
		[
			"name: c",
			"invariants:",
			"  - id: x",
			"    statement: s",
			"    check:",
			"      type: manual",
			"  - id: x",
			"    statement: s2",
			"    check:",
			"      type: manual",
		].join("\n"),
	);

	await assert.rejects(() => loadContracts(dir), HarnessConfigError);
});

test("loads an executable scenario and a manual one", async () => {
	const dir = await dirWith(
		"s.yaml",
		[
			"name: s",
			"stage: pre-push",
			"match:",
			"  paths:",
			"    - ^lib/src/",
			"requires:",
			"  - type: command",
			"    command: flutter",
			"    hint: install flutter",
			"steps:",
			"  - name: analyze",
			"    run: flutter analyze",
		].join("\n"),
	);

	const [scenario] = await loadScenarios(dir);

	assert.equal(scenario.stage, "pre-push");
	assert.deepEqual(scenario.paths, ["^lib/src/"]);
	assert.equal(scenario.requires[0].command, "flutter");
	assert.equal(scenario.steps[0].run, "flutter analyze");
});

test("a manual scenario may not declare match or requires", async () => {
	const dir = await dirWith(
		"s.yaml",
		["name: s", "stage: manual", "match:", "  paths:", "    - ^lib/", "steps:", "  - do the thing"].join("\n"),
	);

	await assert.rejects(() => loadScenarios(dir), HarnessConfigError);
});

test("an unknown stage fails at load time", async () => {
	const dir = await dirWith("s.yaml", ["name: s", "stage: post-merge", "steps:", "  - x"].join("\n"));

	await assert.rejects(() => loadScenarios(dir), HarnessConfigError);
});

// Guards the definitions actually shipped, not just the loader. A typo in a real
// contract would otherwise only surface when someone's commit was blocked by a
// confusing error.
test("the repo's own contracts and scenarios load", async () => {
	const contracts = await loadContracts();
	const scenarios = await loadScenarios();

	assert.ok(contracts.length >= 1, "expected at least one contract in harness/contracts");
	assert.ok(scenarios.length >= 1, "expected at least one scenario in harness/scenarios");

	const ids = contracts.flatMap((contract) => contract.invariants.map((invariant) => invariant.id));

	assert.equal(new Set(ids).size, ids.length, "invariant ids must be unique across all contracts");
});

test("plan_paths does not treat an index or README as a plan", async () => {
	const shape = (await loadContracts())
		.flatMap((c) => c.invariants)
		.find((i) => i.check.type === "exec-plan-sections");

	if (!shape) return; // a project may not use the exec-plan gate

	const matches = (file) => shape.check.params.plan_paths.some((p) => new RegExp(p).test(file));

	assert.equal(matches("docs/exec-plans/active/some-plan.md"), true);
	assert.equal(matches("docs/exec-plans/active/00-INDEX.md"), false);
	assert.equal(matches("docs/exec-plans/active/README.md"), false);
});
