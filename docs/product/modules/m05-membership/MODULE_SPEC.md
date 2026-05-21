# Module Specification: Membership (M05)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Complete member lifecycle management -- from application through renewal, across multiple organizations. Covers roster, applications, categories, bulk import, cross-org matching, directory, transfers, and reinstatement. Membership status is computed at query time from `dues_expiry_date`, never stored as a mutable field.

### Users
- Secretary, President, Officers, Member, Prospective Member, System

### Related Modules
- M01 (Auth), M04 (Org Admin -- officer roles, disciplinary actions)
- M06 (Dues -- payment triggers status recomputation via dues_expiry_date)
- M07 (Communications -- reminders, welcome emails)
- M11 (Documents -- credential verification), M12 (Elections -- voting eligibility requires Active status)
- M13 (Feed -- membership gates access), M14 (National Dashboard -- membership analytics)
- M15 (Job Board), M17 (Marketplace), M18 (Surveys), M19 (Committees)

### In Scope
- Multi-org membership, cross-org member matching (email OR license number)
- Membership categories (Regular, Associate, Life, Student, Honorary) per org
- Computed membership status: Active, Grace, Lapsed, Expired, Pending, Suspended, Removed, Resigned, Deceased, Expelled
- Life member exemption (sentinel dues_expiry_date 2099-12-31)
- Member directory (privacy-filtered), member transfer (inter-org, same association)
- Membership application + review, manual member add, bulk CSV import
- Renewal reminders, grace period enforcement, reinstatement, engagement analytics

### Out of Scope
- Payment processing (M06), officer management (M04), credential generation (M11)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Membership Status | Current standing of a member within a specific organization. Computed from `dues_expiry_date`, never stored as a mutable field. Status is per-org, not global. |
| Active | Dues are current. Full access to org features. |
| Grace | Dues expired but within the configurable grace period (default 30 days). Read-only access. |
| Lapsed | Dues expired beyond grace period. No access to org features. Still on roster. |
| Expired | Dues have lapsed and the membership period has fully expired without renewal. Terminal state requiring re-application or officer reinstatement. |
| Pending | Application submitted, not yet approved. |
| Suspended | Explicitly suspended by an officer. Requires officer action to restore. Distinct from Lapsed. |
| Removed | Removed from org roster by President action. Terminal state unless re-application. |
| Resigned | Member voluntarily departed the organization. Terminal state. Set by officer after receiving formal resignation. |
| Deceased | Member record marked deceased. Terminal state. Preserves record for historical/audit purposes. |
| Expelled | Member removed via formal disciplinary process. Terminal state. Distinct from Removed (administrative). |
| Membership Category | Classification within an org (e.g., Regular, Associate, Life, Student, Honorary). Configured per org. |
| Dues Expiry Date | Date when current dues payment expires. Membership status is derived from this value. |
| Cross-Org Membership | A member belonging to multiple organizations simultaneously, with independent status in each. |
| Cross-Org Member Matching | Linking a single account across organizations. Matches on email OR license number. Conflicts flagged for human resolution. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-029: Membership Application | Secretary | Review pending applications: approve/reject/request info | P0 |
| WF-030: Member Roster | Officer | List, search, filter, bulk actions | P0 |
| WF-031: Bulk CSV Import | Officer | Upload, validate, preview, import with matching | P0 |
| WF-032: Status Computation | System | Derived from dues_expiry_date at query time | P0 |
| WF-033: Membership Categories | Officer | CRUD categories per org | P0 |
| WF-034: Member Directory | Member, Officer | Privacy-filtered searchable list | P0 |
| WF-035: Reinstatement | Member, Officer | Pay dues to restore Active from Lapsed | P0 |
| WF-036: Member Transfer | Officer | Inter-org transfer with approval | P0 |
| WF-037: Cross-Org Matching | System | Email/license matching with normalization | P0 |

## 4. Workflow Details

### Workflow: Bulk CSV Import (WF-031)

Actor: Officer (Secretary or President, 2FA required)
Preconditions: Org exists, categories configured
Steps:
1. Download CSV template (name, email, license, category, phone).
2. Upload filled CSV. System validates each row independently.
3. Preview: "N total | X new | Y already-linked | Z invalid."
4. Review invalid rows (with field-level errors). Download invalid CSV.
5. Review already-linked members (match method shown: email or license).
6. Confirm import. Progress bar.
7. Completion: "X imported, Y linked, Z skipped."
8. New members receive claim emails.

