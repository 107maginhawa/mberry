---
phase: 04-typespec-openapi-reconciliation
plan: 02
subsystem: api
tags: [typespec, openapi, dues, membership, payments, gateway, roster]

requires:
  - phase: 04-01
    provides: elections and certificates TypeSpec — established pattern for new interfaces in existing namespaces

provides:
  - DuesPaymentManagement interface (listDuesPayments, getDuesPayment, recordDuesPayment, refundDuesPayment)
  - DuesGatewayManagement interface (getDuesGatewayConfig, upsertDuesGatewayConfig, testDuesGatewayConnection, disconnectDuesGateway)
  - DuesReportingService interface (listDuesFunds, upsertDuesFunds, getDuesFinancialDashboard, generateDuesReport)
  - MemberRosterManagement interface (listRosterMembers, getRosterMember, addRosterMember, updateRosterMember, importRosterMembers)
  - MembershipCategoryManagement interface (listMembershipCategories, upsertMembershipCategory)
  - OrganizationProfileManagement interface (getOrganizationProfile, updateOrganizationProfile)
  - 6 new route registrations in main.tsp under /association/member/*

affects: [04-03, 04-04, sdk-ts generation, openapi coverage]

tech-stack:
  added: []
  patterns:
    - "organizationId (not orgId) used for all org-scoped TypeSpec path/query params"
    - "DuesRefundRequest naming disambiguates from billing module RefundRequest to avoid duplicate-symbol errors"

key-files:
  created: []
  modified:
    - specs/api/src/association/member/dues.tsp
    - specs/api/src/association/member/membership.tsp
    - specs/api/src/main.tsp

key-decisions:
  - "Renamed RefundRequest to DuesRefundRequest to avoid duplicate-symbol conflict with billing.tsp"
  - "Used organizationId as query param (not path param) on listRosterMembers to match hand-wired route pattern"
  - "OrganizationProfile is a plain model (not extends BaseEntity) since it comes from the platform-admin org table"

patterns-established:
  - "New TypeSpec interfaces appended within existing namespace blocks in their .tsp file"
  - "Route registrations inserted immediately after related existing registrations in main.tsp"

requirements-completed: [SPEC-01, SPEC-02]

duration: 15min
completed: 2026-05-06
---

# Phase 04 Plan 02: TypeSpec Dues + Membership Custom Endpoint Coverage

**TypeSpec coverage for 25 hand-wired dues/membership endpoints: payments, gateway, funds, dashboard, roster CRUD, categories, and org-profile — all with organizationId naming and role guards**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-06T00:00:00Z
- **Completed:** 2026-05-06T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added 3 new interfaces to `dues.tsp` covering 14 hand-wired dues endpoints not previously in TypeSpec (payments CRUD, gateway lifecycle, funds/dashboard/reports)
- Added 3 new interfaces to `membership.tsp` covering 11 hand-wired membership endpoints (roster CRUD + import, categories upsert, org-profile get/update)
- Registered all 6 new interfaces in `main.tsp`; build succeeds with 0 errors

## Task Commits

1. **Task 1: Add dues custom operation interfaces** - `fee14fd` (feat)
2. **Task 2: Add membership custom operation interfaces** - `48491e5` (feat)

## Files Created/Modified

- `specs/api/src/association/member/dues.tsp` — added DuesPayment/GatewayConfig/DuesFund models + DuesPaymentManagement, DuesGatewayManagement, DuesReportingService interfaces
- `specs/api/src/association/member/membership.tsp` — added RosterMember/OrganizationProfile/category models + MemberRosterManagement, MembershipCategoryManagement, OrganizationProfileManagement interfaces
- `specs/api/src/main.tsp` — 6 new interface registrations under /association/member/* routes

## Decisions Made

- Renamed `RefundRequest` → `DuesRefundRequest` to prevent duplicate-symbol build error with the existing `RefundRequest` in `billing.tsp`
- `OrganizationProfile` is a plain model (not `extends BaseEntity`) since the org profile data comes from the platform-admin org table which has its own structure
- `listRosterMembers` takes `organizationId` as a `@query` param (not `@path`) matching the hand-wired route pattern `GET /members/:orgId`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed RefundRequest to DuesRefundRequest**
- **Found during:** Task 1 (build verification)
- **Issue:** `billing.tsp` already defines `model RefundRequest`; adding a second one caused a `duplicate-symbol` TypeSpec error
- **Fix:** Named the dues refund model `DuesRefundRequest` and updated the interface operation to match
- **Files modified:** `specs/api/src/association/member/dues.tsp`
- **Verification:** `bun run build` exits 0
- **Committed in:** fee14fd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — naming conflict)
**Impact on plan:** Minimal naming adjustment; all intended operations and models delivered as specified.

## Issues Encountered

None beyond the naming conflict resolved above.

## Threat Surface Scan

No new network endpoints beyond the TypeSpec definitions produced in this plan. All operations have `@useAuth(bearerAuth)` and `@extension("x-security-required-roles")` guards as required by the threat model (T-04-03, T-04-04, T-04-05).

## Next Phase Readiness

- All 25 hand-wired dues + membership endpoints now have TypeSpec definitions
- OpenAPI paths `/association/member/dues-payments`, `/dues-gateway`, `/dues-reporting`, `/roster`, `/membership-categories`, `/org-profile` are present in generated spec
- Ready for 04-03 (further reconciliation phases or SDK regeneration)

---
*Phase: 04-typespec-openapi-reconciliation*
*Completed: 2026-05-06*
