#!/bin/sh
#
# One-shot hook wiring, run once per clone. Keeping the hooks in the repo rather than in
# .git/hooks is the point: everyone who runs this gets the same gates, whether they drive
# with Codex, Claude Code, or by hand.
#
#   sh scripts/install-hooks.sh
#
# To undo:            git config --unset core.hooksPath
# To skip one commit: git commit --no-verify   (skips EVERY gate, so say why)
#
# The harness may be installed at the repo root, or in a subdirectory of a larger repo.
# Two consequences the naive version gets wrong:
#
#   1. `cd $(git rev-parse --show-toplevel)` then setting core.hooksPath=.githooks points
#      git at <repo>/.githooks, which does not exist when the harness lives deeper. Git
#      finds no hooks and silently runs none — the gates appear installed and verify
#      nothing.
#   2. core.hooksPath is a per-REPO setting. There is no way to scope it to one
#      subdirectory, so installing here arms these hooks for EVERY commit in the repo.
#      The hooks handle that by scoping their diff and exiting immediately when a commit
#      does not touch this project — but it is a repo-wide change to someone's machine,
#      so it is stated out loud rather than done quietly.

set -eu

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_ROOT" && git rev-parse --show-toplevel)"
HOOKS_DIR="$PROJECT_ROOT/.githooks"

# An absolute path, deliberately: git's handling of a RELATIVE core.hooksPath varies with
# the directory the git command runs from, which is exactly the ambiguity that makes the
# nested layout fail. This is computed per clone, not hardcoded.
EXISTING="$(git -C "$REPO_ROOT" config core.hooksPath || true)"

if [ -n "$EXISTING" ] && [ "$EXISTING" != "$HOOKS_DIR" ]; then
	echo "refusing to install: core.hooksPath is already set to" >&2
	echo "  $EXISTING" >&2
	echo "" >&2
	echo "Something else owns the hooks for $REPO_ROOT. Overwriting would silently disable" >&2
	echo "it. Resolve by hand, then re-run." >&2
	exit 1
fi

chmod +x "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-push"
git -C "$REPO_ROOT" config core.hooksPath "$HOOKS_DIR"

echo "hooks installed: core.hooksPath -> $(git -C "$REPO_ROOT" config core.hooksPath)"
echo ""
echo "  pre-commit: contract invariants, then pre-commit scenarios"
echo "  pre-push:   contract invariants vs @{upstream}, then pre-push scenarios"
echo ""

if [ "$PROJECT_ROOT" != "$REPO_ROOT" ]; then
	echo "NOTE: the git repo is $REPO_ROOT, and this project is only"
	echo "      ${PROJECT_ROOT#"$REPO_ROOT"/} inside it."
	echo "      core.hooksPath cannot be scoped to a subdirectory, so these hooks now run"
	echo "      on EVERY commit and push in that repo. They scope their diff to this"
	echo "      project and exit immediately for anything else."
	echo ""
fi

echo "What they check is defined in harness/, not in the hooks."
