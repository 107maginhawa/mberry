# Module Specification: National Dashboard (M14)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose

Provide national-level officers and platform administrators with cross-chapter analytics, KPI rollups, and benchmarking. Aggregates membership, financial, credit compliance, and event data across all organizations within an association into actionable dashboards.

### Users

- **National Officer** — Reviews cross-chapter KPIs, drills into chapter metrics, exports reports
- **Platform Administrator** — Views platform-wide analytics across all associations
- **Chapter Officer** — No access (uses org-level reports instead)

### Related Modules

| Module | Relationship |
|--------|-------------|
| M04 (Association Management) | Association structure, chapter hierarchy |
| M05 (Membership) | Membership counts, status distribution |
| M06 (Dues) | Collection rates, revenue summaries |
| M08 (Events) | Event participation metrics |
| M09 (Training) | Training completion rates |
| M10 (Credits) | Credit compliance percentages |

### In Scope

- Cross-chapter membership KPIs (total members, status breakdown, growth trends)
- Financial rollups (dues collection rates, revenue by chapter)
- Credit compliance summaries (% members meeting requirements)
- Chapter comparison and benchmarking
- Chapter drill-down for detailed metrics
- CSV/PDF export of aggregated data
- Dashboard access configuration by platform admin

### Out of Scope

- Real-time streaming analytics
- Predictive modeling / forecasting
- Individual member-level data visibility (privacy constraint)
- Chapter-level dashboards (handled by org-level reports in respective modules)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant organization. National dashboard shows data across all its organizations. |
| **Organization** | Operational unit (chapter) within an association. Unit of comparison. |
| **National Officer** | Officer at the national body level with cross-chapter visibility. |
| **Chapter Drill-Down** | Viewing detailed metrics for a specific chapter within the association. |
| **Platform Administrator** | Memberry employee or super-admin managing the platform itself. |
| **Credit Compliance** | Percentage of members meeting their credit cycle requirements. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Review Association Health | WF-084 | National Officer | Cross-chapter KPIs, trends, comparison | P0 |
| Chapter Drill-Down | WF-085 | National Officer | Specific chapter metrics | P0 |
| National Data Export | WF-086 | National Officer | CSV/PDF export of aggregated data | P1 |
| Configure Dashboard Access | — | Platform Admin | Grant national dashboard access | P0 |
| Review All Associations | — | Platform Admin | Platform-wide analytics | P0 |

## 4. Workflow Details

### Workflow: Review Association Health (WF-084)

- **Actor:** National Officer
- **Preconditions:** Authenticated, national officer role, dashboard access granted
- **Steps:**
  1. National officer navigates to /admin/national
  2. System loads aggregated KPIs: total members, active %, collection rate, compliance %
  3. Officer views trend charts (monthly/quarterly)
  4. Officer compares chapters side-by-side
  5. Officer identifies underperforming chapters
- **Alternate Flows:** Platform admin sees all associations, not just one
- **Exception Flows:** No data available — empty state with explanation
- **Postconditions:** Dashboard view logged

### Workflow: Chapter Drill-Down (WF-085)

- **Actor:** National Officer
- **Preconditions:** Association health dashboard loaded
- **Steps:**
  1. Officer clicks on a specific chapter
  2. System loads chapter-specific metrics: member count, status breakdown, collection rate, credit compliance, recent events
  3. Officer reviews detailed data
  4. Officer can export chapter data
- **Alternate Flows:** Navigate between chapters without returning to summary
- **Exception Flows:** Chapter has no data (newly created) — show empty state
- **Postconditions:** Drill-down view logged

### Workflow: National Data Export (WF-086)

- **Actor:** National Officer, Platform Admin
- **Preconditions:** Dashboard loaded with data
- **Steps:**
  1. Officer clicks "Export"
  2. Selects format (CSV or PDF) and date range
  3. System generates export file
  4. Browser downloads file
