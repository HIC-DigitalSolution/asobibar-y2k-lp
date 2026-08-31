import assert from "node:assert/strict";
import { test } from "node:test";

import { CHECK_STATUS, CHECKS, sectionIsFilled, uncheckedItems } from "./harness-checks.mjs";

const PLAN_PATHS = ["^docs/exec-plans/active/.+\\.md$", "^docs/exec-plans/completed/.+\\.md$"];

const EXEC_PLAN_REQUIRED_PARAMS = {
	plan_paths: PLAN_PATHS,
	structural_paths: ["^scripts/", "^pubspec\\.yaml$", "^harness/"],
	source_paths: ["^lib/src/"],
	excluded_paths: ["^docs/"],
	source_threshold: 3,
};

function context(files, contents = {}) {
	return {
		files,
		mode: "worktree",
		readFileAtDiff: async (filePath) => contents[filePath],
	};
}

function run(type, params, ctx) {
	return CHECKS.get(type).run(params, ctx);
}

test("sectionIsFilled treats placeholders as unfilled", () => {
	assert.equal(sectionIsFilled(["[target state]"]), false);
	assert.equal(sectionIsFilled(["- [included work]", ""]), false);
	assert.equal(sectionIsFilled(["- [ ] [verification]"]), false);
	assert.equal(sectionIsFilled([""]), false);
	assert.equal(sectionIsFilled(["- [ ] `flutter analyze`"]), true);
	assert.equal(sectionIsFilled(["real prose"]), true);
});

test("uncheckedItems picks up only unticked boxes", () => {
	assert.deepEqual(uncheckedItems(["- [x] done", "- [ ] todo", "- text"]), ["- [ ] todo"]);
});

test("exec-plan-required allows a local change", async () => {
	const result = await run("exec-plan-required", EXEC_PLAN_REQUIRED_PARAMS, context(["lib/src/pages/a.dart"]));

	assert.equal(result.status, CHECK_STATUS.pass);
});

test("exec-plan-required demands a plan for a structural change", async () => {
	const withoutPlan = await run("exec-plan-required", EXEC_PLAN_REQUIRED_PARAMS, context(["harness/contracts/x.yaml"]));

	assert.equal(withoutPlan.status, CHECK_STATUS.fail);

	const withPlan = await run(
		"exec-plan-required",
		EXEC_PLAN_REQUIRED_PARAMS,
		context(["harness/contracts/x.yaml", "docs/exec-plans/active/x.md"]),
	);

	assert.equal(withPlan.status, CHECK_STATUS.pass);
});

test("exec-plan-required fires at the source threshold but not below it", async () => {
	const below = await run(
		"exec-plan-required",
		EXEC_PLAN_REQUIRED_PARAMS,
		context(["lib/src/a.dart", "lib/src/b.dart"]),
	);

	assert.equal(below.status, CHECK_STATUS.pass);

	const atThreshold = await run(
		"exec-plan-required",
		EXEC_PLAN_REQUIRED_PARAMS,
		context(["lib/src/a.dart", "lib/src/b.dart", "lib/src/c.dart"]),
	);

	assert.equal(atThreshold.status, CHECK_STATUS.fail);
});

test("exec-plan-required ignores docs-only edits", async () => {
	const result = await run(
		"exec-plan-required",
		EXEC_PLAN_REQUIRED_PARAMS,
		context([".claude/docs/gotchas/a.md", ".claude/docs/gotchas/b.md", ".claude/docs/gotchas/c.md"]),
	);

	assert.equal(result.status, CHECK_STATUS.pass);
});

test("exec-plan-sections rejects a plan whose sections are still placeholders", async () => {
	const params = {
		plan_paths: PLAN_PATHS,
		required_sections: [{ headings: ["Goal"] }, { headings: ["Verification"], must_contain: "harness-check" }],
	};
	const plan = "docs/exec-plans/active/x.md";

	const placeholder = await run(
		"exec-plan-sections",
		params,
		context([plan], { [plan]: "# X\n\n## Goal\n\n[target state]\n\n## Verification\n\n- [ ] harness-check\n" }),
	);

	assert.equal(placeholder.status, CHECK_STATUS.fail);

	const filled = await run(
		"exec-plan-sections",
		params,
		context([plan], { [plan]: "# X\n\n## Goal\n\nreal goal\n\n## Verification\n\n- [ ] `harness-check`\n" }),
	);

	assert.equal(filled.status, CHECK_STATUS.pass);
});

test("exec-plan-sections requires the named command in the verification section", async () => {
	const params = {
		plan_paths: PLAN_PATHS,
		required_sections: [{ headings: ["Verification"], must_contain: "harness-check" }],
	};
	const plan = "docs/exec-plans/active/x.md";

	const result = await run(
		"exec-plan-sections",
		params,
		context([plan], { [plan]: "# X\n\n## Verification\n\n- [ ] flutter analyze\n" }),
	);

	assert.equal(result.status, CHECK_STATUS.fail);
});

