/**
 * Create a harness document from its template.
 *
 * A gate that demands an exec-plan is only fair if producing one costs nothing, so the
 * factory and the gate ship together. Naming follows what `docs/` already does:
 * exec-plans / gotchas / design-docs are slug-named, ADRs are sequentially numbered.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DOC_TYPES = {
	task: {
		dir: ["docs", "exec-plans", "active"],
		template: ["docs", "exec-plans", "template.md"],
		numbered: false,
	},
	adr: {
		dir: ["docs", "adr"],
		template: ["docs", "adr", "_template.md"],
		numbered: true,
	},
	gotcha: {
		dir: ["docs", "gotchas"],
		template: ["docs", "gotchas", "_template.md"],
		numbered: false,
	},
	"design-doc": {
		dir: ["docs", "design-docs"],
		template: ["docs", "design-docs", "_template.md"],
		numbered: false,
	},
};

function todayTokyo() {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function printUsage() {
	console.error(`usage:
  node scripts/harness/new-plan.mjs <type> <slug> [--title "Title"] [--date YYYY-MM-DD]

type:
  ${Object.keys(DOC_TYPES).join(" | ")}

examples:
  node scripts/harness/new-plan.mjs task split-billing-service --title "Split billing out of the order service"
  node scripts/harness/new-plan.mjs adr queue-over-cron --title "Background work goes on a queue, not cron"
  node scripts/harness/new-plan.mjs gotcha timezone-shifts-on-date-only-column

notes:
  - task goes to docs/exec-plans/active/<slug>.md; move it to completed/ when done.
  - adr is numbered automatically from the highest existing ADR.
`);
}

function parseArgs(argv) {
	const args = [...argv];
	const type = args.shift();
	const slug = args.shift();

	if (!type || !slug) {
		printUsage();
		process.exit(1);
	}

	const options = { title: undefined, date: todayTokyo() };

	while (args.length > 0) {
		const arg = args.shift();

		if (arg === "--title") {
			options.title = args.shift();
			continue;
		}
		if (arg === "--date") {
			options.date = args.shift();
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

	return { type, slug, options };
}

async function nextAdrNumber(dir) {
	let entries = [];

	try {
		entries = await readdir(dir);
	} catch {
		return "0001";
	}

	const highest = entries.reduce((max, entry) => {
		const match = /^(\d{4})-/.exec(entry);

		return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
	}, 0);

	return String(highest + 1).padStart(4, "0");
}

function titleCase(slug) {
	return slug.replace(/-/g, " ").replace(/^./, (char) => char.toUpperCase());
}

async function main() {
	const { type, slug, options } = parseArgs(process.argv.slice(2));

	if (!(type in DOC_TYPES)) {
		console.error(`unknown type: ${type}`);
		printUsage();
		process.exit(1);
	}
	if (!/^[a-z0-9-]+$/.test(slug)) {
		console.error("slug must be kebab-case, e.g. lower-age-to-19");
		process.exit(1);
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
		console.error("--date must be YYYY-MM-DD");
		process.exit(1);
	}

	const config = DOC_TYPES[type];
	const dir = path.join(...config.dir);
	const templatePath = path.join(...config.template);

	let template;

	try {
		template = await readFile(templatePath, "utf8");
	} catch {
		console.error(`template not found: ${templatePath}`);
		process.exit(1);
	}

	const fileName = config.numbered ? `${await nextAdrNumber(dir)}-${slug}.md` : `${slug}.md`;
	const outputPath = path.join(dir, fileName);
	const content = template
		.replaceAll("{{title}}", options.title ?? titleCase(slug))
		.replaceAll("{{date}}", options.date)
		.replaceAll("{{slug}}", slug);

	await mkdir(dir, { recursive: true });

	try {
		await readFile(outputPath, "utf8");
		console.error(`already exists: ${outputPath}`);
		process.exit(1);
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
			throw error;
		}
	}

	await writeFile(outputPath, content, "utf8");
	console.log(outputPath);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
