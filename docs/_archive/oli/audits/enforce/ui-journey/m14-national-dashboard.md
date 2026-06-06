# UI Journey Audit: M14 National Dashboard

**Module:** m14-national-dashboard
**Audit Date:** 2026-05-27
**Auditor:** oli-ui-journey
**App:** admin (apps/admin)
**Status:** PARTIAL IMPLEMENTATION — 1 of 3 workflows functional, 4 of 5 API contracts missing

---

## R1: Route & Navigation Registry

| ID | Route | File | Nav Entry | Role Gate | Status |
|----|-------|------|-----------|-----------|--------|
| J-M14-001 | `/national-dashboard` | `apps/admin/src/routes/national-dashboard/index.tsx` | Sidebar > Operations > "National Dashboard" (BarChart3 icon) | `RequireRole(['super','support','analyst'])` | IMPLEMENTED |
| J-M14-002 | `/admin/national/[assocId]/orgs/[orgId]` (chapter drill-down) | -- | -- | -- | MISSING — spec screen S2 not built |
| J-M14-003 | `/associations/$associationId` (embedded dashboard KPIs) | `apps/admin/src/routes/associations/$associationId.tsx` | Via association detail page | Inherits association route gate | IMPLEMENTED (partial embed) |

**Nav wiring:** Sidebar entry exists in `__root.tsx` navSections under "Operations". ROUTE_ROLES entry exists at `/national-dashboard` for `['super','support','analyst']`.

### Findings

- **J-M14-004** [P1-BLOCKER] Role mismatch between spec and implementation. Spec (MODULE_SPEC S6) says "National officers, Platform Admin" can view; ROLE_PERMISSION_MATRIX says `president` role. Frontend gates to `['super','support','analyst']` which are admin-app platform roles. Since this is admin-only, national officers cannot access this page at all — the entire module's primary persona (national officer) is locked out. The backend handler correctly checks `isDesignatedNationalOfficer()` but the frontend is admin-app-only with no national officer access path.
- **J-M14-005** [P2] Spec defines route as `/admin/national`; implementation uses `/national-dashboard`. URL mismatch with API_CONTRACTS.md.

---

## R2: Action Registry (Interactive Elements)

| ID | Element | Type | Handler | Outcome | Status |
|----|---------|------|---------|---------|--------|
| J-M14-010 | Association selector (Select) | dropdown | `setSelectedAssociation()` state | Triggers dashboard re-fetch | WORKS |
| J-M14-011 | Snapshot month selector (Select) | dropdown | `setSnapshotMonth()` state | Triggers dashboard re-fetch | WORKS |
| J-M14-012 | Chapter comparison table | read-only table | useQuery fetch | Displays chapter rows | WORKS |
| J-M14-013 | Chapter row click (drill-down) | -- | -- | -- | MISSING — no click handler, no drill-down route |
| J-M14-014 | Export button (CSV/PDF) | -- | -- | -- | MISSING — WF-086 not implemented |
| J-M14-015 | "View National Dashboard" link (on association detail) | Link | `to="/national-dashboard"` | Navigates to dashboard | WORKS |
| J-M14-016 | Trend charts (monthly/quarterly) | -- | -- | -- | MISSING — WF-084 step 3 not implemented |
| J-M14-017 | Configure dashboard access (PA) | -- | -- | -- | MISSING — no admin UI to grant national officer access |

### Findings

- **J-M14-018** [P1-BLOCKER] No export functionality exists. WF-086 (National Data Export) is a P1 workflow — spec requires CSV/PDF export with format selection, date range, and audit logging. Zero UI elements for this. Backend has `dashboardExportLogs` schema table but no export endpoint or handler.
- **J-M14-019** [P1-BLOCKER] No chapter drill-down. WF-085 is P0 — clicking a chapter row should load chapter-specific metrics (member count, status breakdown, collection rate, credit compliance, recent events). Table rows are not clickable, no drill-down route exists.
- **J-M14-020** [P2] No trend visualization. WF-084 step 3 specifies "Officer views trend charts (monthly/quarterly)". Only a single-month snapshot is shown; no historical trend is rendered.
- **J-M14-021** [P2] No access configuration UI. Platform admins cannot grant/revoke national officer dashboard access from the frontend despite `nationalDashboardAccess` table existing in the schema and `grantAccess()`/`revokeAccess()` methods in `dashboard.repo.ts`.

