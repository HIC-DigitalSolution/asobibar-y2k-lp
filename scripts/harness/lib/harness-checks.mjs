/**
 * The machine checks a contract invariant may use.
 *
 * A `check.type` that is not registered here fails at LOAD time (see harness-config.mjs),
 * not at run time. That is the entire point of this layer: it must be impossible to write
 * an invariant into a contract that nothing actually verifies. An invariant that cannot be
 * verified mechanically has to say so out loud, as `type: manual`, and it then reports
 * `manual` forever — never `pass`.
 */

import { stat } from "node:fs/promises";

export const CHECK_STATUS = {
	pass: "pass",
	fail: "fail",
	skip: "skip",
	manual: "manual",
};

function toRegExps(patterns) {
	return patterns.map((pattern) => new RegExp(pattern));
}

function matchesAny(filePath, regExps) {
	return regExps.some((regExp) => regExp.test(filePath));
}

function formatList(items) {
	return items.map((item) => `  - ${item}`).join("\n");
}

/* -------------------------------------------------------------------------- */
/* markdown helpers (shared by the exec-plan checks)                           */
/* -------------------------------------------------------------------------- */

export function parseSections(markdown) {
	const sections = [{ heading: "", lines: [] }];

	for (const line of markdown.split(/\r?\n/)) {
		const match = /^(#{1,6})\s+(.*)$/.exec(line);

		if (match) {
			sections.push({ heading: match[2].trim(), lines: [] });
			continue;
		}

		sections[sections.length - 1].lines.push(line);
	}

	return sections;
}

export function findSection(sections, headings) {
	const wanted = headings.map((heading) => heading.trim().toLowerCase());

	return sections.find((section) => wanted.includes(section.heading.toLowerCase()));
}

export function sectionIsFilled(lines) {
	return lines.some((line) => {
		const text = line.trim();

		if (text === "") {
			return false;
		}

		const body = text.replace(/^[-*]\s+/, "").replace(/^\[[ xX]\]\s*/, "");

		if (body === "") {
			return false;
		}

		// Template placeholders such as `[target state]` count as NOT filled in.
		return !/^\[[^\]]*\]$/.test(body);
	});
}

export function uncheckedItems(lines) {
	return lines.filter((line) => /^\s*[-*]\s*\[ \]/.test(line)).map((line) => line.trim());
}

function sectionLabel(definition) {
	return definition.headings.join(" / ");
}

async function collectPlans(context, planRegExps) {
	const planFiles = context.files.filter((filePath) => matchesAny(filePath, planRegExps));
	const plans = [];

	for (const filePath of planFiles) {
		const content = await context.readFileAtDiff(filePath);

		if (content === undefined) {
			continue;
		}

		plans.push({ filePath, sections: parseSections(content) });
	}

	return plans;
}

/* -------------------------------------------------------------------------- */
/* checks                                                                      */
/* -------------------------------------------------------------------------- */

const execPlanRequired = {
	type: "exec-plan-required",
	requiredParams: ["plan_paths", "structural_paths", "source_paths"],
	optionalParams: ["excluded_paths", "source_threshold", "hint"],
	async run(params, context) {
		const planRegExps = toRegExps(params.plan_paths);
		const structuralRegExps = toRegExps(params.structural_paths);
		const sourceRegExps = toRegExps(params.source_paths);
		const excludedRegExps = toRegExps(params.excluded_paths ?? []);
		const sourceThreshold = params.source_threshold ?? 3;

		const relevantFiles = context.files.filter((filePath) => !matchesAny(filePath, excludedRegExps));
		const structuralFiles = relevantFiles.filter((filePath) => matchesAny(filePath, structuralRegExps));
		const sourceFiles = relevantFiles.filter((filePath) => matchesAny(filePath, sourceRegExps));

		let requirement;

		if (structuralFiles.length > 0) {
			requirement = { reason: "structural change detected.", files: structuralFiles };
		} else if (sourceFiles.length >= sourceThreshold) {
			requirement = {
				reason: `${sourceThreshold}+ source files changed.`,
				files: sourceFiles,
			};
		}

		if (!requirement) {
			return { status: CHECK_STATUS.pass, message: "local change; no exec-plan required." };
		}

		if (context.files.some((filePath) => matchesAny(filePath, planRegExps))) {
			return { status: CHECK_STATUS.pass, message: `${requirement.reason} exec-plan found in the diff.` };
		}

		return {
			status: CHECK_STATUS.fail,
			message: `${requirement.reason} No exec-plan in the diff.`,
			details: [
				"files:",
				formatList(requirement.files.slice(0, 20)),
				requirement.files.length > 20 ? `  ... and ${requirement.files.length - 20} more` : "",
				"",
				params.hint ?? 'fix: node scripts/harness/new-plan.mjs task <slug> --title "<title>", then fill it in.',
			].filter(Boolean),
		};
	},
};