Exception Flows:
- Invalid file type: "CSV files only."
- All rows invalid: "0 valid rows."
- 500-row file must validate within 30 seconds.

### Workflow: Membership Application Review (WF-029)

Actor: Secretary (or President, 2FA required)
Preconditions: Pending applications exist
Steps:
1. View pending applications sorted by date.
2. Open application: name, email, license, specialization, category preference.
3. Approve (member created, welcome email, dues invoice generated) OR reject (with reason) OR request more info.
4. Bulk approve supported with per-record org scope validation.

Alternate Flows:
- Applicant already a member: application rejected with message.
- Duplicate pending application: blocked (M5-R5).

### Workflow: Member Transfer (WF-036)

Actor: Officer (source org), Officer (target org)
Preconditions: Member exists in source org, target org is in same association
Steps:
1. Source officer initiates transfer request.
2. Transfer enters `requested` status.
3. Source org approves (`pendingSourceApproval` -> `pendingTargetApproval`).
4. Target org approves (`pendingTargetApproval` -> `approved` -> `completed`).
5. All history preserved. Member appears in target org roster.

Exception Flows:
- Transfer between different associations: blocked.
- Either org denies: status -> `denied`.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-01 | IF querying membership status THEN compute from dues_expiry_date + grace period at query time | All reads | Never store as mutable field. Priority: removed > suspended > pendingPayment > active > gracePeriod > lapsed |
| BR-02 | IF grace period setting exists THEN use org-specific value (0-90 days, default 30) | Status computation | Per-org configurable |
| BR-03 | IF membership transition THEN only valid state machine transitions allowed | All transitions | Invalid transitions rejected silently -- no error surfaced, no state change |
| BR-04 | IF category configured THEN cannot delete with assigned members (deactivate only) | Categories | Prevent orphaned members |
| BR-21 | IF member has multiple orgs THEN each status independent | Multi-org | No cross-org status leakage |
| BR-22 | IF importing THEN match by email (case-insensitive) or license (normalized) | Import/add | Ambiguous matches flagged for human review |
| BR-23 | IF license number entered THEN validate format per regex | License validation | PRC format validation |
| M5-R1 | IF status transition THEN follow state machine | All transitions | See Section 8 |
| M5-R2 | IF matching THEN normalize identifiers | Cross-org matching | Lowercase email; strip spaces/dashes/leading zeros from license |
| M5-R3 | IF CSV row invalid THEN skip, don't block valid rows | Bulk import | Independent validation per row |
| M5-R5 | IF member has pending application THEN block duplicate | Applications | One pending per org per member |
| M5-R6 | IF transfer THEN preserve all history; receiving org must approve | Transfers | No data loss |
| M5-R8 | IF CSV import THEN validate independently per row | Bulk import | Row errors don't block others |
| M5-R10 | IF status change in org A THEN no effect on org B | Cross-org | Independent contexts |

## 6. Permissions

From ROLE_PERMISSION_MATRIX Sections 3.2 and 3.6:

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List members | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (R) | user | GA+OA |
| Get member detail | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (Own) | user | GA+OA |
| Import roster | super, admin, president (2FA), secretary (2FA) | All others | GA+HG |
| Approve/reject application | super, admin, president (2FA), secretary (2FA) | All others | GA+HG |
| Apply to join | user | All others | GA (self-service) |
| View own membership | All authenticated | -- | GA |
| View directory | All org members | non-members | GA |
| Public directory | Public | -- | Public route (opt-in) |

## 7. Data Requirements

### Entity: Membership

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | -- |
| personId | Yes | Person FK | Unique with organizationId (one membership per person per org) |
| tierId | Yes | MembershipTier FK | Must be active tier |
| duesExpiryDate | Yes | Expiry date | Status computed from this. Life members: 2099-12-31 |
| suspendedAt | No | Suspension timestamp | Set by officer action |
| removedAt | No | Removal timestamp | Set by president action (irreversible) |
| isPendingPayment | No | Pending payment flag | Initial state after approval |
| joinedAt | Yes | Join date | -- |