- **Alternate Flows:** Large dataset — async generation with notification on completion
- **Exception Flows:** Export fails — error toast with retry
- **Postconditions:** Export event logged for audit

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-36 | IF user is national officer THEN dashboard scoped to own association only | Access | No cross-association visibility |
| M14-R1 | IF user is platform admin THEN dashboard shows all associations | Access | Platform-wide view |
| M14-R2 | IF chapter has < 5 members THEN suppress individual metrics to protect privacy | Privacy | Show aggregate only |
| M14-R3 | IF data is stale (> 24h) THEN show "Last updated" timestamp prominently | Freshness | Snapshot-based, not real-time |
| M14-R4 | IF export requested THEN include only data user has permission to view | Export | Scoped to access level |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View national dashboard | National officers, Platform Admin | Chapter officers, members | GA+OA / PA |
| Export reports | National officers, Platform Admin | All others | — |
| Configure access | Platform Admin | All others | PA only |
| Chapter drill-down | National officers (own association) | All others | Scoped |
| View all associations | Platform Admin | National officers | PA only |

> **Note:** No explicit ROLE_PERMISSION_MATRIX section exists for M14. Permissions derived from PRD, BR-36, and v1 spec. [VERIFY]

## 7. Data Requirements

### Entity: NationalDashboardSnapshot (computed view)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| associationId | Yes | Association FK | Scoping key |
| organizationId | Yes | Chapter FK | Per-chapter metrics |
| totalMembers | Yes | Member count | Computed from membership |
| activeMembers | Yes | Active member count | status = Active |
| collectionRate | Yes | Dues collection % | (paid / expected) * 100 |
| creditCompliance | Yes | Credit compliance % | Members meeting requirement / total |
| totalRevenue | Yes | Revenue amount (cents) | Sum of dues collected |
| eventCount | Yes | Events held | Count in period |
| trainingCount | Yes | Trainings held | Count in period |
| snapshotDate | Yes | Computation date | When data was aggregated |

> **Note:** This is a computed/materialized view, not a persisted entity. No table in DOMAIN_MODEL.md.

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---------------|---------------|--------------------|-----------------| 
| NationalDashboardSnapshot | — | — | Read-only computed view; no mutations; scoped by association |

> **Note:** M14 is a read-only reporting module. It does not own any domain entities — it aggregates data from M04, M05, M06, M08, M09, M10.

## 8. State Transitions

No state machines. This module is read-only (reporting/analytics). All data is computed from source module state.

## 9. UI/UX Requirements

### Screen: National Dashboard Home (/admin/national)

- **Purpose:** Cross-chapter KPI overview
- **Users:** National officers, platform admins
- **Components:** KPI summary cards (total members, active %, collection rate, compliance %), trend charts (line/bar), chapter comparison table, date range selector, export button
- **States:**
  - Loading: Skeleton KPI cards and chart placeholders
  - Empty: "No chapter data available yet"
  - Success: Populated dashboard with charts and tables
  - ValidationError: N/A (read-only)
  - PermissionError: "National officer access required"
  - UnexpectedError: "Unable to load dashboard. Try again."

### Screen: Chapter Drill-Down (/admin/national/[associationId]/orgs/[orgId])

- **Purpose:** Detailed chapter metrics
- **Users:** National officers
- **Components:** Chapter header, member status pie chart, collection rate trend, credit compliance breakdown, recent events list, export button
- **States:**
  - Loading: Skeleton layout
  - Empty: "No data for this chapter yet"
  - Success: Populated chapter detail
  - ValidationError: N/A
  - PermissionError: "You don't have access to this chapter's data"
  - UnexpectedError: "Unable to load chapter data."

## 10. API Expectations

**TypeSpec Coverage:** PARTIAL. `handlers/association:operations/` (69 handlers) has TypeSpec coverage via `specs/api/src/modules/operations.tsp` for cross-chapter analytics and event operations. Dashboard-specific endpoints (national summary, chapter comparison, export) are TypeSpec-covered. Some hand-wired routes remain for middleware ordering.

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /admin/national/summary | Association-level KPIs | associationId, dateRange | Aggregated KPIs | 403 not authorized |
| GET /admin/national/chapters | Chapter comparison list | associationId, sortBy, dateRange | Chapter metrics array | 403 |
| GET /admin/national/chapters/{orgId} | Chapter drill-down | orgId, dateRange | Detailed chapter metrics | 403, 404 |
| GET /admin/national/export | Export data | associationId, format (csv/pdf), dateRange | File download | 403, 422 |
| GET /admin/national/platform | Platform-wide summary | — | All-association overview | 403 PA only |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|------------|---------|---------|-----------|
| DashboardExported | Export generated | { associationId, format, exportedBy } | Audit log |