const execPlanSections = {
	type: "exec-plan-sections",
	requiredParams: ["plan_paths", "required_sections"],
	optionalParams: ["hint"],
	async run(params, context) {
		const plans = await collectPlans(context, toRegExps(params.plan_paths));

		if (plans.length === 0) {
			return { status: CHECK_STATUS.skip, message: "no exec-plan in the diff." };
		}

		const problems = [];

		for (const plan of plans) {
			for (const definition of params.required_sections) {
				const section = findSection(plan.sections, definition.headings);

				if (!section) {
					problems.push(`${plan.filePath}: missing section: ${sectionLabel(definition)}`);
					continue;
				}
				if (!sectionIsFilled(section.lines)) {
					problems.push(`${plan.filePath}: section still a placeholder: ${section.heading}`);
					continue;
				}

				const mustContain = definition.must_contain;

				if (mustContain && !section.lines.some((line) => line.includes(mustContain))) {
					problems.push(`${plan.filePath}: section "${section.heading}" does not mention ${mustContain}`);
				}
			}
		}

		if (problems.length > 0) {
			return {
				status: CHECK_STATUS.fail,
				message: "an exec-plan in the diff has unfilled required sections.",
				details: [formatList(problems)],
			};
		}

		return {
			status: CHECK_STATUS.pass,
			message: `required sections present in ${plans.length} exec-plan(s).`,
		};
	},
};

const completedPlanVerification = {
	type: "completed-plan-verification",
	requiredParams: ["plan_paths", "verification_sections"],
	optionalParams: ["result_sections", "hint"],
	async run(params, context) {
		const plans = await collectPlans(context, toRegExps(params.plan_paths));

		if (plans.length === 0) {
			return { status: CHECK_STATUS.skip, message: "no completed exec-plan in the diff." };
		}

		const problems = [];

		for (const plan of plans) {
			for (const definition of params.verification_sections) {
				const section = findSection(plan.sections, definition.headings);

				if (!section) {
					problems.push(`${plan.filePath}: missing section: ${sectionLabel(definition)}`);
					continue;
				}

				const unchecked = uncheckedItems(section.lines);

				if (unchecked.length > 0) {
					problems.push(`${plan.filePath}: "${section.heading}" still has unrun items: ${unchecked.join(" / ")}`);
				}
			}

			for (const definition of params.result_sections ?? []) {
				const section = findSection(plan.sections, definition.headings);

				if (!section) {
					problems.push(`${plan.filePath}: missing section: ${sectionLabel(definition)}`);
					continue;
				}
				if (!sectionIsFilled(section.lines)) {
					problems.push(`${plan.filePath}: "${section.heading}" records no verification result.`);
				}
			}
		}

		if (problems.length > 0) {
			return {
				status: CHECK_STATUS.fail,
				message: "a completed exec-plan has unrecorded verification.",
				details: [
					formatList(problems),
					"",
					params.hint ??
						"fix: if a check was not run, write why and the residual risk under Result; if it was, tick it.",
				],
			};
		}

		return {
			status: CHECK_STATUS.pass,
			message: `verification recorded in ${plans.length} completed exec-plan(s).`,
		};
	},
};

/**
 * "If A changed, B must change too." Used for the DB migration-file rule: a schema
 * dump that moved means the database moved, and the change must leave a replayable
 * migration file behind.
 */
