# Module Specification: National Dashboard (M14)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Provide national officers and platform admins with cross-chapter analytics: membership health, financial rollups, credit compliance, and event participation across an entire association. Desktop only.

### Users
- National Officer, Platform Administrator

### Related Modules
- M04 (Org Admin — org data), M05 (Membership — member metrics)
- M06 (Dues — financial data), M10 (Credit Tracking — compliance data)

### In Scope
- Association-wide membership dashboard (active/grace/lapsed counts by chapter)
- Financial rollups (collection rates, dues by chapter, fund breakdowns)
- Credit compliance across chapters, event participation metrics
- Chapter drill-down, chapter benchmarking
- Report export (CSV/PDF), desktop only

### Out of Scope
- Chapter-level management (M04), individual member management (M05), payment processing (M06)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Association | Top-level tenant. National dashboard shows data across all its organizations. |
| National Officer | Officer at the national body level with cross-chapter visibility. |
| Chapter Drill-Down | Viewing detailed metrics for a specific chapter within the association. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Review Association Health | National Officer | Cross-chapter KPIs | P0 |
| Configure Dashboard Access | Platform Admin | Grant national dashboard access | P0 |
| Review All Associations | Platform Admin | Platform-wide analytics | P0 |
| Chapter Drill-Down | National Officer | Specific chapter metrics | P0 |

## 4. Workflow Details

### Workflow: Review Association Health (Journey 14A)

Actor: National Officer
Steps:
1. Opens /admin/national.
2. Views KPI cards: total members (active/grace/lapsed), total collection rate, average credit compliance, total events this period.
3. Chapter comparison table: each chapter's members, collection rate, credit compliance, event count.
4. Clicks a chapter to drill down for detailed metrics.
5. Exports data as CSV or PDF for board presentation.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-36 | IF user is national officer THEN grant read access to all chapters in association | Access control | Scoped to own association |
| M14-R1 | IF platform admin THEN access all associations | Access | Platform-wide view |
| M14-R2 | IF fewer than 3 chapters THEN benchmarking unavailable | Benchmarking | Need minimum data |
| M14-R3 | IF data exported THEN include timestamp and filters applied | Reports | Audit trail in exports |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View national dashboard | National officers, platform admins | chapter officers, members | GA+OA / PA |
| Export reports | National officers, platform admins | All others | — |
| Configure access | Platform admin | All others | PA |
| Chapter drill-down | National officers (own association) | All others | Scoped |

## 7. Data Requirements

### Entity: NationalDashboardSnapshot (computed view)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| associationId | Yes | Association FK | — |
| totalMembers | Yes | Count across chapters | Aggregated |
| activeMembers | Yes | Active count | — |
| collectionRate | Yes | Percentage | Computed |
| creditComplianceRate | Yes | % meeting requirement | Computed |
| generatedAt | Yes | Snapshot time | — |

Note: Dashboard data is computed from M05, M06, M10 data — not stored separately. [INFERRED]

## 7b. Aggregate Boundaries

No owned aggregates. This module reads from M04, M05, M06, M10 aggregates.

## 8. State Transitions

No state machine — read-only reporting module.

## 9. UI / UX Requirements

### Screen: National Dashboard Home (/admin/national)
Purpose: Cross-chapter KPIs
Components: KPI cards, chapter comparison table (sortable), period selector, export buttons
States: Loading (skeleton), Populated, No data ("No chapters in association"), Error (retry)

### Screen: Chapter Drill-Down (/admin/national/[id]/orgs/[id])
Purpose: Individual chapter metrics
Components: Membership breakdown chart, financial summary, credit compliance, event participation, member activity trends

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /admin/national/:assocId | Association dashboard | period | KPIs + chapter list | 403 |
| GET /admin/national/:assocId/orgs/:orgId | Chapter drill-down | period | Chapter metrics | 403, 404 |
| GET /admin/national/:assocId/export | Export report | format, period | CSV/PDF | 403, 500 |

## 10b. Domain Events

### Published Events

None — read-only module.

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Update membership counts | Dashboard refresh |
| PaymentRecorded | M06 | Update collection rates | Dashboard refresh |
| CreditAwarded | M10 | Update compliance rates | Dashboard refresh |

## 11. Acceptance Criteria

### AC-M14-001: Cross-Chapter Aggregation
Dashboard correctly sums membership counts, collection rates, and credit compliance across all chapters.

### AC-M14-002: Access Scoping
National officers see only their own association's data. Platform admins see all.

### AC-M14-003: Export Accuracy
Exported CSV/PDF data matches on-screen dashboard values.

## 12. Test Expectations

Required tests:
- Aggregation: correct sums across chapters
- Access control: national officer (own association only), platform admin (all)
- Chapter drill-down: correct per-chapter metrics
- Export: CSV and PDF match dashboard
- Benchmarking: minimum 3 chapters requirement

## 13. Edge Cases

- Association with 1 chapter: benchmarking unavailable, all metrics show single chapter.
- Chapter with 0 members: included in list with zero values.
- New chapter mid-period: partial data for current period.
- Export with 1000+ members: performance check.

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin), M05 (Membership), M06 (Dues), M10 (Credit Tracking)

### External Dependencies
- PDF generation for exports

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Data aggregation timeout | Show partial data | "Some chapter data still loading." |
| Export generation fails | Retry | "Export failed. Try again." |

## 16. Performance Expectations

- Expected data volume: 50+ chapters, 10,000+ members per association
- Acceptable response times: Dashboard < 3s, export < 10s
- Caching requirements: Dashboard cached, refreshed every 15 minutes [INFERRED]

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| dashboard.national.viewed | INFO | Dashboard opened | associationId, userId | No |
| dashboard.national.exported | INFO | Report exported | associationId, format | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| national_dashboard_load_seconds | histogram | — | Load time |
| national_dashboard_views_total | counter | — | View count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| national_dashboard_enabled | release | false | Gates national dashboard | — |
| national_benchmarking | release | false | Cross-chapter comparison | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M14-S1 | Association KPIs | Top-level membership/financial cards | M05, M06 | P0 |
| M14-S2 | Chapter Comparison Table | Side-by-side chapter metrics | M14-S1 | P0 |
| M14-S3 | Chapter Drill-Down | Per-chapter detail view | M14-S2 | P0 |
| M14-S4 | Credit Compliance View | Cross-chapter credit metrics | M14-S1, M10 | P0 |
| M14-S5 | Report Export | CSV and PDF generation | M14-S1 | P1 |
| M14-S6 | Benchmarking | Anonymized chapter comparison | M14-S2 | P2 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