---

## R3: Data Flow Registry (API Calls)

| ID | Trigger | Endpoint Called | Method | SDK Used | Response Handling | Status |
|----|---------|----------------|--------|----------|-------------------|--------|
| J-M14-030 | Page load | `listAssociationsOptions()` | GET | SDK generated hook | Populates association dropdown | WORKS |
| J-M14-031 | Association + month selected | `fetch('/api/admin/national-dashboard/${assocId}?snapshotMonth=...')` | GET | Raw fetch (not SDK) | Populates aggregate + chapter table | WORKS but not spec-aligned |
| J-M14-032 | -- | `GET /admin/national/summary` | -- | -- | -- | NOT IMPLEMENTED — API contract 2.1 |
| J-M14-033 | -- | `GET /admin/national/chapters` | -- | -- | -- | NOT IMPLEMENTED — API contract 2.2 |
| J-M14-034 | -- | `GET /admin/national/chapters/{orgId}` | -- | -- | -- | NOT IMPLEMENTED — API contract 2.3 |
| J-M14-035 | -- | `GET /admin/national/export` | -- | -- | -- | NOT IMPLEMENTED — API contract 2.4 |
| J-M14-036 | -- | `GET /admin/national/platform` | -- | -- | -- | NOT IMPLEMENTED — API contract 2.5 |

### Findings

- **J-M14-037** [P1-BLOCKER] API contract mismatch. API_CONTRACTS.md defines 5 endpoints under `/admin/national/*`. Backend implements 1 endpoint at `/admin/national-dashboard/:associationId`. Frontend calls `/api/admin/national-dashboard/${assocId}`. None of the 5 spec'd endpoints exist.
- **J-M14-038** [P2] Raw `fetch()` used instead of SDK-generated hooks. The dashboard query uses manual `fetch()` with string interpolation, bypassing the `@monobase/sdk-ts` generated hooks. This means no automatic cache invalidation, no type safety from OpenAPI, and inconsistent error handling.
- **J-M14-039** [P2] No platform-wide summary endpoint. API contract 2.5 (`GET /admin/national/platform`) would let platform admins see all associations; currently the page only shows one association at a time.

---

## R4: Journey Completion Registry (Workflow Coverage)

| WF-ID | Workflow | Spec Priority | Steps Implemented | Steps Missing | Completion |
|-------|----------|---------------|-------------------|---------------|------------|
| WF-084 | Review Association Health | P0 | Steps 1-2 (navigate, load KPIs) | Steps 3-5 (trends, side-by-side compare, identify underperformers) | 40% |
| WF-085 | Chapter Drill-Down | P0 | None | All steps (click chapter, load metrics, review, export) | 0% |
| WF-086 | National Data Export | P1 | None | All steps (click Export, select format/range, generate, download) | 0% |
| -- | Configure Dashboard Access | P0 | None | All (PA grants/revokes national officer access) | 0% |
| -- | Review All Associations | P0 | None | Platform admin cross-association analytics | 0% |

### Findings

- **J-M14-040** [P0-BLOCKER] 3 of 5 specified workflows are completely unimplemented (0%). The two P0 workflows (WF-085 Chapter Drill-Down, Configure Dashboard Access) have zero frontend coverage.
- **J-M14-041** [P1] WF-084 only covers initial page load (steps 1-2). The workflow specifies trend charts, side-by-side chapter comparison, and underperformer identification — none implemented.

---

## R5: Error & Edge Case Registry

| ID | Scenario | Spec Requirement | Implementation | Status |
|----|----------|------------------|----------------|--------|
| J-M14-050 | No data available | Empty state with explanation | Shows loading skeleton, then empty table | PARTIAL — no explanation text |
| J-M14-051 | API fetch fails | Error toast with retry | `dashError` state renders inline error message | PARTIAL — no retry button |
| J-M14-052 | No associations available | -- | Association dropdown shows empty | WORKS (graceful) |
| J-M14-053 | Small chapters (<5 members) | Suppressed into "Small chapters" combined | Backend `anonymizeSmallChapters()` handles this | WORKS (backend) |
| J-M14-054 | Export fails | Error toast with retry (WF-086) | -- | MISSING — no export UI |
| J-M14-055 | Large dataset async export | Async generation + notification | -- | MISSING — no export UI |
| J-M14-056 | Unauthorized access | 403 → access denied | Backend returns 403; frontend shows RequireRole gate | PARTIAL — admin roles only, not national officer path |