### Entity: MembershipApplication

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Target org | -- |
| personId | No | Linked person (if account exists) | -- |
| applicantEmail | Yes | Email | Standard email validation |
| applicantLicenseNumber | Yes | License | Validated against regex (BR-23) |
| tierId | Yes | Requested tier | -- |
| status | Yes | submitted/underReview/approved/denied/waitlisted | Enum: application_status |

### Entity: MembershipCategory / MembershipTier

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | Per-org |
| name | Yes | Category/tier name | -- |
| duesAmount | Yes | Decimal | -- |
| billingCycle | Yes | annual/semi-annual/quarterly | Enum: billing_frequency |
| status | Yes | active/retired | Enum: tier_status. Cannot delete if members assigned (BR-04) |

### Entity: MembershipStatusHistory

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| membershipId | Yes | Membership FK | -- |
| previousStatus | Yes | Status before change | -- |
| newStatus | Yes | Status after change | -- |
| changedBy | No | Person ID of officer | null for system-computed |
| reason | No | Reason for change | Required for officer-initiated changes |

### Entity: AffiliationTransfer

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Member being transferred | -- |
| sourceOrgId | Yes | Source organization | -- |
| targetOrgId | Yes | Target organization | Must be same association |
| status | Yes | requested/pendingSourceApproval/pendingTargetApproval/approved/denied/completed/cancelled | Enum: transfer_status |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Membership | MembershipStatusHistory, MembershipApplication | -- | One membership per person per org (unique constraint). Status computed from dues_expiry_date, never stored as mutable. |
| MembershipTier | -- | -- | Cannot delete/retire with active members assigned. |
| AffiliationTransfer | -- | -- | Source and target orgs must be in same association. |

## 8. State Transitions

### Membership Status (Computed -- BR-01, BR-03)

```txt
PENDING -> ACTIVE (officer approves application)
PENDING -> REMOVED (officer rejects application)
ACTIVE -> GRACE (automatic: dues expired, within grace period)
GRACE -> LAPSED (automatic: grace period expired)
LAPSED -> EXPIRED (automatic: extended lapse without renewal, configurable threshold)
LAPSED -> ACTIVE (member pays dues / officer reinstatement)
ACTIVE -> SUSPENDED (officer action)
GRACE -> SUSPENDED (officer action)
LAPSED -> SUSPENDED (officer action)
SUSPENDED -> ACTIVE (officer restores)
ACTIVE -> REMOVED (president administrative removal)
ACTIVE -> RESIGNED (officer records voluntary resignation)
GRACE -> RESIGNED (officer records voluntary resignation)
LAPSED -> RESIGNED (officer records voluntary resignation)
* -> DECEASED (officer marks member as deceased; any non-terminal state)
ACTIVE -> EXPELLED (president action after disciplinary process)
SUSPENDED -> EXPELLED (president action after disciplinary process)
```

**Terminal states** (no outward transitions): EXPIRED, RESIGNED, DECEASED, EXPELLED
**Re-entry from terminal states**: New membership application required (back to PENDING).
**Life members**: always Active (sentinel dues_expiry_date 2099-12-31).
**Zero grace period**: Active -> Lapsed directly (no Grace state).

### Computation Priority (highest wins):
1. `removed` -- removedAt is set
2. `suspended` -- suspendedAt is set
3. `pendingPayment` -- isPendingPayment flag true
4. `active` -- duesExpiryDate is null (life/honorary) OR expiry >= today
5. `gracePeriod` -- today within gracePeriodDays after expiry
6. `lapsed` -- grace period also expired

### Application Status
```txt
submitted -> underReview (officer opens)
underReview -> approved (officer approves)
underReview -> denied (officer rejects)
underReview -> waitlisted (capacity full) [INFERRED]
```

### Transfer Status
```txt
requested -> pendingSourceApproval -> pendingTargetApproval -> approved -> completed
requested -> denied / cancelled (at any step)
```

## 9. UI / UX Requirements

### Screen: Member Roster (/org/[id]/officer/roster)
Purpose: Full member list with search, filter, bulk actions
Users: Officers
Components: Data table (name, license, category, status badge, expiry, joined, dues status, training credits), filters (status, category), bulk actions (send reminder, export CSV, change category, bulk approve)
States: Loading (skeleton table), Empty ("No members yet -- import or invite"), Filtered no results ("No members match filters"), Populated (50 per page), PermissionError (member sees read-only view), UnexpectedError (retry)

