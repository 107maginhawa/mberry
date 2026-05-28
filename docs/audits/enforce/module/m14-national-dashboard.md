# Module Enforcement: National Dashboard (M14)
**Score:** 5.5/10 — PARTIALLY COMPLIANT
**Source:** `services/api-ts/src/handlers/association:operations/` (54 handlers) + `services/api-ts/src/handlers/platformadmin/` (dashboard handlers)
**Spec:** `docs/product/modules/m14-national-dashboard/MODULE_SPEC.md`
**Run Date:** 2026-05-28

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 3/10 | 0 | 3 | 2 | 0 |
| 2. Workflow Implementation | 5/10 | 0 | 1 | 1 | 0 |
| 3. Domain Term Consistency | 6/10 | 0 | 0 | 2 | 1 |
| 4. State Machine Enforcement | 10/10 | 0 | 0 | 0 | 0 |
| 5. Event Publishing | 2/10 | 0 | 1 | 1 | 0 |
| 6. Auth/Permission Enforcement | 7/10 | 0 | 0 | 2 | 0 |

**State Machine score rationale:** Spec Section 8 explicitly states "No state machines. This module is read-only (reporting/analytics)." Nothing to violate; full compliance.

## Executive Summary

Since last audit (score 1.5/10), significant M14 implementation landed:

**Now exists:**
- `platformadmin/getNationalDashboard.ts` — cross-chapter aggregate handler with BR-36 auth + M14-R2 privacy suppression
- `association:operations/exportNationalDashboard.ts` — CSV/JSON export with audit logging
- `platformadmin/repos/dashboard.repo.ts` — DashboardRepository with `listChapterSnapshots`, `getAssociationAggregate`, `isDesignatedNationalOfficer`, `grantNationalAccess`, `revokeNationalAccess`, `createExportLog`
- `platformadmin/repos/dashboard-snapshot.schema.ts` — 3 tables: `chapter_snapshot`, `national_dashboard_access`, `dashboard_export_log`
- `platformadmin/br-36.national-dashboard.test.ts` — BR-36 domain logic tests (access control, privacy, export audit)
- `platformadmin/ac-m14.national-dashboard.test.ts` — AC-M14-001 through AC-M14-005 pure domain tests
- `apps/admin/src/routes/national-dashboard/index.tsx` — Admin frontend with association selector, KPI cards, chapter table, CSV export
- OpenAPI: `GET /admin/national-dashboard/{associationId}` registered with operationId `getNationalDashboard`

**Still missing:**
- 3 of 5 spec-declared endpoints
- Domain event infrastructure
- Feature flag integration
- Observability hooks
- Snapshot refresh job

## Handler Inventory Analysis

The `association:operations/` directory contains 54 handlers, of which only 1 (`exportNationalDashboard`) is M14-related. The remaining 53 are operational CRUD for events (16), trainings (12), courses (7), enrollments (6), committees (5), check-ins (3), waitlists (2), quiz (1), search (7). These belong to M08/M09/M10/M19, not M14. The spec-declared primary handler (`getNationalDashboard`) lives in `platformadmin/`, not `association:operations/`.

**Module-code mapping is partially incorrect** — M14 logic is split across two handler directories.

## Findings

### Dimension 1: Public API Completeness

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M14-71a3e2f0 | P1 | **Missing endpoint: `GET /admin/national/chapters`** — Spec declares chapter comparison list with sortable columns, cursor pagination, and date filtering. Current `getNationalDashboard` returns chapters inline but lacks dedicated list endpoint with pagination/sort. | N/A (missing) | 95% |
| EM-M14-82b4f3a1 | P1 | **Missing endpoint: `GET /admin/national/chapters/{orgId}`** — Spec declares chapter drill-down with membership breakdown, dues collection, event participation, training compliance as separate detailed view. No handler exists. | N/A (missing) | 99% |
| EM-M14-93c5a4b2 | P1 | **Missing endpoint: `GET /admin/national/platform`** — Spec declares platform-wide cross-association analytics (PA only). No handler or route exists. | N/A (missing) | 99% |
| EM-M14-a4d6b5c3 | P2 | **Route path mismatch** — Spec declares `GET /admin/national/summary` but implemented as `GET /admin/national-dashboard/{associationId}`. Different path structure and semantics (spec separates summary from chapter list; implementation combines them). | `platformadmin/getNationalDashboard.ts` | 90% |
| EM-M14-b5e7c6d4 | P2 | **Export endpoint path/method mismatch** — Spec declares `GET /admin/national/export` but implemented as `POST /association/national-dashboard/{associationId}/export` in `exportNationalDashboard.ts` (uses POST with JSON body instead of GET with query params). Not registered in OpenAPI. | `association:operations/exportNationalDashboard.ts` | 90% |