const companionRequired = {
	type: "companion-required",
	requiredParams: ["trigger_paths", "companion_paths"],
	optionalParams: ["hint"],
	async run(params, context) {
		const triggered = context.files.filter((filePath) => matchesAny(filePath, toRegExps(params.trigger_paths)));

		if (triggered.length === 0) {
			return { status: CHECK_STATUS.pass, message: "no triggering change in the diff." };
		}

		if (context.files.some((filePath) => matchesAny(filePath, toRegExps(params.companion_paths)))) {
			return { status: CHECK_STATUS.pass, message: "triggering change has its companion file in the diff." };
		}

		return {
			status: CHECK_STATUS.fail,
			message: "a triggering change is missing its companion file.",
			details: ["triggered by:", formatList(triggered.slice(0, 20)), "", params.hint ?? ""].filter(Boolean),
		};
	},
};

/**
 * Content-level boundary check, scoped to the files in the diff.
 *
 * Diff-scoped on purpose: a real codebase carries existing violations, and a repo-wide
 * version would fail on every commit until that debt is paid, which trains people to
 * bypass the hook entirely. `exempt_paths` is the ratchet — it lists today's known violations and is
 * only ever allowed to shrink. When an exempt file is edited and no longer violates, the
 * check says so, so the exemption gets removed instead of quietly outliving the debt.
 */
const forbiddenContent = {
	type: "forbidden-content",
	requiredParams: ["applies_to_paths", "forbidden_patterns"],
	optionalParams: ["exempt_paths", "hint"],
	async run(params, context) {
		const appliesTo = toRegExps(params.applies_to_paths);
		const forbidden = toRegExps(params.forbidden_patterns);
		const exempt = toRegExps(params.exempt_paths ?? []);

		const candidates = context.files.filter((filePath) => matchesAny(filePath, appliesTo));

		if (candidates.length === 0) {
			return { status: CHECK_STATUS.skip, message: "no file in the diff is in scope." };
		}

		const violations = [];
		const staleExemptions = [];

		for (const filePath of candidates) {
			const content = await context.readFileAtDiff(filePath);

			if (content === undefined) {
				continue;
			}

			const hits = forbidden.filter((regExp) => regExp.test(content));
			const isExempt = matchesAny(filePath, exempt);

			if (hits.length > 0 && !isExempt) {
				violations.push(`${filePath}: ${hits.map((regExp) => regExp.source).join(", ")}`);
			}
			if (hits.length === 0 && isExempt) {
				staleExemptions.push(filePath);
			}
		}

		if (violations.length > 0) {
			return {
				status: CHECK_STATUS.fail,
				message: `${violations.length} file(s) in the diff cross the boundary.`,
				details: [formatList(violations), "", params.hint ?? ""].filter(Boolean),
			};
		}

		const details =
			staleExemptions.length > 0
				? [
						"exemptions that are no longer needed (remove them from exempt_paths):",
						formatList(staleExemptions),
					]
				: undefined;

		return {
			status: CHECK_STATUS.pass,
			message: `${candidates.length} in-scope file(s) respect the boundary.`,
			details,
		};
	},
};

/**
 * Forbidden file shapes rather than forbidden content.
 *
 * `exempt_paths` carries the same ratchet meaning as in forbidden-content: a documented
 * exception, not a loophole. The rule for `.composition.dart`, for instance, forbids it as
 * a routine file but allows it for a screen that genuinely needs swappable deps — that
 * screen goes here, with the exec-plan that justifies it.
 */
const forbiddenPath = {
	type: "forbidden-path",
	requiredParams: ["forbidden_paths"],
	optionalParams: ["exempt_paths", "hint"],
	async run(params, context) {
		const exempt = toRegExps(params.exempt_paths ?? []);
		const forbidden = context.files.filter(
			(filePath) => matchesAny(filePath, toRegExps(params.forbidden_paths)) && !matchesAny(filePath, exempt),
		);

		if (forbidden.length === 0) {
			return { status: CHECK_STATUS.pass, message: "no forbidden path in the diff." };
		}

		return {
			status: CHECK_STATUS.fail,
			message: `${forbidden.length} forbidden path(s) in the diff.`,
			details: [formatList(forbidden), "", params.hint ?? ""].filter(Boolean),
		};
	},
};

