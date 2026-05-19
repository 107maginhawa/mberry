# Module Specification: Membership (M05)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Complete member lifecycle management — from application through renewal, across multiple organizations. Covers roster, applications, categories, bulk import, cross-org matching, directory, transfers, and reinstatement.

### Users
- Secretary, President, Officers, Member, Prospective Member, System

### Related Modules
- M01 (Auth), M04 (Org Admin), M06 (Dues — triggers status changes), M07 (Communications — reminders)
- M11 (Documents — credential verification), M12 (Elections — voting eligibility)
- M13 (Feed — membership gates access), M14 (National Dashboard — membership analytics)
- M15 (Job Board), M17 (Marketplace), M18 (Surveys), M19 (Committees)

### In Scope
- Multi-org membership, cross-org member matching, membership categories
- Computed membership status (Active/Grace/Lapsed/Suspended/Removed/Pending)
- Life member exemption, member directory, member transfer
- Membership application + review, manual member add, bulk CSV import
- Renewal reminders, grace period enforcement, reinstatement, engagement analytics

### Out of Scope
- Payment processing (M06), officer management (M04), credential generation (M11)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Membership Status | Computed from dues_expiry_date at query time. Never stored as mutable. Per-org. |
| Active | Dues current. Full access. |
| Grace | Dues expired within configurable grace period. Read-only access. |
| Lapsed | Beyond grace. No org features. Still on roster. |
| Pending | Application submitted, not approved. |
| Suspended | Officer action. Requires officer to restore. |
| Removed | President action. Membership terminated. |
| Membership Category | Per-org classification (Regular, Associate, Life, Student, Honorary). |
| Cross-Org Membership | Single account across multiple orgs with independent status per org. |
| Cross-Org Member Matching | Linking accounts by email OR license number. Ambiguous matches flagged. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Process Applications | Secretary | Review pending applications: approve/reject/request info | P0 |
| Bulk CSV Import | Officer | Upload, validate, preview, import members | P0 |
| Apply to Join | Prospective Member | Self-service application from public page | P0 |
| View Directory | Member, Officer | Search members within org | P0 |
| Manual Add | Officer | Add single member directly | P0 |
| Member Transfer | Officer | Transfer member between orgs (same association) | P0 |
| Reinstatement | Member, Officer | Pay dues to restore Active from Lapsed | P0 |

## 4. Workflow Details

### Workflow: Bulk CSV Import (CS-2)

Actor: Officer (Secretary or President)
Preconditions: Org exists, categories configured
Steps:
1. Download CSV template (name, email, license, category, phone).
2. Upload filled CSV. System validates each row independently.
3. Preview: "N total | X new | Y already-linked | Z invalid."
4. Review invalid rows (with field-level errors). Download invalid CSV.
5. Review already-linked members (match method shown).
6. Confirm import. Progress bar.
7. Completion: "X imported, Y linked, Z skipped."
8. New members receive claim emails.

Exception Flows:
- Invalid file type: "CSV files only."
- All rows invalid: "0 valid rows."
- 500-row file must validate within 30 seconds.

### Workflow: Application Review (CS-1)

Actor: Secretary
Steps:
1. View pending applications sorted by date.
2. Open application: name, email, license, specialization, category preference.
3. Approve (member created, welcome email, dues invoice) OR reject (with reason) OR request more info.
4. Bulk approve supported.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-01 | IF querying status THEN compute from dues_expiry_date + grace period | All reads | Never store as mutable |
| BR-02 | IF grace period setting exists THEN use org-specific value (0-90 days, default 30) | Status computation | Per-org |
| BR-04 | IF category configured THEN cannot delete with assigned members (deactivate only) | Categories | Prevent orphaned members |
| BR-21 | IF member has multiple orgs THEN each independent | Multi-org | No cross-org status leakage |
| BR-22 | IF importing THEN match by email (case-insensitive) or license (normalized) | Import/add | Ambiguous: flag for human review |
| M5-R1 | IF status transition THEN follow state machine | All transitions | Pending→Active→Grace→Lapsed; Suspended/Removed as overrides |
| M5-R2 | IF matching THEN normalize identifiers | Cross-org matching | Lowercase email, strip spaces/dashes/leading zeros from license |
| M5-R3 | IF CSV row invalid THEN skip, don't block valid rows | Bulk import | Independent validation per row |
| M5-R5 | IF member has pending application THEN block duplicate | Applications | One pending per org per member |
| M5-R6 | IF transfer THEN preserve all history, receiving org must approve | Transfers | No data loss |
| M5-R8 | IF CSV import THEN validate independently per row | Bulk import | Row errors don't block others |
| M5-R10 | IF status change in org A THEN no effect on org B | Cross-org | Independent contexts |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List members | All officers, member (read-only) | user | GA+OA |
| Get member detail | Officers (full), member (own) | — | GA+OA |
| Import roster | president (2FA), secretary (2FA), super, admin | All others | GA+HG |
| Approve/reject application | president (2FA), secretary (2FA), super, admin | All others | GA+HG |
| View directory | All org members | non-members | GA |

