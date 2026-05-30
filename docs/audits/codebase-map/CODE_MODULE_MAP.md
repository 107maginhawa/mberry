---
oli-version: "1.0"
last-modified: 2026-05-30T12:00:00.000Z
last-modified-by: oli-codebase-map
---

# Code Module Map

<!-- oli:regen:module-table:begin -->
| Module | Framework | Files | Has Spec | Source Path |
|---|---|---|---|---|
| app-memberry | react | 445 | yes | apps/memberry |
| association:member | hono | 343 | yes | services/api-ts/src/handlers/association:member |
| api-core | hono | 144 | no | services/api-ts/src |
| association:operations | hono | 105 | no | services/api-ts/src/handlers/association:operations |
| communication | hono | 97 | yes | services/api-ts/src/handlers/communication |
| platformadmin | hono | 87 | yes | services/api-ts/src/handlers/platformadmin |
| person | hono | 68 | no | services/api-ts/src/handlers/person |
| booking | hono | 61 | yes | services/api-ts/src/handlers/booking |
| app-admin | react | 44 | no | apps/admin |
| membership | hono | 44 | yes | services/api-ts/src/handlers/membership |
| events | hono | 43 | yes | services/api-ts/src/handlers/events |
| email | hono | 41 | yes | services/api-ts/src/handlers/email |
| billing | hono | 41 | yes | services/api-ts/src/handlers/billing |
| documents | hono | 39 | yes | services/api-ts/src/handlers/documents |
| surveys | hono | 35 | yes | services/api-ts/src/handlers/surveys |
| dues | hono | 33 | yes | services/api-ts/src/handlers/dues |
| pkg-ui | react | 31 | no | packages/ui |
| elections | hono | 31 | yes | services/api-ts/src/handlers/elections |
| certificates | hono | 25 | no | services/api-ts/src/handlers/certificates |
| comms | hono | 22 | no | services/api-ts/src/handlers/comms |
| advertising | hono | 18 | yes | services/api-ts/src/handlers/advertising |
| notifs | hono | 17 | no | services/api-ts/src/handlers/notifs |
| pkg-sdk | generic | 17 | no | packages/sdk |
| jobs | hono | 16 | no | services/api-ts/src/handlers/jobs |
| marketplace | hono | 16 | yes | services/api-ts/src/handlers/marketplace |
| storage | hono | 12 | no | services/api-ts/src/handlers/storage |
| invite | hono | 12 | no | services/api-ts/src/handlers/invite |
| reviews | hono | 11 | no | services/api-ts/src/handlers/reviews |
| audit | hono | 8 | no | services/api-ts/src/handlers/audit |
| onboarding | hono | 5 | yes | services/api-ts/src/handlers/onboarding |
| pkg-eslint-config | generic | 3 | no | packages/eslint-config |
| spec-api | generic | 1 | no | specs/api |
<!-- oli:regen:module-table:end -->

## Notable subsystems within `api-core` (post-cycle 4)

- `core/ports/` — Hexagonal port interfaces (GovernancePort, PlatformAdminPort, ImpersonationPort, MembershipPort) consumed by middleware. See ARCHITECTURE.md ADR-001.
- `core/schema-registry.ts` — Audited cross-module schema re-exports for domain-event consumers + cron jobs. ADR-001.
- `core/observability.ts` — OpenTelemetry SDK init + Hono tracing middleware (Wave G4 / S-C4-040). Env-gated.
- `core/pagination.ts` — Pagination convention + unified page-size constants (S-C4-010).
- `middleware/csrf-token.ts` — Double-submit CSRF token middleware (S-C4-041).
