# MODULE_SPEC: audit

> Written from actual source inspection. See template at `docs/quality/MODULE_SPEC_TEMPLATE.md`.

## 1. Purpose
Compliance logging module. Records every significant action taken in the system — data access, mutations, authentication events, and administrative operations — into an immutable append-only audit log. Provides log querying for administrators and compliance officers, and enforces GDPR-style retention + scheduled purge of aged-out records.

## 2. Bounded Context
**In scope**: Writing audit events, reading/querying the audit log, archiving old entries, purging expired archives, retention-compliance reporting.

**Out of scope**: Domain-event side effects (those belong to `core/domain-event-consumers.ts`), per-handler audit emission (declared via `@extension("x-audit", ...)` on TypeSpec operations, not hand-coded here).

**Adjacent modules**: Every other module *writes* to audit via the generated middleware (`core/audit/audit-action.ts`). Hand-wired routes in `app.ts` call `auditAction()` directly. The `audit` module itself owns the repository and read surface only.

## 3. Handler Inventory
| Handler file | Verb + Path | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `listAuditLogs.ts` | `GET /audit/logs` | bearerAuth, roles: `["admin", "compliance"]` | self-auditing — logs own access as `data-access/administrative/read` | Paginated, filterable by eventType, category, action, outcome, user, resourceType, date range |

**Background jobs** (not HTTP handlers):
| Job file | Trigger | Purpose |
|---|---|---|
| `jobs/index.ts` (`registerAuditJobs`) | Cron | Archives logs older than 365 days; purges archives older than 2555 days (7 years) |
| `repos/retention-compliance.ts` | Called by job | Computes retention compliance report |

## 4. TypeSpec source
`specs/api/src/modules/audit.tsp` — defines `AuditEventType`, `AuditCategory`, `AuditAction` enums and the `listAuditLogs` operation.

Supplementary documentation: `specs/api/src/modules/audit.md`.

## 5. Database schema
`services/api-ts/src/handlers/audit/repos/` — no `*.schema.ts` found in this directory; schema is consumed from the audit repository class (`AuditRepository`) which extends `DatabaseRepository<AuditLogEntry, NewAuditLogEntry, AuditLogFilters>`. Schema definition likely lives in `core/database.schema.ts` or is a shared table.

> **Note**: Verify schema location — `repos/` directory contains only `audit.repo.ts` and `retention-compliance.ts`.

## 6. Cross-module dependencies
- **Emits domain events**: none — audit is a passive sink.
- **Consumes events from**: none — receives direct calls.
- **Inbound callers**:
  - Generated middleware (`core/audit/audit-action.ts`) — called by every TypeSpec-generated route that has `@extension("x-audit", ...)`.
  - `app.ts` — hand-wired routes call `auditAction()` directly (e.g. Stripe webhook, auth routes).
  - `createAuth()` in `app.ts` — passes `auditRepo` into Better-Auth integration for auth events.

## 7. Test coverage status
- Unit tests: 2 test files — `listAuditLogs.test.ts` (14 assertions), `retention-compliance.test.ts` (18 assertions). **1/1 handlers** covered (100%).
- Contract scenarios: `specs/api/tests/contract/audit.hurl` + `audit-side-effects.hurl` — 2 Hurl files.
- E2E: **0** specs (no `apps/memberry/tests/e2e/audit*` found).

## 8. Hand-wired routes (if any)
The `/audit/*` prefix is auth-gated in `app.ts` (line 454). The `AuditRepository` and `createAuditService` are initialized in `app.ts` and injected into the app context — not a route registration, but the service wiring is hand-coded. No audit-specific HTTP routes are hand-wired (TypeSpec-generated routes handle `/audit/logs`).

See `docs/quality/HAND_WIRED_ROUTES.yaml` — `audit` does not appear as a hand-wired route entry.

## 9. Known gotchas
- **Self-auditing**: `listAuditLogs` writes its own audit event on every successful call. Pagination + filter params are logged in `details`. This means audit log reads appear in the audit log.
- **Role requirement**: `["admin", "compliance"]` — a standard `user` role is denied. Verify that org officers do not need read access (if so, role list needs expanding in TypeSpec).
- **Retention arithmetic**: Archive threshold = 365 days; purge threshold = 2555 days (~7 years). Both are hardcoded in the job, not configurable per-org.
- **Schema location**: `AuditRepository` extends a generic base — the underlying table DDL should be traced to confirm it is not inside `generated/migrations`.

## 10. AI extension checklist

To add a new endpoint to this module:
1. `specs/api/src/modules/audit.tsp` — declare operation + `@extension("x-audit", ...)` if needed
2. `services/api-ts/src/handlers/audit/<verbResource>.ts` — handler impl
3. `services/api-ts/src/handlers/audit/<verbResource>.test.ts` — unit test
4. `specs/api/tests/contract/<new-file>.hurl` — contract scenario
5. Run: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`
6. Frontend hook auto-generated; no manual SDK edits

Forbidden:
- Editing `services/api-ts/src/generated/**`
- Adding to `app.ts` unless reason fits `HAND_WIRED_ROUTES.yaml` allowed-reason set
- Verb prefixes `new*`/`make*`/`do*`/`process*`
- Hand-calling `auditAction()` in new TypeSpec-generated handlers (declare via `@extension` instead)