/**
 * Every in-scope file must CONTAIN each pattern.
 *
 * The mirror of forbidden-content, and the one that matters for a page: most landing-page
 * defects are omissions, not mistakes. A missing <title>, no og:image, no lang attribute
 * and no alt text are all invisible in review and expensive in production.
 */
const requiredContent = {
	type: "required-content",
	requiredParams: ["applies_to_paths", "required_patterns"],
	optionalParams: ["exempt_paths", "hint"],
	async run(params, context) {
		const appliesTo = toRegExps(params.applies_to_paths);
		const required = toRegExps(params.required_patterns);
		const exempt = toRegExps(params.exempt_paths ?? []);

		const candidates = context.files.filter(
			(filePath) => matchesAny(filePath, appliesTo) && !matchesAny(filePath, exempt),
		);

		if (candidates.length === 0) {
			return { status: CHECK_STATUS.skip, message: "no file in the diff is in scope." };
		}

		const problems = [];

		for (const filePath of candidates) {
			const content = await context.readFileAtDiff(filePath);

			if (content === undefined) {
				continue;
			}

			const missing = required.filter((regExp) => !regExp.test(content));

			if (missing.length > 0) {
				problems.push(`${filePath}: missing ${missing.map((r) => r.source).join(", ")}`);
			}
		}

		if (problems.length > 0) {
			return {
				status: CHECK_STATUS.fail,
				message: `${problems.length} file(s) are missing required content.`,
				details: [formatList(problems), "", params.hint ?? ""].filter(Boolean),
			};
		}

		return {
			status: CHECK_STATUS.pass,
			message: `${candidates.length} in-scope file(s) contain everything required.`,
		};
	},
};

/**
 * Cap the on-disk size of matched files.
 *
 * For a landing page this is the single highest-leverage automated check there is: an
 * unoptimised hero image is the usual reason LCP collapses on mobile, and it is invisible
 * in code review because the diff just says "added hero.png".
 *
 * Reads the working tree rather than the diff revision — binary blobs are not meaningfully
 * readable as text, and the size on disk is the thing shipping.
 */
const maxFileSize = {
	type: "max-file-size",
	requiredParams: ["applies_to_paths", "max_kb"],
	optionalParams: ["exempt_paths", "hint"],
	async run(params, context) {
		const appliesTo = toRegExps(params.applies_to_paths);
		const exempt = toRegExps(params.exempt_paths ?? []);
		const limit = params.max_kb * 1024;

		const candidates = context.files.filter(
			(filePath) => matchesAny(filePath, appliesTo) && !matchesAny(filePath, exempt),
		);

		if (candidates.length === 0) {
			return { status: CHECK_STATUS.skip, message: "no file in the diff is in scope." };
		}

		const tooBig = [];

		for (const filePath of candidates) {
			try {
				const info = await stat(filePath);

				if (info.size > limit) {
					tooBig.push(`${filePath}: ${Math.round(info.size / 1024)}KB (limit ${params.max_kb}KB)`);
				}
			} catch {
				// Deleted or otherwise unreadable in the working tree — nothing to weigh.
			}
		}

		if (tooBig.length > 0) {
			return {
				status: CHECK_STATUS.fail,
				message: `${tooBig.length} file(s) exceed the size budget.`,
				details: [formatList(tooBig), "", params.hint ?? ""].filter(Boolean),
			};
		}

		return { status: CHECK_STATUS.pass, message: `${candidates.length} file(s) within budget.` };
	},
};

const manual = {
	type: "manual",
	requiredParams: [],
	optionalParams: ["note"],
	async run(params) {
		return {
			status: CHECK_STATUS.manual,
			message: params.note ?? "cannot be verified mechanically; confirm by hand.",
		};
	},
};

export const CHECKS = new Map(
	[
		execPlanRequired,
		execPlanSections,
		completedPlanVerification,
		companionRequired,
		forbiddenContent,
		forbiddenPath,
		requiredContent,
		maxFileSize,
		manual,
	].map((check) => [check.type, check]),
);
