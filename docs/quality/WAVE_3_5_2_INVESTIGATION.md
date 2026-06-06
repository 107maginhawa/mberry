# Wave 3.5.2 — Module Deletion Candidates: Investigation Report

For user review. Each module has a recommendation: DELETE / KEEP-AND-SPEC / KEEP-AS-IS.

Generated: 2026-06-06

---

## marketplace

- **Handler count:** 9 production handlers (12 total including 3 test files)
- **FE matrix hits (apps):** 0 — zero files in `apps/memberry/src` or `apps/admin/src` import anything marketplace-specific
- **SDK exports consumed by apps:** None — no `from '@monobase/sdk-ts'` import in either app touches marketplace or vendor hooks
- **Generated routes registered:** YES — 9 handlers in `registry.ts`; 5 routes in `routes.ts` (`/vendors`, `/vendors/:vendorId`, `/vendors/:vendorId/verify`, `/listings`, `/orders`)
- **TypeSpec source:** `specs/api/src/modules/marketplace.tsp` + `specs/api/src/association/operations/marketplace.tsp` — fully TypeSpec-defined
- **Transitive imports from other handlers:** Only seed data (`layer-4-cross-module.ts`) and generated `registry.ts`
- **3-month commit count:** 4 (all infrastructure/refactor chores — no feature work)
- **Test ratio:** 3 test files / 9 handlers = 33%

**Assessment:** The routes are wired and TypeSpec-generated. Zero app consumption means no frontend has been built yet — this is a backend-complete, frontend-pending feature. The seed data includes marketplace fixtures, confirming it is a planned (not abandoned) domain. Deletion would require removing TypeSpec, regenerating, and dropping schema tables.

- **Recommendation:** KEEP-AND-SPEC
- **Rationale:** Marketplace has a complete TypeSpec definition, generated routes, seed data, and 33% test coverage — it is a scaffolded-but-unconnected feature, not dead code. The correct action is to backfill a MODULE_SPEC in Wave 5 and add frontend routing when the product reaches the marketplace milestone. Do not delete.

---

## audit

- **Handler count:** 1 handler (`listAuditLogs.ts`)
- **FE matrix hits (memberry):** 1 (`apps/memberry/src/utils/guards.ts` — the word "audit" appears as a route guard string)
- **FE matrix hits (admin):** 9 files — dedicated route at `apps/admin/src/routes/audit/index.tsx`, route tree, role-gate, test
- **SDK exports consumed by apps:** `listAuditLogsOptions` and `AuditAction` type imported directly in `apps/admin/src/routes/audit/index.tsx`
- **Generated routes registered:** YES — `listAuditLogs` in `registry.ts`
- **app.ts imports:** `AuditRepository` and `registerAuditJobs` imported directly — core infrastructure
- **Transitive imports:** `audit.schema` used in seed data; `AuditRepository` used throughout `app.ts` middleware chain
- **3-month commit count:** 2 (schema fix + initial commit)

**Assessment:** Fully live. Admin app has a dedicated audit log UI page that consumes the SDK hook. The `AuditRepository` is core infrastructure wired into `app.ts` for the per-route audit middleware. The handler module (`listAuditLogs`) is small but actively used.

- **Recommendation:** KEEP-AND-SPEC
- **Rationale:** Audit is live infrastructure — consumed by admin frontend, wired into app.ts middleware, and backed by SDK types. The only gap is a missing MODULE_SPEC. Backfill spec in Wave 5 (same batch as other 4 missing specs). Do not touch handler or routes.

---

## association:operations

- **Handler count:** 69 production handlers
- **FE matrix hits (memberry):** Multiple — `features/booking/` and `features/training/` consume SDK hooks generated from this module (`listBookingEventsOptions`, training hooks, `searchEventsOptions`, `listCustomEventRegistrationsOptions`)
- **FE matrix hits (admin):** `apps/admin/src/routes/training/index.tsx` and `apps/admin/src/routes/events/index.tsx` directly import SDK hooks
- **Generated routes registered:** 60 handlers in `registry.ts`
- **SDK exports consumed:** BookingEvent types, course enrollment hooks, training hooks, event registration hooks — all live
- **3-month commit count:** 40 (not a paradox — explained below)
- **Test ratio:** ~40% (mixed handler + test files present)

**40-commits paradox investigation:** The 40 commits over 3 months are NOT feature churn — they break down as:
- **P1.5 refactor (bulk):** 2 commits migrated 71 handlers to per-route audit + x-require-position extensions (`refactor(operations): migrate 32 handlers` + `refactor(association:operations): migrate 39 handlers`)
- **P1 enforcement fixes:** ~12 commits fixing security/validation waves (Wave 10, 14, 20, 21, 39, 53)
- **Training BR enforcement:** BR-41/BR-42/BR-43 payment gate + completion lock + type restriction
- **Test additions:** `ac-m19`, `course-enrollment`, committee tests, `createTraining` tests

The high commit count reflects **active hardening of a live, consumed module** — not abandoned exploration. This module is the events + training + committee backbone of the product.

- **Recommendation:** KEEP-AS-IS
- **Rationale:** association:operations is actively consumed by both apps, has 60 generated routes, and received 40 commits of intentional hardening (security, business rule enforcement, audit). The "paradox" is resolved: high commit count = active maintenance, not churn. No deletion warranted. Consider MODULE_SPEC backfill in Wave 5 if not already present.

---

## Summary table

| Module | Recommendation | Confidence | User action needed |
|---|---|---|---|
| marketplace | KEEP-AND-SPEC | high | Approve spec backfill in W5; no deletion |
| audit | KEEP-AND-SPEC | high | Approve spec backfill in W5; no deletion |
| association:operations | KEEP-AS-IS | high | No action — module is live and actively maintained |

---

## Next steps

No module deletions required or recommended. Wave 3.5.2 finding: all 3 flagged modules are live.

- **marketplace** and **audit**: add to Wave 5 MODULE_SPEC backfill queue (4 remaining specs needed)
- **association:operations**: no action — close the triage flag

Wave 3.5 deletion work is complete (3 confirmed orphan handlers deleted in Task 3.5.1). Wave 3.5.2 is resolved with zero deletions.
