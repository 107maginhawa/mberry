# File Enforcement: National Dashboard (M14)

> Generated: 2026-05-28
> Source: `services/api-ts/src/handlers/association:operations/` (69 handlers) + `services/api-ts/src/handlers/platformadmin/` (M14 assets)
> Spec: `docs/product/modules/m14-national-dashboard/MODULE_SPEC.md` v2.0

## Scope Note

M14 (National Dashboard) is mapped to `handlers/association:operations/` (69 handler files + 22 test files + 8 repo files = 100 total). However, the actual M14 implementation is split across two directories:

1. **`association:operations/exportNationalDashboard.ts`** -- export handler (1 file)
2. **`platformadmin/getNationalDashboard.ts`** -- main dashboard handler (1 file)
3. **`platformadmin/repos/dashboard.repo.ts`** -- repository with aggregation logic
4. **`platformadmin/repos/dashboard-snapshot.schema.ts`** -- schema (3 tables)
5. **`platformadmin/ac-m14.national-dashboard.test.ts`** -- AC tests
6. **`platformadmin/br-36.national-dashboard.test.ts`** -- BR-36 tests
7. **`association:operations/exportNationalDashboard.test.ts`** -- export tests

The remaining 67 handler files in `association:operations/` belong to other modules (M08 Events, M09 Training, M19 Committees, M10 Credits) and are **not M14-relevant**. This enforcement report covers only M14-relevant files.

## Findings

| ID | Sev | Category | Finding | File | Spec Source | Confidence |
|----|-----|----------|---------|------|-------------|------------|
| EF-M14-71a3f8e2 | INFO | IMPL-PRESENT | `getNationalDashboard` handler implements spec API `GET /admin/national/summary` (registered as `GET /admin/national-dashboard/:associationId`). Implements BR-36 access control, M14-R2 small chapter anonymization, cross-chapter aggregation, and audit logging. Route path differs from spec (`/admin/national-dashboard/:associationId` vs `/admin/national/:assocId`) but functionally equivalent. | `platformadmin/getNationalDashboard.ts` | S10 row 1, S5 BR-36/M14-R2 | 95% |
| EF-M14-82b4c9f3 | INFO | IMPL-PRESENT | `exportNationalDashboard` handler implements spec API `GET /admin/national/export` (registered as `POST /admin/national-dashboard/:associationId/export`). Supports CSV and JSON export with BR-36 access control and audit logging. HTTP method differs (POST vs spec GET). No PDF support. | `association:operations/exportNationalDashboard.ts` | S10 row 4 | 90% |
| EF-M14-93c5daf4 | INFO | IMPL-PRESENT | Dashboard schema implements `chapter_snapshot`, `national_dashboard_access`, `dashboard_export_log` tables. Schema fields align with spec S7 NationalDashboardSnapshot entity (associationId, totalMembers, activeMembers, collectionRate, creditCompliance, totalRevenue as totalCollected, eventCount as activityCount90d, snapshotDate as snapshotMonth). | `platformadmin/repos/dashboard-snapshot.schema.ts` | S7 | 90% |
| EF-M14-a4d6ebf5 | INFO | IMPL-PRESENT | Repository implements `listChapterSnapshots`, `getAssociationAggregate`, `isDesignatedNationalOfficer`, `grantNationalAccess`, `revokeNationalAccess`, `createExportLog`. Covers spec S10 data needs and S6 permissions. | `platformadmin/repos/dashboard.repo.ts` | S10, S6 | 90% |
| EF-M14-b5e7fc06 | P1 | MISSING-ENDPOINT | No handler for `GET /admin/national/chapters` (spec S10 row 2). Spec requires paginated chapter comparison list with sorting by totalMembers, collectionRate, etc. Currently `getNationalDashboard` returns chapters inline but without pagination or sort params. | MISSING | S10 row 2 | 95% |
| EF-M14-c6f80d17 | P1 | MISSING-ENDPOINT | No handler for `GET /admin/national/chapters/{orgId}` chapter drill-down (spec S10 row 3). Spec requires detailed chapter metrics including membership breakdown, collection rate trend, credit compliance, and recent events. WF-085 unimplemented. | MISSING | S10 row 3, WF-085 | 99% |
| EF-M14-d7091e28 | P1 | MISSING-ENDPOINT | No handler for `GET /admin/national/platform` (spec S10 row 5). Spec requires platform-wide summary across all associations, restricted to platform admin. AC-M14-004 unverifiable. | MISSING | S10 row 5, AC-M14-004 | 99% |
| EF-M14-e8102f39 | P2 | ROUTE-MISMATCH | Export handler registered as `POST /admin/national-dashboard/:associationId/export` but spec says `GET /admin/national/export`. Two mismatches: HTTP method (POST vs GET) and path structure. POST is arguably more correct for export generation but deviates from spec. | `app.ts:450` | S10 row 4 | 95% |
| EF-M14-f9213a4a | P2 | ROUTE-MISMATCH | Main dashboard handler registered at `GET /admin/national-dashboard/:associationId` via generated OpenAPI routes. Spec says `GET /admin/national/summary`. Path pattern differs but serves same purpose. OpenAPI takes precedence since it is the spec-first source of truth. | `generated/openapi/routes.ts:169` | S10 row 1 | 85% |
| EF-M14-0a324b5b | P2 | MISSING-FORMAT | Export handler supports CSV and JSON but spec requires CSV and PDF. No PDF generation implemented. Spec S14 lists "PDF generation library" as external dependency. Feature flag `national_dashboard_export` not checked in handler. | `association:operations/exportNationalDashboard.ts:72` | S10 row 4, S14, S18 | 95% |
| EF-M14-1b435c6c | P2 | MISSING-FEATURE | No consumed event handlers for `MembershipApproved`, `MembershipSuspended`, `DuesPaymentCompleted`, `CreditEntryCreated`, `EventCreated` (spec S10b). Snapshot data appears to be populated by external mechanism but no event-driven refresh exists in codebase. | MISSING | S10b Consumed Events | 90% |
| EF-M14-2c546d7d | P2 | MISSING-FEATURE | No feature flag checks in any handler. Spec S18 defines three flags: `national_dashboard_enabled`, `national_dashboard_export`, `national_dashboard_platform_view`. None are evaluated at runtime. | `platformadmin/getNationalDashboard.ts`, `association:operations/exportNationalDashboard.ts` | S18 | 95% |
| EF-M14-3d657e8e | P3 | MISSING-OBSERVABILITY | Spec S17 defines 5 log events and 4 metrics. Handler logs `dashboard.viewed` via audit but not as structured observability event. Missing: `dashboard.drilldown`, `dashboard.stale`, `dashboard.access_denied` log events. No Prometheus-style metrics emitted. | `platformadmin/getNationalDashboard.ts` | S17 | 85% |
| EF-M14-4e768f9f | P3 | MISSING-EDGE-CASE | No stale data indicator when snapshot is > 24h old (spec S13, M14-R3). Handler returns data without checking freshness. Spec requires prominent "Last updated" timestamp and warning banner. | `platformadmin/getNationalDashboard.ts` | S5 M14-R3, S13, S15 | 90% |
| EF-M14-5f879a00 | P3 | MISSING-EDGE-CASE | No pagination for chapter list. Spec S13 notes "Very large association (100+ chapters) -- pagination on chapter list". Current handler returns all chapters in one response (limited to 200 by repo). | `platformadmin/getNationalDashboard.ts:100` | S13 | 80% |
| EF-M14-60980b11 | P3 | CROSS-MODULE-LOCATION | M14 implementation is split across `association:operations/` and `platformadmin/`. The primary handler (`getNationalDashboard.ts`), repo, and schema live in `platformadmin/` while the export handler lives in `association:operations/`. This creates a module cohesion problem -- all M14 code should be collocated. | Multiple | S20 AI Instructions | 75% |
| EF-M14-71a91c22 | INFO | MAPPING-NOTE | 67 of 69 handler files in `association:operations/` are NOT M14-related. They implement CRUD for: events (15 files), training (14 files), courses (8 files), committees (7 files), enrollments (6 files), check-ins (4 files), registrations (4 files), waitlist (2 files), quiz (2 files), accredited providers (3 files), custom training (2 files). These belong to M08, M09, M10, M19. | `association:operations/*.ts` | N/A | 99% |

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| P1 | 3 | Missing endpoints: chapters list, chapter drill-down, platform-wide view |
| P2 | 4 | Route mismatches, missing PDF export, no event handlers, no feature flags |
| P3 | 3 | Missing observability, stale data check, pagination |
| INFO | 5 | Present implementations, mapping notes |
| **Total** | **15** | |