## 7. Data Requirements

### Entity: Membership (OrgMembership)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Organization FK | — |
| memberId | Yes | Person FK | Unique with orgId |
| categoryId | Yes | Category FK | Must be active category |
| duesExpiryDate | Yes | Expiry date | Status computed from this |
| statusOverride | No | null/pending/suspended/removed | Overrides computed status |
| joinedAt | Yes | Join date | — |

### Entity: MembershipCategory

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Organization FK | Per-org |
| name | Yes | Category name | — |
| duesAmount | Yes | Decimal | — |
| billingCycle | Yes | annual/quarterly | Enum |
| isActive | Yes | Active toggle | Cannot delete if members assigned |

### Entity: MembershipApplication

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Target org | — |
| applicantEmail | Yes | Email | — |
| applicantLicenseNumber | Yes | License | Validated against regex |
| requestedCategoryId | Yes | Preferred category | — |
| status | Yes | pending/approved/rejected/info_requested | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Membership | MembershipStatusHistory, MembershipApplication | — | One membership per person per org. Status computed, never stored. |
| MembershipCategory | — | — | Cannot delete with assigned members. |

## 8. State Transitions

### Membership Status
```txt
Pending → Active (approved)
Pending → Removed (rejected)
Active → Grace (dues expired, automatic)
Grace → Lapsed (grace period expired, automatic)
Lapsed → Active (dues paid, reinstatement)
Active → Suspended (officer action)
Grace → Suspended (officer action)
Lapsed → Suspended (officer action)
Suspended → Active (officer restores)
Any → Removed (president action)
```

Life members: always Active (sentinel dues_expiry_date 2099-12-31).

## 9. UI / UX Requirements

### Screen: Member Roster (/org/[id]/officer/roster)
Purpose: Full member list with search, filter, bulk actions
Components: Data table (name, license, category, status badge, expiry, joined), filters (status, category), bulk actions (send reminder, export CSV, change category)
States: Empty ("No members yet"), Loading (skeleton), Filtered no results, Populated (50 per page)

### Screen: Bulk CSV Import (/org/[id]/officer/roster/import)
Purpose: Multi-step import wizard
Components: Step 1 (upload), Step 2 (validation preview with tabs: valid/already-linked/invalid), Step 3 (confirm), Step 4 (results)

### Screen: Member Directory (/org/[id]/members)
Purpose: Searchable member list (privacy-filtered)
Components: Search bar, member cards (photo, name, specialization, status)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id/members | List members | filters, pagination | Member list | 403 |
| POST /org/:id/members/import | Bulk import | CSV file | Validation preview | 400 invalid file |
| POST /org/:id/members/import/confirm | Confirm import | importJobId | Import results | 400 |
| POST /org/:id/applications | Submit application | applicant data | applicationId | 409 duplicate |
| PUT /org/:id/applications/:id | Review application | status, reason | Updated app | 403 |
| POST /org/:id/members | Manual add | member data | membershipId | 409 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| MembershipApproved | Application approved | orgId, personId, categoryId | M01, M06, M07 |
| MembershipSuspended | Disciplinary suspension | orgId, personId | M04, M07 |
| MembershipStatusChanged | Status recomputed | orgId, personId, oldStatus, newStatus | M02, M06, M07, M11 |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Update dues_expiry_date | Status recomputes to Active |
| MemberSuspended | M04 | Set statusOverride=suspended | Access revoked |
| MemberRemoved | M04 | Set statusOverride=removed | Org membership terminated |