### Findings

- **J-M14-057** [P2] No retry mechanism on data fetch failure. Spec edge case requires retry capability; frontend shows error text but no retry button.
- **J-M14-058** [P2] Empty state lacks explanation. When no chapter data exists for selected month, table shows no rows but provides no guidance message (e.g., "No snapshot data for this month").

---

## R6: Dead Interaction & Orphan Registry

| ID | Element | Issue | Severity |
|----|---------|-------|----------|
| J-M14-060 | `ChevronDown` icon import | Imported from lucide-react but never used in JSX | P3-CLEANUP |
| J-M14-061 | `dashboardExportLogs` schema table | Schema exists, repo has `createExportLog()`, but no handler or UI triggers it | P1-ORPHAN |
| J-M14-062 | `nationalDashboardAccess` table + `grantAccess()`/`revokeAccess()` repo methods | Schema + repo exist but no admin UI or endpoint to manage access | P1-ORPHAN |
| J-M14-063 | `NationalDashboardSnapshot` (spec entity) | Spec defines computed view entity; implementation uses `chapterSnapshots` table (correct approach but naming diverges) | P3-INFO |
| J-M14-064 | Association detail "View National Dashboard" link | Links to `/national-dashboard` without passing `associationId` — user must re-select association from dropdown | P2-UX |

---

## Summary

### Health Score: 2/10

### Blocker Count: 4 P0/P1 blockers

### By Severity

| Severity | Count | IDs |
|----------|-------|-----|
| P0-BLOCKER | 1 | J-M14-040 (3/5 workflows at 0%) |
| P1-BLOCKER | 3 | J-M14-018 (no export), J-M14-019 (no drill-down), J-M14-037 (API contract mismatch) |
| P1-ORPHAN | 2 | J-M14-061 (export log orphan), J-M14-062 (access grant orphan) |
| P2 | 7 | J-M14-005, J-M14-020, J-M14-021, J-M14-038, J-M14-039, J-M14-057, J-M14-058 |
| P2-UX | 1 | J-M14-064 |
| P3 | 2 | J-M14-060, J-M14-063 |

### What Exists (working)

1. Single route at `/national-dashboard` with sidebar nav entry
2. Association selector + month selector dropdowns
3. Aggregate KPI cards (total members, collection rate, CPD compliance, activity count)
4. Chapter comparison table (read-only, flat)
5. Backend handler with BR-36 access control + small-chapter anonymization
6. DB schema for snapshots, access grants, export logs
7. Backend tests (ac-m14, br-36) with pure domain logic coverage
8. Association detail page embeds dashboard KPI preview with "View National Dashboard" link

### What's Missing (critical gaps)

1. **Chapter drill-down** (WF-085, P0) — no clickable rows, no drill-down route, no API endpoint
2. **Data export** (WF-086, P1) — no export button, no format picker, no download handler, no backend endpoint
3. **4 of 5 API contract endpoints** not implemented (summary, chapters list, chapter detail, export, platform)
4. **Access configuration UI** — platform admin cannot grant national officer access from frontend
5. **Trend visualization** — no charts, no historical data comparison
6. **Platform-wide view** — platform admin sees same single-association view as everyone else
7. **National officer access path** — primary persona has no way to reach this page (admin-app only)

### Architectural Note

The module is split across two locations:
- **Frontend:** `apps/admin/src/routes/national-dashboard/index.tsx` (1 file)
- **Backend:** `services/api-ts/src/handlers/platformadmin/` (handler, repo, schema, 2 test files)
- **Embedded:** `apps/admin/src/routes/associations/$associationId.tsx` (KPI preview)

The backend has significantly more maturity than the frontend. Schema covers all three tables (snapshots, access grants, export logs). Repo covers all CRUD operations. Tests cover BR-36 and AC-M14-001 through AC-M14-005 as pure domain logic. But the frontend only surfaces ~20% of what the backend supports.
