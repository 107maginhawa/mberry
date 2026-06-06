# ADR-0007: Audit + officer/position checks via TypeSpec @extension

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

Two cross-cutting concerns appear on most protected routes:
1. **Audit logging** — recording that a resource was accessed, created, updated, or deleted, along with the actor, resource type, and event subtype.
2. **Authorization guards** — verifying that the caller holds an active officer term (`requireOfficerTerm`) or a specific position title (`requirePosition`, e.g., President, Treasurer).

The original implementation hand-called `auditAction()`, `requireOfficerTerm()`, and `requirePosition()` at the top of each handler. This had two problems:
- **Inconsistency**: Handler authors could forget to add audit or auth guards, and code review could miss them.
- **Boilerplate drift**: The call signatures were not uniform; audit event shapes varied across handlers.

The solution adopted was to declare these concerns statically on the TypeSpec operation using `@extension` decorators, and have the code generator (`services/api-ts/scripts/generate.ts`) emit the corresponding middleware in `routes.ts` at generation time. The generated middleware chain enforces a fixed order: `auth → position|officer (path mode) → audit → validators → position|officer (body mode) → handler`.

Per-route dynamic fields (resource ID, description, details) are set by the handler via `ctx.set('auditResourceId', ...)` after the fact; the middleware reads them post-handler before composing the audit event.

Source: `CLAUDE.md` §"Audit + officer/position via TypeSpec extensions (P1.5)", commit `9cc394a5`.

## Decision

Audit logging and officer/position authorization for TypeSpec-generated routes are declared as `@extension("x-audit", ...)`, `@extension("x-require-officer", ...)`, and `@extension("x-require-position", ...)` on the TypeSpec operation. The generator reads these extensions and emits middleware. Handlers must not hand-call `auditAction()`, `requireOfficerTerm()`, or `requirePosition()` for generated routes.

The utility functions `requireOfficerTerm` and `requirePosition` remain available in `core/auth/officer-checks.ts` for hand-wired routes or handlers with runtime-branching authorization that cannot be expressed statically.

## Consequences

### Positive
- Audit and authorization coverage is visible in the TypeSpec source — reviewable in a single diff.
- Code generator enforces consistent middleware ordering; handler authors cannot accidentally place audit before auth.
- Adding a new operation automatically inherits the audit/auth pattern if the extension is declared.
- Skips audit on 4xx/5xx responses by design — prevents noise from validation failures.

### Negative / tradeoffs
- Static extensions cannot express conditional authorization (e.g., "officer OR self"). Those routes must use the inline call path and will not benefit from the static visibility advantage.
- Regenerating after a TypeSpec change is required (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`); forgetting to regenerate leaves the middleware stale.

### Neutral
- The legacy `utils/audit.ts` and `utils/officer-check.ts` files are removed. The thin `auditAction()` wrapper now lives at `core/audit/audit-action.ts` for hand-wired routes only.
- 2FA enforcement on privileged positions (President/Treasurer/Secretary) is handled automatically by the generated middleware in production.

## Alternatives considered

- **Hand-call audit/auth in every handler** — rejected because it was the previous state, producing inconsistent coverage and boilerplate drift.
- **Global middleware without per-route configuration** — rejected because audit event shapes (resource type, action, event subtype) are route-specific and cannot be inferred from the HTTP method alone.

## References

- `CLAUDE.md` §"Audit + officer/position via TypeSpec extensions (P1.5)"
- `services/api-ts/scripts/generate.ts` — reads `x-audit`, `x-require-officer`, `x-require-position` from OpenAPI extensions
- `services/api-ts/src/core/audit/audit-action.ts`
- `services/api-ts/src/core/auth/officer-checks.ts`
- `specs/api/src/association/core/communication.tsp` — real-world `@extension` usage examples
- Commit `9cc394a5` — "refactor(handlers): drop 2 unwired-orphan handlers (F5 partial)"
