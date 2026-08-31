import assert from "node:assert/strict";
import { test } from "node:test";

import { HarnessYamlError, parseHarnessYaml } from "./harness-yaml.mjs";

test("parses block maps and scalars", () => {
	const value = parseHarnessYaml(["name: example-contract", "count: 3", "enabled: true", "note: null"].join("\n"));

	assert.deepEqual(value, { name: "example-contract", count: 3, enabled: true, note: null });
});

test("does not break scalars containing colons or dashes", () => {
	const value = parseHarnessYaml(["hint: run flutter pub get, then retry", "run: dart format -- lib"].join("\n"));

	assert.equal(value.hint, "run flutter pub get, then retry");
	assert.equal(value.run, "dart format -- lib");
});

test("parses string lists", () => {
	const value = parseHarnessYaml(["paths:", "  - ^lib/src/", "  - ^\\.claude/rules/.+\\.md$"].join("\n"));

	assert.deepEqual(value.paths, ["^lib/src/", "^\\.claude/rules/.+\\.md$"]);
});

test("parses lists of maps with nested maps and lists", () => {
	const text = [
		"steps:",
		"  - name: analyze",
		"    run: flutter analyze",
		"  - name: test",
		"    run: flutter test",
		"    cwd: .",
		"    env:",
		'      CI: "1"',
		"    tags:",
		"      - slow",
	].join("\n");

	assert.deepEqual(parseHarnessYaml(text), {
		steps: [
			{ name: "analyze", run: "flutter analyze" },
			{ name: "test", run: "flutter test", cwd: ".", env: { CI: "1" }, tags: ["slow"] },
		],
	});
});

test("does not mistake Japanese prose for a map", () => {
	const value = parseHarnessYaml(["steps:", "  - 背景: 何もしない", "  - 変更範囲に応じた docs を更新する。"].join("\n"));

	assert.deepEqual(value.steps, ["背景: 何もしない", "変更範囲に応じた docs を更新する。"]);
});

test("handles quotes and comments", () => {
	const value = parseHarnessYaml(
		["# leading comment", 'quoted: "1"', "single: 'it''s ok'", "plain: value # trailing comment"].join("\n"),
	);

	assert.deepEqual(value, { quoted: "1", single: "it's ok", plain: "value" });
});

test("an empty document is null", () => {
	assert.equal(parseHarnessYaml("\n# comment only\n"), null);
});

test("unsupported syntax and broken structure throw rather than parse partially", () => {
	assert.throws(() => parseHarnessYaml("paths: [a, b]"), HarnessYamlError);
	assert.throws(() => parseHarnessYaml("body: |\n  text"), HarnessYamlError);
	assert.throws(() => parseHarnessYaml("name: a\n\tvalue: b"), HarnessYamlError);
	assert.throws(() => parseHarnessYaml("name: a\nname: b"), HarnessYamlError);
	assert.throws(() => parseHarnessYaml("name: a\n  extra: b"), HarnessYamlError);
	assert.throws(() => parseHarnessYaml("- a\nname: b"), HarnessYamlError);
	assert.throws(() => parseHarnessYaml("---\nname: a"), HarnessYamlError);
});
