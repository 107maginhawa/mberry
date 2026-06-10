# Development Workflow

Memberry uses the superpowers skill chain. There is no command gate;
trust comes from skills and tests, not workflow enforcement.

## Entry points

| When | Use |
|---|---|
| New feature / module | `/superpowers:brainstorming` → `/superpowers:writing-plans` → `/superpowers:subagent-driven-development` |
| Bug or unexpected behavior | `/superpowers:systematic-debugging` |
| About to commit | `/superpowers:verification-before-completion` |
| Many independent tasks | `/superpowers:dispatching-parallel-agents` |
| Before merge | `/superpowers:requesting-code-review` |

## Quality gates (CI-enforced, not workflow-enforced)

- `bun typecheck` per workspace
- `bun test --coverage` ≥ thresholds defined in package config (see Wave 3 wrapper)
- `bun run test:contract` — Hurl green on every PR touching `specs/` or `handlers/`
- `bun run lint:handler-verbs` rejects `new*`/`make*`/`do*`/`process*` in handler scope
- `bun run check:hand-wired-routes` diffs `app.ts` against `docs/quality/HAND_WIRED_ROUTES.yaml`
- `bun run lint:e2e-depth` rejects selector-only specs without `@selector-only-ok: <reason>` exemption
