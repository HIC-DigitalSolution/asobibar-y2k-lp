# `exec-plans/` — the plan and the record of what was verified

An exec-plan is where a non-trivial change states its assumptions **before** the work and
its verified results **after**, so the next person — or the next agent — can resume from
the repo alone rather than from a conversation nobody kept.

- `active/` — in progress.
- `completed/` — finished, with results recorded.
- `template.md` — the shape. Create from it, don't copy by hand:

```bash
node scripts/harness/new-plan.mjs task <slug> --title "<title>"
```

Files ending `-INDEX.md`, and this README, are indexes rather than plans, and the harness
does not hold them to the plan shape.

## When you need one

The [harness](../../harness/README.md) decides this mechanically, and blocks the commit
if it is missing:

- any **structural** change — `scripts/`, `.githooks/`, `.github/`, `harness/`,
  `.claude/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, a dependency manifest or
  lockfile, a build/deploy/container config
- **3 or more** source files — matched by extension (`.ts`, `.py`, `.go`, `.css`, …)
  rather than by directory, so it does not assume this repo has a `src/`

Docs-only edits never trigger it. A typo fix or a one-file change does not need a plan.

## Lifecycle

1. Create it **before** implementing.
2. Fill Goal, Scope, Constraints, Acceptance and Verification. Verification must name
   `harness-check` — the gate enforces this, because a plan that does not say how it will
   be checked is a wish.
3. Update it as decisions and measurements land. A number you measured belongs here, not
   in the chat.
4. On completion, write what each check **actually returned**, and what remains
   unverified with its residual risk.
5. Move it to `completed/`.

## The rule that makes this worth doing

A completed plan may not contain an unticked verification item or an empty Result — the
`verification-recorded` invariant fails the commit if it does. An unrun check is not a
passing check, and "probably fine" is not a result. If something was genuinely not
verified, say so in Result along with the risk; that is a legitimate outcome, and silence
is not.
