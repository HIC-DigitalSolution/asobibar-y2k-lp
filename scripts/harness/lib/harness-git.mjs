import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * The directory that owns `harness/`, resolved from this file's own location
 * (scripts/harness/lib -> up three) rather than from process.cwd().
 *
 * cwd cannot be trusted here. A git hook runs with cwd at the REPO root, which is not
 * this directory whenever the harness is installed in a subdirectory of a larger repo.
 * Deriving the root from the module path makes the harness behave identically however it
 * is invoked.
 */
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * How the diff under inspection is collected.
 * - worktree: uncommitted changes + untracked files
 * - staged:   the git index (used by the pre-commit hook)
 * - base:     <base>...HEAD (used by the pre-push hook and CI)
 */
export const DIFF_MODES = ["worktree", "staged", "base"];

/**
 * `core.quotePath=false` is mandatory here. By default git renders non-ASCII paths as
 * "\347\211..." octal escapes. Any repo with non-ASCII file or branch names hits this,
 * and the failure is silent and OPEN: every path pattern stops matching, so the harness
 * reports a clean pass on a diff it never actually inspected.
 */
async function git(args, cwd = PROJECT_ROOT) {
	const { stdout } = await execFileAsync("git", ["-c", "core.quotePath=false", ...args], {
		cwd,
		maxBuffer: 64 * 1024 * 1024,
	});

	return stdout;
}

let scopePromise;

/**
 * Where the project sits inside its git repository.
 *
 * The harness does NOT assume it was installed at the repo root. It is often adopted for
 * one project inside a monorepo or a personal catch-all repo, and that case fails OPEN in
 * three separate ways unless handled here:
 *
 * 1. **Mixed path namespaces.** `git diff --name-only` reports paths relative to the REPO
 *    root, while `git ls-files --others` reports them relative to cwd. Merging both into
 *    one list means `^`-anchored patterns match untracked files by luck and tracked ones
 *    never.
 * 2. **Out-of-scope noise.** The diff would carry every unrelated change elsewhere in the
 *    repo, so a gate meant to ask about this project asks about the whole monorepo.
 * 3. **Silent success.** With no pattern matching, every invariant reports `skip`/`pass`
 *    and the run ends "all invariants passed" — the exact failure harness/README.md calls
 *    worse than no harness, because it feels covered.
 *
 * So every git call is issued from the repo root, limited to this project's subtree by
 * pathspec, and re-anchored to the project root before any pattern sees it. When the
 * project IS the repo root the prefix is empty and all of this is a no-op.
 */
export async function resolveScope() {
	scopePromise ??= (async () => {
		let repoRoot = PROJECT_ROOT;

		try {
			repoRoot = (await git(["rev-parse", "--show-toplevel"])).trim() || PROJECT_ROOT;
		} catch {
			// Not a git repository at all: treat the project as its own root.
		}

		const prefix = path.relative(repoRoot, PROJECT_ROOT).split(path.sep).filter(Boolean).join("/");

		return { repoRoot, projectRoot: PROJECT_ROOT, prefix };
	})();

	return scopePromise;
}

/** Limit a git command to this project's subtree. Empty prefix = the whole repo already. */
function pathspec(prefix) {
	return prefix ? ["--", prefix] : [];
}

/** Repo-root-relative git output -> project-relative paths, dropping anything outside. */
function toProjectPaths(stdout, prefix) {
	const lines = stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	if (!prefix) {
		return lines;
	}

	const head = `${prefix}/`;

	return lines.filter((line) => line.startsWith(head)).map((line) => line.slice(head.length));
}

/**
 * Resolve the base ref for `base` mode.
 *
 * Deliberately NOT a fallback to `origin/main` or `origin/develop`. A long-lived branch
 * drifts from those by thousands of files, and a gate anchored to a stale ref asks about
 * the whole backlog instead of your change — at which point the only way through is
 * `--no-verify`, which disables every check at once rather than the one that misfired.
 *
 * So: the branch's own upstream, or an explicit HARNESS_BASE, or nothing. "Nothing"
 * degrades to worktree mode, which is a smaller and honest question.
 */
export async function resolvePushBase() {
	if (process.env.HARNESS_BASE) {
		return process.env.HARNESS_BASE;
	}

	try {
		const upstream = (await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])).trim();

		if (upstream) {
			return upstream;
		}
	} catch {
		// No upstream configured (new branch, or detached HEAD).
	}

	return undefined;
}

export async function changedFiles(options) {
	const { repoRoot, prefix } = await resolveScope();
	const spec = pathspec(prefix);

	if (options.mode === "staged") {
		return toProjectPaths(await git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", ...spec], repoRoot), prefix);
	}

	if (options.mode === "base") {
		return toProjectPaths(
			await git(["diff", "--name-only", "--diff-filter=ACMR", `${options.base}...HEAD`, ...spec], repoRoot),
			prefix,
		);
	}

	const tracked = toProjectPaths(await git(["diff", "--name-only", "--diff-filter=ACMR", ...spec], repoRoot), prefix);
	const untracked = toProjectPaths(await git(["ls-files", "--others", "--exclude-standard", ...spec], repoRoot), prefix);

	return Array.from(new Set([...tracked, ...untracked]));
}

/**
 * Read a file at the same revision the diff was taken from.
 *
 * In staged mode, reading the worktree would inspect edits that are not part of the
 * commit being made — the hook would then block a commit over content it is not
 * committing. Returns undefined for deleted/unreadable paths so checks can skip them.
 *
 * `filePath` is project-relative (that is what the checks see), so the repo prefix goes
 * back on for `git show`, and worktree reads are joined to the project root rather than
 * trusting cwd.
 */
export async function readFileAtDiff(filePath, options) {
	const { repoRoot, projectRoot, prefix } = await resolveScope();
	const repoPath = prefix ? `${prefix}/${filePath}` : filePath;

	try {
		if (options.mode === "staged") {
			return await git(["show", `:${repoPath}`], repoRoot);
		}
		if (options.mode === "base") {
			return await git(["show", `HEAD:${repoPath}`], repoRoot);
		}
		return await readFile(path.join(projectRoot, filePath), "utf8");
	} catch {
		return undefined;
	}
}

/** All tracked files under a project-relative path — for repo-wide (not diff-scoped) checks. */
export async function trackedFiles(subPath = ".") {
	const { repoRoot, prefix } = await resolveScope();
	const relative = subPath && subPath !== "." ? subPath : "";
	const scoped = [prefix, relative].filter(Boolean).join("/");

	return toProjectPaths(await git(["ls-files", ...(scoped ? ["--", scoped] : [])], repoRoot), prefix);
}
