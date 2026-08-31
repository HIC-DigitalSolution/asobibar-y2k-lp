# `harness/` — rules that run

`harness/contracts/` and `CLAUDE.md` only work when someone reads them. What is written
here is **executed**: a script loads these files and turns them into a pass, a failure,
or an explicit "nobody verified this."

- `contracts/*.yaml` — invariants that must hold, each with the way it is machine-checked.
- `scenarios/*.yaml` — which commands run, at which git stage, for which changed paths.

The engine is `scripts/harness/`, zero-dependency Node — it must run in a repo with no
package manifest at all, so the YAML parser is a builtin-only subset (see below).

## Running it

```bash
node scripts/harness/harness-check.mjs                 # uncommitted + untracked
node scripts/harness/harness-check.mjs --staged        # the git index (pre-commit uses this)
node scripts/harness/harness-check.mjs --upstream      # @{upstream}...HEAD (pre-push uses this)
node scripts/harness/harness-check.mjs --base <ref>    # explicit base

node scripts/harness/harness-run.mjs --stage pre-push --dry-run   # what would run
node scripts/harness/harness-run.mjs --stage pre-push             # run it

node --test scripts/harness/lib/*.test.mjs             # the engine's own tests
```

`git commit` / `git push` run these automatically **only after** `sh scripts/install-hooks.sh`.

## The two rules that make this worth having

**1. An invariant nothing verifies cannot be written.** An unknown `check.type`, an
unknown param key, a missing required param, or a broken regex fails at *load* time, not
at run time. A harness that skips what it does not understand reports success on rules it
never evaluated — which is worse than no harness, because it feels covered.

**2. What cannot be checked says so, forever.** A judgement-shaped rule uses
`type: manual`. It reports `manual`, never `pass`, on every single run. That is the
honest state of most of a project's hardest rules — is this copy the copy the client
approved, is this the right abstraction, is this data shape faithful to the source — and
the note should name who or what judges it.

## Contract schema

```yaml
name: example-contract
summary: one line
inputs: [files a reader should have open]
outputs: [what the work must leave behind]
invariants:
  - id: unique-within-this-contract
    statement: the human-readable invariant, printed when it fails
    rule: harness/contracts/whatever.md        # optional, printed on failure
    check:
      type: exec-plan-required             # must be an implemented type
      plan_paths: [regex]
```

Param names are typed by suffix, so a new check type gets validation for free:
`*_paths` and `*_patterns` are regex lists, `*_sections` are heading groups,
`*_threshold` / `*_kb` / `*_count` are positive integers, anything else is a string.

### Implemented check types

| type | what it looks at | main params |
|---|---|---|
| `exec-plan-required` | structural or broad source changes carry an exec-plan | `plan_paths`, `structural_paths`, `source_paths`, `excluded_paths`, `source_threshold` |
| `exec-plan-sections` | an exec-plan in the diff has its sections filled, not placeheld | `plan_paths`, `required_sections` (`headings`, `must_contain`) |
| `completed-plan-verification` | a completed plan has no unrun check and no empty result | `plan_paths`, `verification_sections`, `result_sections` |
| `companion-required` | "if A changed, B must change too" | `trigger_paths`, `companion_paths` |
| `forbidden-content` | files in the diff do not contain forbidden patterns | `applies_to_paths`, `forbidden_patterns`, `exempt_paths` |
| `forbidden-path` | forbidden file shapes are not added | `forbidden_paths`, `exempt_paths` |
| `required-content` | in-scope files CONTAIN each pattern (title, OG tags, lang) | `applies_to_paths`, `required_patterns`, `exempt_paths` |
| `max-file-size` | matched files stay under a size budget (hero images) | `applies_to_paths`, `max_kb`, `exempt_paths` |
| `manual` | nothing. Reports as unverified, every run | `note` |

To add a type: implement it in `scripts/harness/lib/harness-checks.mjs`, register it in
`CHECKS`, and add a test to `harness-checks.test.mjs`. Until it is registered, any
contract using it refuses to load.

### `exempt_paths` is a ratchet, not a loophole

The boundary checks are scoped to **files in the diff**, and carry a list of today's
known violations. This is deliberate: every real codebase has existing violations, and a
repo-wide gate would fail on every commit until they are all fixed — at which point
everyone learns to type `--no-verify`, and every other gate dies with it.

So the list may only ever **shrink**. Delete a line as each file is cleaned; never add
one. When an exempt file is edited and no longer violates, the check says the exemption
is no longer needed, so it gets removed instead of quietly outliving the debt.

## Scenario schema

```yaml
name: example-scenario
summary: one line
stage: pre-push          # manual | pre-commit | pre-push
match:
  paths: [regex]         # runs when a changed path matches any of these
requires:
  - type: command        # or: tcp (host + port)
    command: flutter
    hint: shown when the requirement is not met
steps:
  - name: display name
    run: the shell command
    cwd: .
    env:
      KEY: "value"
```

`stage: manual` is a written procedure for a human or an agent — it never executes, so it
takes a plain list of `steps` and may not declare `match` or `requires`.

Path matching and commands live here, never in `.githooks/`. Adding an acceptance check
for a new area of the app means adding a YAML file, not editing a hook.

## Which base does it compare against?

`@{upstream}`, or `HARNESS_BASE` if set. Deliberately **not** a long-lived integration
branch: those drift by thousands of files, and a gate anchored to a stale ref asks about
the entire backlog rather than about your change. If there is no upstream, it falls back
to the worktree — a smaller honest question rather than a large misleading one.

## Security — this directory executes code

`scenarios[].steps[].run` is arbitrary shell, and the hooks run it **without showing you
the command**. Write access to `harness/scenarios/`, `scripts/harness/`, or
`.githooks/` is therefore equivalent to code execution on the machine of everyone who
has installed the hooks, at their next commit or push.

Consequences, and they are not optional:

- Review a diff to any of those paths the way you would review a hook, not the way you
  would review a config file.
- Only `harness-check.mjs` (read-only) is auto-approved in the committed
  `.claude/settings.json`. Running scenarios for real, and writing any of these files,
  stays a prompt.
- All three paths are `structural_paths` in `workflow.yaml`, so a change to the
  harness's own attack surface cannot land without an exec-plan explaining it.

`contracts/*.yaml` is declarative and executes nothing — it is the safe half, and the
half you should be editing often.

## YAML subset

Block maps, block sequences, and scalars (plain, `'single'`, `"double"`). Flow style
(`[a, b]`), block scalars (`|`, `>`), anchors, and multi-document files **throw** rather
than parse partially. `git -c core.quotePath=false` is used everywhere: without it git
escapes non-ASCII paths as octal, and in a repo with Japanese file or branch names every
path pattern silently stops matching — a failure that fails OPEN.
