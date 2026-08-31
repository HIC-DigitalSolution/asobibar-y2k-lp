# CLAUDE.md

This file is the Claude Code entry point. **The working contract is
[AGENTS.md](./AGENTS.md) — read it first, all of it.**

Nothing project-specific belongs here. Codex and Claude Code must read the same
contract, so knowledge goes in `AGENTS.md`, `harness/`, or `docs/` — never in a second
copy that only one tool sees.

## Claude Code specifics

- **Permissions are two-layer.** Read-only rules go in the committed
  `.claude/settings.json`; anything mutating goes only in the gitignored
  `.claude/settings.local.json`. A committed config must never hand write power to
  whoever clones the repo.
- `permissions.deny` holds the fixed floor — the things that stay blocked no matter how
  often they prompt. `deny` beats `ask` beats `allow`.
- Subagents in `.claude/agents/` are **read-only checkers**: they report, this agent
  decides, the human applies. A checker that also fixes hides its reasoning in a context
  the user never sees.
- Verification belongs in `harness/`, not in a prompt. A rule written only here binds
  Claude Code and nothing else — the git hooks bind everyone.