### Screen: Bulk CSV Import (/org/[id]/officer/roster/import)
Purpose: Multi-step import wizard
Users: President, Secretary (2FA required)
Components: Step 1 (upload + template download), Step 2 (validation preview with tabs: valid/already-linked/invalid), Step 3 (confirm), Step 4 (results with download of skipped rows)
States: Loading (validating), ValidationError (file type/format), Empty (0 valid rows), Processing (progress bar), Success (summary), PermissionError ("Import requires President or Secretary role")

### Screen: Member Directory (/org/[id]/members)
Purpose: Searchable member list (privacy-filtered)
Users: Org members
Components: Search bar, member cards (photo, name, specialization, status badge)
States: Loading (skeleton cards), Empty ("No members in directory"), NoResults ("No members match search"), Populated

### Screen: Application Review (/org/[id]/officer/applications)
Purpose: Review pending membership applications
Users: President, Secretary
Components: Application list (sortable by date), detail panel, approve/reject/request-info buttons, bulk approve
States: Loading (skeleton), Empty ("No pending applications"), Populated, ValidationError (duplicate application)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id/members | List members | filters, pagination | Member list with computed status | 403 |
| GET /org/:id/members/:id | Get member detail | -- | Member with full profile | 403, 404 |
| POST /org/:id/members/import | Bulk import | CSV file | Validation preview (new/linked/invalid counts) | 400 invalid file |
| POST /org/:id/members/import/confirm | Confirm import | importJobId | Import results | 400 |
| POST /org/:id/applications | Submit application | applicant data | applicationId | 409 duplicate |
| PUT /org/:id/applications/:id | Review application | status, reason | Updated application | 403 |
| POST /org/:id/members | Manual add | member data | membershipId | 409 already member |
| POST /org/:id/members/:id/transfer | Initiate transfer | targetOrgId | transferId | 400 different association |
| GET /org/:id/directory | Member directory | search query | Privacy-filtered list | 403 non-member |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| MembershipApproved | Application approved | orgId, personId, tierId | M01, M06 (generate invoice), M07 (welcome email) |
| MembershipSuspended | Officer suspension | orgId, personId | M04, M07 |
| MembershipStatusChanged | Status recomputed | orgId, personId, oldStatus, newStatus | M02, M06, M07, M11 |
| MembershipResigned | Voluntary resignation | orgId, personId | M07 |
| MembershipDeceased | Deceased marking | orgId, personId | M07 |
| MemberImported | Bulk import completed | orgId, importedCount, linkedCount, skippedCount | M07 (claim emails) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Update dues_expiry_date | Status recomputes to Active |
| PaymentRefunded | M06 | Reverse dues_expiry_date extension | Status may revert to Grace/Lapsed |
| MemberSuspended | M04 | Set suspendedAt timestamp | Access revoked for org |
| MemberRemoved | M04 | Set removedAt timestamp | Org membership terminated |

## 11. Acceptance Criteria

### AC-M05-001: No Duplicate Accounts
**Given** an import CSV with an email matching an existing person
**When** the import is processed
**Then** the existing account is linked (not duplicated) and match method is shown in preview.

### AC-M05-002: Status Computation Correctness
**Given** a member with dues_expiry_date in various states
**When** their status is queried
**Then** the correct status is returned: Life (always Active), zero grace period (Active -> Lapsed), suspended override trumps computed, Pending for new applications.

### AC-M05-003: Bulk Import Performance
**Given** a 500-row CSV file
**When** validation is triggered
**Then** it completes within 30 seconds. Invalid rows don't block valid rows.

### AC-M05-004: License Normalization
**Given** license numbers in various formats
**When** cross-org matching runs
**Then** `PRC-RN-0056789` matches `PRCRN56789` and `56789` matches `0056789`.

### AC-M05-005: Directory Privacy
**Given** a member with hidden fields in privacy settings
**When** a fellow member views the directory
**Then** hidden fields are never shown. Officers always see name and license.

### AC-M05-006: Transfer Preserves History
**Given** a member being transferred between orgs
**When** the transfer completes
**Then** all membership history, payment records, and status transitions are preserved in both source and target orgs.

### AC-M05-007: Bulk Approve with Org Scope
**Given** an officer bulk-approving applications
**When** the batch includes applications from other orgs
**Then** only same-org applications are processed; others are rejected with per-record error.

## 12. Test Expectations