### Dimension 2: Workflow Implementation

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M14-c6f8d7e5 | P1 | **WF-085 (Chapter Drill-Down) unimplemented** — No dedicated chapter detail handler with cross-module data aggregation (membership breakdown, dues, events, training per chapter). `getNationalDashboard` returns aggregate chapter rows but not the detailed drill-down view described in spec. | N/A (missing) | 95% |
| EM-M14-d7a9e8f6 | P2 | **WF-084 (Review Association Health) partially implemented** — `getNationalDashboard` returns KPIs and chapter comparison, satisfying core flow. Missing: trend charts data (monthly/quarterly), side-by-side comparison endpoint, underperforming chapter identification logic. | `platformadmin/getNationalDashboard.ts` | 85% |

**Implemented workflows:**
- WF-084 core path (dashboard KPIs + chapter metrics) — via `getNationalDashboard`
- WF-086 (National Data Export) — via `exportNationalDashboard` (CSV + JSON formats, audit logged)

### Dimension 3: Domain Term Consistency

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M14-e8b0f9a7 | P2 | **Spec entity name mismatch** — Spec defines "NationalDashboardSnapshot" as computed view entity. Code uses `ChapterSnapshot` (schema table) + `AssociationAggregate` (repo interface). Conceptually equivalent but naming diverges from spec vocabulary. | `platformadmin/repos/dashboard-snapshot.schema.ts`, `platformadmin/repos/dashboard.repo.ts` | 80% |
| EM-M14-f9c1a0b8 | P2 | **"Collection Rate" vs "collectionRate"** — Spec uses "Collection Rate" as formal domain term. Code uses `collectionRate` field in schema and `collectionRatePct` in tests. Consistent within code but test naming adds `Pct` suffix not in spec or schema. | Multiple test files | 70% |
| EM-M14-a0d2b1c9 | P3 | **53 of 54 handlers in `association:operations/` use M08/M09/M10/M19 domain terms** — Event, Training, Course, Committee, Enrollment, Waitlist, CheckIn, Quiz. These are correctly named for their modules but are not M14 domain terms. Module directory mapping overloads operational CRUD with analytics reporting. | `association:operations/*.ts` | 85% |

**Well-aligned terms:** chapterSnapshots, nationalDashboardAccess, dashboardExportLogs, anonymizeSmallChapters, getAssociationAggregate, isDesignatedNationalOfficer.

### Dimension 4: State Machine Enforcement

No findings. Spec declares no state machines (read-only module). No violations.

### Dimension 5: Event Publishing

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M14-b1e3c2d0 | P1 | **`DashboardExported` event not emitted** — Spec Section 10b declares `DashboardExported` with payload `{ associationId, format, exportedBy }`. `exportNationalDashboard` logs to audit table but does not emit a domain event. No event bus integration anywhere in M14 handlers. | `association:operations/exportNationalDashboard.ts` | 95% |
| EM-M14-c2f4d3e1 | P2 | **Consumed events unimplemented** — Spec declares 5 consumed events: `MembershipApproved`, `MembershipSuspended`, `DuesPaymentCompleted`, `CreditEntryCreated`, `EventCreated`. All should trigger `refreshSnapshot`. No event consumer/handler exists. Snapshot data requires manual population. | N/A (missing) | 95% |

### Dimension 6: Auth/Permission Enforcement