## Implemented vs Spec Coverage

| Spec API Endpoint | Status | Handler Location |
|-------------------|--------|-----------------|
| GET /admin/national/summary | PARTIAL | `platformadmin/getNationalDashboard.ts` (path differs) |
| GET /admin/national/chapters | MISSING | -- |
| GET /admin/national/chapters/{orgId} | MISSING | -- |
| GET /admin/national/export | PARTIAL | `association:operations/exportNationalDashboard.ts` (method + path differ, no PDF) |
| GET /admin/national/platform | MISSING | -- |

## Spec Coverage by Section

| Spec Section | Coverage | Notes |
|-------------|----------|-------|
| S5 Business Rules | BR-36 implemented, M14-R1 partial, M14-R2 implemented, M14-R3 missing, M14-R4 implemented | |
| S6 Permissions | National officer + platform admin guards present; configure access present via repo | |
| S7 Data Requirements | Schema aligns; field names differ but semantically equivalent | |
| S10 API Expectations | 2/5 endpoints implemented (partial) | |
| S10b Domain Events | 0/5 consumed event handlers implemented | |
| S11 Acceptance Criteria | AC-001 partial (no chapter comparison), AC-002 yes, AC-003 partial (no PDF), AC-004 missing, AC-005 yes | |
| S17 Observability | 1/5 log events, 0/4 metrics | |
| S18 Feature Flags | 0/3 flags checked | |

## Module-Code Mapping Assessment

The previous assessment that `association:operations/` is a mapping error remains **partially valid**. While M14 now has real implementation (2 handlers, 1 repo, 1 schema, 3 test files), the code is split across two directories (`platformadmin/` and `association:operations/`) rather than having its own dedicated directory. The bulk of `association:operations/` (67/69 handlers) serves M08/M09/M10/M19, not M14.

**Recommendation:** Consolidate all M14 code into a single directory (either `handlers/national-dashboard/` or keep in `platformadmin/`). Implement the 3 missing P1 endpoints before GA.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
