# docs/

The repo's memory. A conversation is not a record — the next agent, or the next
engineer, only has what is written here.

| Folder | Holds | Lifetime |
|---|---|---|
| `exec-plans/active/` | work in progress: assumptions, scope, what will be verified | until done |
| `exec-plans/completed/` | the same plan with real results and residual risk | permanent |
| `adr/` | one hard-to-reverse decision per file, numbered, with the *why* | permanent, immutable |
| `gotchas/` | a bug that took real debugging: symptom, root cause, fix, avoid-next-time | permanent |
| `design-docs/` | a reusable contract that is not yet a hard decision | until promoted or dropped |

Create from a template rather than by hand:

```bash
node scripts/harness/new-plan.mjs task <slug> --title "..."
node scripts/harness/new-plan.mjs adr <slug> --title "..."     # auto-numbered
node scripts/harness/new-plan.mjs gotcha <slug>
```

Rule of thumb: if you had to *work out* something non-obvious, it belongs here. If it is
already obvious from the code, it does not.