| ID | Sev | Finding | File | Confidence |
|----|-----|---------|------|------------|
| EM-M14-d3a5e4f2 | P2 | **Frontend role gate mismatches spec** — Admin frontend uses `RequireRole allowed={['super', 'support', 'analyst']}`. Spec requires "National officers, Platform Admin". Backend correctly implements BR-36 (platform_admin + designated national officer). Frontend allows `support` and `analyst` roles not mentioned in spec. | `apps/admin/src/routes/national-dashboard/index.tsx` | 90% |
| EM-M14-e4b6f5a3 | P2 | **`exportNationalDashboard` auth inconsistency** — Uses `session.user.role === 'platform_admin' || role === 'super'` inline check + `repo.isDesignatedNationalOfficer()`. Same pattern as `getNationalDashboard` but not using a shared auth guard. Duplicated auth logic across two handlers risks drift. | `association:operations/exportNationalDashboard.ts`, `platformadmin/getNationalDashboard.ts` | 80% |

**Well-implemented auth:**
- `getNationalDashboard`: BR-36 access control with `isDesignatedNationalOfficer` DB check, platform admin bypass, proper 403 responses.
- `exportNationalDashboard`: Same pattern, audit logging on every export.

## Spec Coverage Matrix

| Spec Section | Status | Evidence |
|--------------|--------|----------|
| 3. Workflows (WF-084/085/086) | PARTIAL | WF-084 core + WF-086 done; WF-085 missing |
| 5. Business Rules (BR-36, M14-R1/R2/R3) | MOSTLY | BR-36 auth implemented; M14-R1 partial (no platform view); M14-R2 privacy implemented; M14-R3 export timestamp implemented |
| 6. Permissions | MOSTLY | Backend correct; frontend over-permissive |
| 7. Data Requirements | DONE | `chapter_snapshot`, `national_dashboard_access`, `dashboard_export_log` tables match spec fields |
| 8. State Transitions | N/A | Read-only module |
| 9. UI/UX Requirements | PARTIAL | Admin dashboard page exists; drill-down page missing |
| 10. API Expectations | PARTIAL | 2 of 5 endpoints implemented (combined summary+chapters, export) |
| 10b. Domain Events | MISSING | No event emission or consumption |
| 11. Acceptance Criteria | MOSTLY | AC-M14-001 through AC-M14-005 have pure domain tests |
| 16. Performance | UNKNOWN | Snapshot caching exists via table; no hourly refresh job verified |
| 17. Observability | MISSING | No structured log hooks (dashboard.viewed, dashboard.stale, etc.) |
| 18. Feature Flags | MISSING | `national_dashboard_enabled`, `national_benchmarking` flags not wired |

## Test Coverage Assessment

| Test File | Scope | Handlers Covered |
|-----------|-------|-----------------|
| `platformadmin/ac-m14.national-dashboard.test.ts` | AC-M14-001 to AC-M14-005 pure domain | aggregation, access scoping, privacy, export audit, data accuracy |
| `platformadmin/br-36.national-dashboard.test.ts` | BR-36 domain logic | access control, anonymization, export privacy, grant/revoke |
| `association:operations/exportNationalDashboard.test.ts` | Handler integration | CSV export, JSON export, 403 denial, 401 unauthenticated |

**Gaps:** No integration test for `getNationalDashboard` handler (only pure domain tests). No E2E test for admin national dashboard page (only stub spec file exists).

## Priority Remediation

### P0 (none)

### P1 — Must fix for spec compliance
1. **Implement chapter drill-down endpoint** (`GET /admin/national/chapters/{orgId}`) — WF-085, M14-S3
2. **Implement platform admin view endpoint** (`GET /admin/national/platform`) — M14-S6
3. **Implement chapter list endpoint** with pagination/sort or document spec deviation — M14-S2
4. **Wire `DashboardExported` domain event emission** in export handler

### P2 — Should fix
5. Align route paths with spec or document deviation in spec
6. Implement consumed event handlers (snapshot refresh on membership/dues/credit changes)
7. Fix frontend role gate to match spec (remove `support`/`analyst`, add `national_officer`)
8. Extract shared auth guard for national dashboard access (deduplicate from two handlers)
9. Wire feature flags (`national_dashboard_enabled`, `national_benchmarking`)
10. Add observability hooks per spec Section 17

### P3 — Nice to have
11. Align domain term naming (NationalDashboardSnapshot vs ChapterSnapshot)
12. Refactor M14 handlers into single directory (currently split platformadmin + association:operations)
