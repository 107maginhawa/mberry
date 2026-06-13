# ADR-0002: Hand-wired route allowlist

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

ADR-0001 establishes TypeSpec as the source of truth for all routes. In practice, a small set of routes cannot be cleanly expressed through the TypeSpec → generated-router pipeline:

1. **Middleware-ordering routes** — Stripe webhook and public payment token must be registered before the auth middleware fires. The TypeSpec generator applies auth globally and provides no escape hatch for selective pre-auth registration.
2. **Public-unauth routes** — Social-crawler og:meta endpoints, public credential/certificate lookup, and public org discovery serve anonymous traffic by design and must sit outside the auth boundary.
3. **Legacy-deferred routes** — Support ticket SLA, officer transition checklists, and other routes whose TypeSpec migration was explicitly deferred to a later wave (link: ROADMAP §"TypeSpec Migration Backlog").
4. **PII custom-auth routes** — Handlers with runtime-branching authorization (e.g. self-vs-officer access) that cannot be expressed as a static `@extension` on the TypeSpec operation.
5. **Public-webhook routes** — Third-party callbacks that verify their own signature and must bypass CSRF and auth middleware.

Without a governance mechanism, hand-wired routes accumulate silently. Developers add a route to `app.ts` for a quick fix, it never gets migrated, and the set of non-TypeSpec routes grows unbounded.

The solution adopted is a checked YAML allowlist (`docs/quality/HAND_WIRED_ROUTES.yaml`) plus a CI script (`scripts/check-hand-wired-routes.ts`) that diffs the allowlist against the actual routes registered in `app.ts`. Any route in `app.ts` that is not in the allowlist fails CI.

Source: `docs/quality/HAND_WIRED_ROUTES.yaml`, `CLAUDE.md` §"API-First Development", ROADMAP §"TypeSpec Migration Backlog", commit `13e2db66`.

## Decision

Hand-wired routes are permitted only when they fall into one of five explicitly named categories: `middleware-ordering`, `public-unauth`, `legacy-deferred`, `pii-custom-auth`, `public-webhook`. All permitted hand-wired routes must be declared in `docs/quality/HAND_WIRED_ROUTES.yaml` with `reason`, `owner`, and `note` fields. The CI script `check-hand-wired-routes` enforces this as a hard gate.

## Consequences

### Positive
- The set of non-TypeSpec routes is finite, visible, and auditable.
- CI blocks undeclared additions immediately — no silent drift.
- Each allowlisted route carries an owner and migration-intent note.

### Negative / tradeoffs
- Developers adding a genuinely new hand-wired route must update the YAML, which adds a step to the workflow.
- The CI script must be kept in sync as `app.ts` route registration syntax evolves.

### Neutral
- As deferred routes are migrated to TypeSpec, entries are removed from the allowlist. The allowlist is expected to shrink over time, not grow.

## Alternatives considered

- **No governance; trust code review** — rejected because code review has historically missed hand-wired route accumulation.
- **Ban hand-wired routes entirely** — rejected because middleware-ordering and public-unauth routes have legitimate requirements that the TypeSpec generator cannot satisfy.

## References

- `docs/quality/HAND_WIRED_ROUTES.yaml` — the allowlist (52 routes as of Wave 6)
- `scripts/check-hand-wired-routes.ts` — CI diff script
- `services/api-ts/src/app.ts` — `@hand-wired reason=...` annotations
- ROADMAP §"TypeSpec Migration Backlog — By Design (9 routes)"
- Commit `13e2db66` — "lint(routes): formalize hand-wired allowlist + diff check"