test("completed-plan-verification rejects unrun checks and empty results", async () => {
	const params = {
		plan_paths: ["^docs/exec-plans/completed/.+\\.md$"],
		verification_sections: [{ headings: ["Verification"] }],
		result_sections: [{ headings: ["Result"] }],
	};
	const plan = "docs/exec-plans/completed/x.md";

	const unrun = await run(
		"completed-plan-verification",
		params,
		context([plan], { [plan]: "# X\n\n## Verification\n\n- [ ] flutter analyze\n\n## Result\n\ndone\n" }),
	);

	assert.equal(unrun.status, CHECK_STATUS.fail);

	const emptyResult = await run(
		"completed-plan-verification",
		params,
		context([plan], { [plan]: "# X\n\n## Verification\n\n- [x] flutter analyze\n\n## Result\n\n[on completion]\n" }),
	);

	assert.equal(emptyResult.status, CHECK_STATUS.fail);

	const complete = await run(
		"completed-plan-verification",
		params,
		context([plan], { [plan]: "# X\n\n## Verification\n\n- [x] flutter analyze\n\n## Result\n\n0 issues.\n" }),
	);

	assert.equal(complete.status, CHECK_STATUS.pass);
});

test("companion-required fires only when the trigger path changed", async () => {
	const params = {
		trigger_paths: ["^db/schema/"],
		companion_paths: ["^db/migrations/.+\\.sql$"],
	};

	assert.equal((await run("companion-required", params, context(["src/app.tsx"]))).status, CHECK_STATUS.pass);

	assert.equal(
		(await run("companion-required", params, context(["db/schema/x.sql"]))).status,
		CHECK_STATUS.fail,
	);

	assert.equal(
		(
			await run(
				"companion-required",
				params,
				context(["db/schema/x.sql", "db/migrations/x_2026_08_12.sql"]),
			)
		).status,
		CHECK_STATUS.pass,
	);
});

test("forbidden-content blocks new violations and honours the exemption ratchet", async () => {
	const params = {
		applies_to_paths: ["^lib/src/(api|domain)/.+\\.dart$"],
		forbidden_patterns: ["BuildContext", "package:flutter/material\\.dart"],
		exempt_paths: ["^lib/src/api/legacy/known_debt\\.dart$"],
	};

	const clean = await run(
		"forbidden-content",
		params,
		context(["lib/src/api/x/repository.dart"], { "lib/src/api/x/repository.dart": "class R {}" }),
	);

	assert.equal(clean.status, CHECK_STATUS.pass);

	const violation = await run(
		"forbidden-content",
		params,
		context(["lib/src/api/x/repository.dart"], {
			"lib/src/api/x/repository.dart": "void f(BuildContext context) {}",
		}),
	);

	assert.equal(violation.status, CHECK_STATUS.fail);

	const exempt = await run(
		"forbidden-content",
		params,
		context(["lib/src/api/legacy/known_debt.dart"], {
			"lib/src/api/legacy/known_debt.dart": "void f(BuildContext context) {}",
		}),
	);

	assert.equal(exempt.status, CHECK_STATUS.pass);
});

test("forbidden-content reports an exemption that is no longer needed", async () => {
	const params = {
		applies_to_paths: ["^lib/src/api/.+\\.dart$"],
		forbidden_patterns: ["BuildContext"],
		exempt_paths: ["^lib/src/api/legacy/known_debt\\.dart$"],
	};

	const result = await run(
		"forbidden-content",
		params,
		context(["lib/src/api/legacy/known_debt.dart"], { "lib/src/api/legacy/known_debt.dart": "class Clean {}" }),
	);

	assert.equal(result.status, CHECK_STATUS.pass);
	assert.match(result.details.join("\n"), /no longer needed/);
});

test("forbidden-content skips when nothing in the diff is in scope", async () => {
	const result = await run(
		"forbidden-content",
		{ applies_to_paths: ["^lib/src/api/"], forbidden_patterns: ["BuildContext"] },
		context(["lib/src/pages/a.dart"]),
	);

	assert.equal(result.status, CHECK_STATUS.skip);
});

test("forbidden-path blocks forbidden file shapes", async () => {
	const params = { forbidden_paths: ["\\.host\\.dart$", "^lib/src/api/.+/model/"] };

	assert.equal((await run("forbidden-path", params, context(["lib/src/pages/a.view.dart"]))).status, CHECK_STATUS.pass);
	assert.equal(
		(await run("forbidden-path", params, context(["lib/src/pages/a/screen/b/b.host.dart"]))).status,
		CHECK_STATUS.fail,
	);
	assert.equal(
		(await run("forbidden-path", params, context(["lib/src/api/iap/model/x.dart"]))).status,
		CHECK_STATUS.fail,
	);
});

test("manual never reports pass", async () => {
	const result = await run("manual", { note: "confirm against the schema dump" }, context([]));

	assert.equal(result.status, CHECK_STATUS.manual);
	assert.notEqual(result.status, CHECK_STATUS.pass);
});

test("required-content flags a page missing its SEO basics", async () => {
	const params = {
		applies_to_paths: ["\\.html$"],
		required_patterns: ["<title", 'property="og:image"', "<html[^>]+lang="],
	};

	const bad = await run("required-content", params, context(["index.html"], {
		"index.html": '<html><head><title>Hi</title></head></html>',
	}));

	assert.equal(bad.status, CHECK_STATUS.fail);
	assert.match(bad.details.join("\n"), /og:image/);

	const good = await run("required-content", params, context(["index.html"], {
		"index.html": '<html lang="ja"><head><title>Hi</title><meta property="og:image" content="x"></head></html>',
	}));

	assert.equal(good.status, CHECK_STATUS.pass);
});

test("required-content skips files that are out of scope or exempt", async () => {
	const params = { applies_to_paths: ["\\.html$"], required_patterns: ["<title"], exempt_paths: ["^partials/"] };

	assert.equal((await run("required-content", params, context(["src/app.tsx"]))).status, CHECK_STATUS.skip);
	assert.equal((await run("required-content", params, context(["partials/nav.html"]))).status, CHECK_STATUS.skip);
});