## 11. Acceptance Criteria

### AC-M05-001: No Duplicate Accounts
Cross-org matching never creates duplicate accounts for the same email or license number.

### AC-M05-002: Status Computation
Computed status returns correct value for all edge cases: Life (always Active), zero grace period (Active→Lapsed), suspended override, Pending.

### AC-M05-003: Bulk Import Performance
500-row CSV validates within 30 seconds. Invalid rows don't block valid rows.

### AC-M05-004: License Normalization
`PRC-RN-0056789` matches `PRCRN56789` and `56789` matches `0056789`.

### AC-M05-005: Directory Privacy
Hidden fields never shown to fellow members. Officers always see name and license.

## 12. Test Expectations

Required tests:
- Status computation: Active, Grace, Lapsed, Life, Suspended, Removed, Pending
- Cross-org matching: email match, license match, ambiguous match flagging
- CSV import: valid rows, invalid rows, duplicates, already-linked, performance (500 rows < 30s)
- Application flow: submit, approve, reject, request info, duplicate prevention
- Directory: privacy filtering, officer vs member views
- Member transfer: history preservation, approval workflow

## 13. Edge Cases

- Life member with dues_expiry_date = null: always Active.
- Zero grace period org: Active → Lapsed (no Grace state).
- CSV with same email on two rows: second row flagged as duplicate within file.
- Ambiguous match (email→A, license→B): flagged for human resolution.
- Member applies to org they already belong to: rejected.
- Transfer between orgs in different associations: not allowed.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth), M04 (Org Admin — officer roles, disciplinary actions)
- M06 (Dues — payment triggers status change)

### External Dependencies
- Email service (claim emails, application notifications)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate application | Block | "You already have a pending application." |
| Invalid CSV format | Block upload | "Please upload a CSV file." |
| Ambiguous member match | Flag for resolution | "This person matches two different accounts." |
| Category delete with members | Block | "Category has assigned members. Deactivate instead." |

## 16. Performance Expectations

- Expected data volume: 500+ members per org, 1000+ row imports
- Expected concurrent users: 3-5 officers, 200+ members
- Acceptable response times: Roster load < 500ms, import validation < 30s for 500 rows
- Caching requirements: Directory cached, invalidated on privacy changes (1 min)

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| membership.approved | INFO | Application approved | orgId, personId | No |
| membership.status.changed | INFO | Status recomputed | orgId, personId, old, new | No |
| membership.import.completed | INFO | CSV import done | orgId, imported, linked, skipped | No |
| membership.transfer.completed | INFO | Transfer finalized | orgId, targetOrgId, personId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| membership_applications_total | counter | status | Application count by outcome |
| membership_imports_total | counter | — | Import job count |
| membership_status_distribution | gauge | status, orgId | Members per status |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| membership_transfer_enabled | release | true | Inter-org transfers | — |
| membership_bulk_import_v2 | release | false | Enhanced CSV import | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M05-S1 | Membership Status Computation | Computed status from dues_expiry_date | M04 | P0 |
| M05-S2 | Member Roster | List, search, filter members | M05-S1 | P0 |
| M05-S3 | Application Flow | Submit, review, approve/reject | M05-S1 | P0 |
| M05-S4 | Bulk CSV Import | Upload, validate, preview, import | M05-S1 | P0 |
| M05-S5 | Cross-Org Matching | Email/license matching with normalization | M05-S1 | P0 |
| M05-S6 | Member Directory | Privacy-filtered searchable list | M05-S2 | P0 |
| M05-S7 | Membership Categories | CRUD categories per org | M05-S1 | P0 |
| M05-S8 | Reinstatement | Pay dues to restore Active | M05-S1, M06 | P0 |
| M05-S9 | Member Transfer | Inter-org transfer with approval | M05-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