> **Note:** M14 is primarily a consumer, not a producer of events.

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|------------|-------------|---------|-------------|
| MembershipApproved | M05 | refreshSnapshot | Updates member count metrics |
| MembershipSuspended | M05 | refreshSnapshot | Updates status distribution |
| DuesPaymentCompleted | M06 | refreshSnapshot | Updates collection rate |
| CreditEntryCreated | M10 | refreshSnapshot | Updates compliance metrics |
| EventCreated | M08 | refreshSnapshot | Updates event count |

> **Note:** Consumed events trigger snapshot refresh, not real-time updates. Batch refresh acceptable.

## 11. Acceptance Criteria

### AC-M14-001: Cross-Chapter Aggregation
**Given** a national officer with 3 chapters  
**When** they view the national dashboard  
**Then** the dashboard correctly sums membership counts, collection rates, and credit compliance across all chapters

### AC-M14-002: Access Scoping
**Given** a national officer for Association A  
**When** they access the dashboard  
**Then** they see only Association A's data, not Association B's

### AC-M14-003: Export Accuracy
**Given** a dashboard showing KPI data  
**When** the officer exports to CSV  
**Then** the exported data matches the on-screen dashboard values exactly

### AC-M14-004: Platform Admin View
**Given** a platform admin  
**When** they access the national dashboard  
**Then** they can view and compare data across all associations

### AC-M14-005: Privacy Protection
**Given** a chapter with fewer than 5 members  
**When** displayed in the dashboard  
**Then** individual-level metrics are suppressed, only aggregates shown

## 12. Test Expectations

- **Unit:** Aggregation logic (sum, percentage calculation, rounding), privacy threshold check
- **Integration:** Cross-chapter data aggregation from M05/M06/M10 tables, export file generation
- **Contract:** GET /summary returns correct shape, 403 for non-national-officers, export returns valid CSV
- **E2E:** National officer sees aggregated data matching source modules; export file downloads correctly

## 13. Edge Cases

- Association with only one chapter — dashboard still renders, no comparison
- Chapter with zero members — show 0, not divide-by-zero errors
- Chapter with < 5 members — privacy suppression of individual metrics
- Stale data indicator when snapshot is > 24h old
- National officer's term expires — access revoked immediately
- Concurrent export requests from same user — deduplicate
- Very large association (100+ chapters) — pagination on chapter list
- Currency differences across chapters — normalize to association currency

## 14. Dependencies

### Internal Dependencies

- M04 (Association Management): Association and org hierarchy
- M05 (Membership): Member counts and status
- M06 (Dues): Collection rates and revenue
- M08 (Events): Event participation data
- M09 (Training): Training data
- M10 (Credits): Credit compliance data
- `handlers/association:operations/` (54 existing handlers): Reuse existing analytics infrastructure

### External Dependencies

- PDF generation library for export

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Non-authorized access | 403 Forbidden | "National officer access required" |
| Association not found | 404 Not Found | "Association not found" |
| Chapter not found | 404 Not Found | "Chapter not found" |
| Export generation fails | 500, retry | "Export failed. Please try again." |
| Stale data (> 24h) | Show warning banner | "Data last updated [timestamp]. Refresh in progress." |
| No data available | Empty state | "No data available for the selected period" |

## 16. Performance Expectations