Required test categories:
- **Status computation**: Active, Grace, Lapsed, Expired, Life, Suspended, Removed, Resigned, Deceased, Expelled, Pending; priority ordering; zero grace period
- **Cross-org matching**: email match, license match, ambiguous match flagging, normalization
- **CSV import**: valid rows, invalid rows, duplicates, already-linked, performance (500 rows < 30s), file type validation
- **Application flow**: submit, approve (generates invoice), reject (with reason), request info, duplicate prevention, bulk approve with org scope
- **Directory**: privacy filtering, officer vs member views, public directory opt-in
- **Member transfer**: history preservation, approval workflow, cross-association block
- **Categories**: CRUD, cannot delete with members, deactivate instead
- **Permissions**: 403 for unauthorized, 2FA enforcement for import/approve

## 13. Edge Cases

- Life member with dues_expiry_date = null: always Active (sentinel 2099-12-31 preferred).
- Zero grace period org: Active -> Lapsed (no Grace state).
- CSV with same email on two rows: second row flagged as duplicate within file.
- Ambiguous match (email -> PersonA, license -> PersonB): flagged for human resolution.
- Member applies to org they already belong to: rejected.
- Transfer between orgs in different associations: blocked.
- Member with status in multiple orgs: each independent (BR-21).
- Officer approves application but org has no dues config: member created as Active with no expiry (requires M06 setup). [VERIFY]
- Resigned member re-applies: treated as new application (back to PENDING).
- Deceased member: record preserved, all access blocked, terminal state.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth -- authentication, session)
- M04 (Org Admin -- officer roles determine who can approve/import, disciplinary actions set status overrides)
- M06 (Dues -- payment recording triggers dues_expiry_date update, refunds reverse it)

### External Dependencies
- Email service (claim emails for imported members, application notifications)
- CSV parsing library

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate application | Block with 409 | "You already have a pending application for this organization." |
| Invalid CSV format | Block upload | "Please upload a CSV file." |
| Ambiguous member match | Flag for resolution | "This person matches two different accounts. Please resolve manually." |
| Category delete with members | Block | "Category has assigned members. Deactivate instead." |
| Transfer to different association | Block with 400 | "Transfers are only supported within the same association." |
| Non-officer approves application | 403 | "Only the President or Secretary can approve applications." |
| Import exceeds 500 rows | Block | "Maximum 500 rows per import. Split your file." |

## 16. Performance Expectations

