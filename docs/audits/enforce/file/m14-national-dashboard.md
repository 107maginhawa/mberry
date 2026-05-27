# File Enforcement: National Dashboard (M14)

## Findings

| ID | Sev | Finding | File:Line | Spec Source | Confidence |
|----|-----|---------|-----------|-------------|------------|
| EF-M14-a1b2c3d4 | P1 | No handler file for `GET /admin/national/summary`. Spec requires cross-chapter aggregation of member counts, dues collection rates, credit compliance, and revenue. Entire endpoint missing. | MISSING | API_CONTRACTS 2.1 | 99% |
| EF-M14-e5f6a7b8 | P1 | No handler file for `GET /admin/national/chapters`. Spec requires paginated chapter comparison table with sorting by totalMembers, collectionRate, etc. Entire endpoint missing. | MISSING | API_CONTRACTS 2.2 | 99% |
| EF-M14-c9d0e1f2 | P1 | No handler file for `GET /admin/national/chapters/{organizationId}`. Spec requires detailed chapter drill-down including membership breakdown by status, dues collection, event participation, and training compliance. Entire endpoint missing. | MISSING | API_CONTRACTS 2.3 | 99% |
| EF-M14-a3b4c5d6 | P1 | No handler file for `GET /admin/national/export`. Spec requires CSV and JSON export with date range filtering and format selection. Entire endpoint missing. | MISSING | API_CONTRACTS 2.4 | 99% |
| EF-M14-e7f8a9b0 | P1 | No handler file for `GET /admin/national/platform`. Spec requires platform-wide analytics across all associations, restricted to platform admin role. Entire endpoint missing. | MISSING | API_CONTRACTS 2.5 | 99% |
| EF-M14-c1d2e3f4 | P2 | No `NationalDashboardSnapshot` computed view, materialized view, or aggregation query in any schema file under `association:operations/repos/`. Spec Section 7 defines this as a computed entity with fields: associationId, totalMembers, activeMembers, chapterCount, collectionRate, creditComplianceRate, totalRevenueCents, snapshotDate. | MISSING | MODULE_SPEC S7 | 99% |
| EF-M14-a5b6c7d8 | P2 | `association:operations/repos/` contains `committee.schema.ts`, `training.schema.ts`, `events.schema.ts`, `committee-task.schema.ts` -- all operational schemas. No analytics or dashboard schema. Complete domain mismatch with M14 spec. | association:operations/repos/*.schema.ts | MODULE_SPEC S7, S2 | 95% |
| EF-M14-e9f0a1b2 | P2 | All 54 handler files in `association:operations/` implement CRUD for events, trainings, courses, committees, enrollments, waitlists, check-ins, quiz attempts, and accredited providers. Zero files implement analytics, aggregation, or reporting. Module-code mapping is fundamentally wrong. | association:operations/*.ts | MODULE_SPEC ALL | 99% |
| EF-M14-c3d4e5f6 | P1 | No consumed event handlers for `MembershipStatusChanged`, `DuesPaymentReceived`, `TrainingCompleted`, or `CreditRecordUpdated` (spec Section 10b). These events should trigger dashboard metric recalculation. Not implemented because no dashboard exists. | MISSING | MODULE_SPEC 10b Consumed Events | 99% |
| EF-M14-a7b8c9d0 | P1 | No auth guards for National President or Platform Admin roles. Spec Section 6 requires: summary/chapters/export restricted to National President (GA auth), platform endpoint restricted to Platform Admin (PA). No handlers = no guards. | MISSING | MODULE_SPEC S6 Permissions | 99% |

## Module-Code Mapping Assessment

The assignment of `association:operations/` to M14 (National Dashboard) is a **mapping error**. The `association:operations` directory is an operational CRUD module managing events, trainings, courses, and committees -- these correspond to modules M09 (Training/CPD) and M10 (Events), not M14 (National Dashboard).

**Recommendation:** M14 requires a new handler directory (e.g., `services/api-ts/src/handlers/national-dashboard/`) with:
1. Five GET endpoints for summary, chapters, drill-down, export, platform
2. Cross-module aggregation queries reading from membership, dues, training, and events data
3. NationalDashboardSnapshot materialized view or query builder
4. National President and Platform Admin auth guards
5. Export service for CSV/JSON generation
6. Consumed event handlers for metric recalculation