- **Data volume:** Up to 100 chapters per association, 50K members across all chapters
- **Concurrent users:** Up to 50 national officers/admins simultaneously
- **Response times:** Dashboard load < 2s (p95), chapter drill-down < 1s, export < 10s
- **Caching:** Snapshot materialized hourly; dashboard reads from cache, not live queries
- **Export:** CSV streams directly; PDF async for large datasets

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|-------|-------|------|--------|------|
| dashboard.viewed | INFO | Dashboard loaded | associationId, userId, view | No |
| dashboard.drilldown | INFO | Chapter drill-down | associationId, orgId | No |
| dashboard.exported | INFO | Export generated | associationId, format, rows | No |
| dashboard.stale | WARN | Snapshot > 24h old | associationId, lastRefresh | No |
| dashboard.access_denied | WARN | Unauthorized access attempt | userId, route | No |

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| dashboard_views_total | counter | associationId, view | Dashboard page views |
| dashboard_export_total | counter | associationId, format | Exports generated |
| dashboard_snapshot_age_seconds | gauge | associationId | Time since last snapshot refresh |
| dashboard_query_duration_ms | histogram | query_type | Query execution time |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|--------------|
| national_dashboard_enabled | boolean | false | Enable national dashboard module | Post Phase 2 GA |
| national_dashboard_export | boolean | false | Enable CSV/PDF export | Post validation |
| national_dashboard_platform_view | boolean | false | Enable platform-wide view for admins | Post validation |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M14-S1 | Association Summary | GET aggregated KPIs for one association | M04, M05 | P0 |
| M14-S2 | Chapter Comparison | List chapters with comparative metrics | M14-S1, M06 | P0 |
| M14-S3 | Chapter Drill-Down | Detailed metrics for single chapter | M14-S2, M10 | P1 |
| M14-S4 | CSV Export | Export dashboard data as CSV | M14-S1 | P1 |
| M14-S5 | PDF Export | Export dashboard data as PDF | M14-S4 | P2 |
| M14-S6 | Platform Admin View | Cross-association analytics | M14-S1 | P2 |
| M14-S7 | Trend Charts | Time-series visualization | M14-S1 | P2 |

## 20. AI Instructions

When implementing this module:
1. Leverage existing `handlers/association:operations/` (54 handlers) — reuse analytics queries rather than building from scratch.
2. Convert workflows into vertical slice specs. Implement one slice at a time.
3. Dashboard data should be materialized/cached — do not run expensive aggregation queries on every page load.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md (Bun, Hono, Drizzle, TypeSpec-first), CONTRIBUTING.md, and CLAUDE.md.
7. Privacy: suppress individual-level data for chapters with < 5 members (M14-R2).
8. Use cursor-based pagination for chapter list (100+ chapters possible).
9. Export routes should use streaming for CSV and async generation for PDF.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | — |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP WF-084 to WF-086 |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | BR-36 from WORKFLOW_MAP + module-specific rules |
| 6. Permissions | PARTIAL | No explicit ROLE_PERMISSION_MATRIX section for M14 |
| 7. Data Requirements | PARTIAL | Computed view, not persisted entity — no DOMAIN_MODEL table |
| 7b. Aggregate Boundaries | PARTIAL | Read-only module, no domain aggregates |
| 8. State Transitions | COMPLETE | N/A — read-only module |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | PARTIAL | Consumed events derived from cross-module patterns |
| 11. Acceptance Criteria | COMPLETE | — |
| 12. Test Expectations | COMPLETE | — |
| 13. Edge Cases | COMPLETE | — |
| 14. Dependencies | COMPLETE | — |
| 15. Error Handling | COMPLETE | — |
| 16. Performance | COMPLETE | — |
| 17. Observability | COMPLETE | — |
| 18. Feature Flags | COMPLETE | — |
| 19. Vertical Slice Plan | COMPLETE | — |
| 20. AI Instructions | COMPLETE | — |
| 21. Section Completeness | COMPLETE | — |
| 22. Downstream Impact | COMPLETE | — |

## 22. Downstream Impact

- **MODULE_MAP.md:** M14 depends on M04, M05, M06, M08, M09, M10 — verify all listed
- **ROLE_PERMISSION_MATRIX.md:** Missing section 3.x for National Dashboard — needs addition [VERIFY]
- **DOMAIN_MODEL.md:** No dashboard snapshot entity — acceptable as computed view, but document in model notes
- **`handlers/association:operations/`:** Existing 54 handlers may need refactoring to expose reusable aggregation queries