- Expected data volume: 500+ members per org, 1000+ row imports
- Expected concurrent users: 3-5 officers, 200+ members viewing directory
- Acceptable response times: Roster load < 500ms, import validation < 30s for 500 rows, status computation < 10ms per member
- Caching: Directory cached (invalidated on privacy changes, TTL 1 min). Status computation must be real-time (no caching).

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| membership.approved | INFO | Application approved | orgId, personId | No |
| membership.rejected | INFO | Application rejected | orgId, applicationId | No |
| membership.status.changed | INFO | Status recomputed | orgId, personId, old, new | No |
| membership.import.started | INFO | CSV import begun | orgId, rowCount | No |
| membership.import.completed | INFO | CSV import done | orgId, imported, linked, skipped | No |
| membership.transfer.completed | INFO | Transfer finalized | orgId, targetOrgId, personId | No |
| membership.match.ambiguous | WARN | Ambiguous match found | orgId, email, license | Yes (email) |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| membership_applications_total | counter | status | Application count by outcome |
| membership_imports_total | counter | -- | Import job count |
| membership_status_distribution | gauge | status, orgId | Members per status |
| membership_status_computation_ms | histogram | -- | Status computation latency |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| membership.transferEnabled | release | true | Inter-org transfers | -- |
| membership.bulkImportV2 | release | false | Enhanced CSV import with advanced matching | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M05-S1 | Membership Status Computation | Computed status from dues_expiry_date with priority ordering | M04 | P0 |
| M05-S2 | Member Roster | List, search, filter members with computed status | M05-S1 | P0 |
| M05-S3 | Application Flow | Submit, review, approve/reject with invoice generation | M05-S1 | P0 |
| M05-S4 | Bulk CSV Import | Upload, validate, preview, import with cross-org matching | M05-S1 | P0 |
| M05-S5 | Cross-Org Matching | Email/license matching with normalization | M05-S1 | P0 |
| M05-S6 | Member Directory | Privacy-filtered searchable list | M05-S2 | P0 |
| M05-S7 | Membership Categories | CRUD categories/tiers per org | M05-S1 | P0 |
| M05-S8 | Reinstatement | Pay dues to restore Active from Lapsed | M05-S1, M06 | P0 |
| M05-S9 | Member Transfer | Inter-org transfer with dual-approval workflow | M05-S1 | P1 |
| M05-S10 | Terminal States | Resigned, Deceased, Expelled handling | M05-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. **Two handler directories**: `handlers/membership/` (12 handlers, hand-wired, no TypeSpec) and `handlers/association:member/` (157 handlers, TypeSpec-covered). New membership handlers should go in `association:member/` with TypeSpec definitions.
2. **Status computation is the foundation**: Implement `compute-membership-status.ts` first. It lives in `association:member/utils/`. Priority order: removed > suspended > pendingPayment > active > gracePeriod > lapsed.
3. **Never store status as mutable**: Status is always computed at query time from `duesExpiryDate`, `suspendedAt`, `removedAt`, and `isPendingPayment` flags. This is BR-01, the most critical business rule.
4. **License normalization**: Strip spaces, dashes, leading zeros, then compare. `PRC-RN-0056789` must match `PRCRN56789`.
5. **Import performance**: Use batch insert with streaming CSV parse. Target 500 rows < 30s. Validate independently per row (M5-R3).
6. **Cross-org isolation**: A status change in org A must never affect org B (BR-21, M5-R10). Test with multi-org members.
7. **Permissions**: Import and approve require president or secretary with 2FA. Use `officerAuthMiddleware` + `requirePosition()`.
8. **Database**: `membership` table has unique constraint on `(organizationId, personId)`. Use Drizzle ORM transactions for application approval (create membership + log history + trigger invoice).
9. **Transfer state machine**: `affiliation_transfer` table in `association:member/repos/chapters.schema.ts`. Seven states with dual-approval workflow.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | Updated with full status list from DOMAIN_GLOSSARY |
| 2. Domain Terms | COMPLETE | All 15 terms from DOMAIN_GLOSSARY |
| 3. Workflows | COMPLETE | Aligned with WORKFLOW_MAP WF-029 through WF-037 |
| 4. Workflow Details | COMPLETE | 3 workflows detailed: import, application, transfer |
| 5. Business Rules | COMPLETE | BR-01 through BR-23 + module rules |
| 6. Permissions | COMPLETE | From ROLE_PERMISSION_MATRIX 3.2 + 3.6 |
| 7. Data Requirements | COMPLETE | 5 entities with full field specs from DOMAIN_MODEL |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL section 10 |
| 8. State Transitions | COMPLETE | Full state machine from DOMAIN_GLOSSARY + DOMAIN_MODEL 13b/13c. Includes terminal states. |
| 9. UI/UX Requirements | COMPLETE | 4 screens with all 6 states |
| 10. API Expectations | COMPLETE | 9 endpoints |
| 10b. Domain Events | COMPLETE | 6 published, 4 consumed |
| 11. Acceptance Criteria | COMPLETE | 7 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | 8 categories |
| 13. Edge Cases | COMPLETE | 10 cases |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | 7 scenarios |
| 16. Performance | COMPLETE | -- |
| 17. Observability | COMPLETE | 7 log events, 4 metrics |
| 18. Feature Flags | COMPLETE | 2 flags |
| 19. Vertical Slice Plan | COMPLETE | 10 slices |
| 20. AI Instructions | COMPLETE | 9 implementation directives |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M06 Dues & Payments**: MembershipApproved event triggers first dues invoice generation. PaymentRecorded event triggers dues_expiry_date update. Bidirectional dependency.
- **M04 Org Admin**: Disciplinary actions (MemberSuspended, MemberRemoved) set status overrides. Officer roles gate who can approve applications.
- **M07 Communications**: Consumes status changes for reminder scheduling (suppress reminders for Life/Suspended/Removed).
- **M12 Elections**: Voting eligibility depends on Active membership status. If status computation is wrong, ineligible members could vote.
- **M14 National Dashboard**: Membership analytics (Active/Lapsed/Grace counts) depend on correct status computation.
- **Handler split**: The mega-module `association:member/` (157 handlers) contains most membership logic. Split plan at `.planning/phases/14-mega-module-split/SPLIT-PLAN.md` may affect file locations.
