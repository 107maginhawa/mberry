# E2E Test Gap Analysis Report

**Generated:** 2026-05-22
**Scope:** `apps/memberry/tests/e2e/` vs WORKFLOW_MAP.md (114 WFs), business-rules.md (51 BRs), personas-and-roles.md (107 flows)
**Method:** Cross-referenced documentation sources against actual test file content (grep of test.describe/test calls, br-registry.json mappings)

---

## 1. Workflow Coverage Matrix

### M01: Authentication & Onboarding (9 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-001 | Self-Registration (OTP) | auth.spec.ts, auth/otp-registration.spec.ts | COVERED |
| WF-002 | Account Claim | auth/account-claim.spec.ts | COVERED |
| WF-003 | Login | auth.spec.ts (Sign-in flow) | COVERED |
| WF-004 | Password Reset | auth/password-reset.spec.ts | COVERED |
| WF-005 | Smart Onboarding Wizard | member/onboarding.spec.ts | PARTIAL -- tests profile completion steps only, not full org-type-aware setup |
| WF-006 | Member Onboarding | member/onboarding.spec.ts | COVERED |
| WF-007 | MFA Enrollment | -- | UNCOVERED |
| WF-008 | Invite Member | auth.spec.ts ([BR-24]) | PARTIAL -- tests expired invite only, not send flow |
| WF-009 | Bulk CSV Import | officer/roster.spec.ts | PARTIAL -- roster tests exist but no dedicated import workflow test |

### M02: Member Profile & Settings (5 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-010 | View & Update Profile | profile.spec.ts | COVERED |
| WF-011 | Account Deletion | member/delete-account.spec.ts | COVERED |
| WF-012 | Digital ID Card | member/certificates.spec.ts | COVERED |
| WF-013 | Notification Preferences | settings.spec.ts | COVERED |
| WF-014 | Data Export | member/data-export.spec.ts | COVERED |

### M03: Platform Administration (9 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-015 | Onboard Association | -- | UNCOVERED (admin app scope) |
| WF-016 | Provision Organization | -- | UNCOVERED (admin app scope) |
| WF-017 | Manage Subscriptions | -- | UNCOVERED (admin app scope) |
| WF-018 | Feature Flag Management | -- | UNCOVERED (admin app scope) |
| WF-019 | User Impersonation | officer/settings.spec.ts (BR-10) | PARTIAL -- settings test references BR-10 but no impersonation flow |
| WF-020 | Support Ticket Resolution | -- | UNCOVERED (admin app scope) |
| WF-021 | Revenue Dashboard | -- | UNCOVERED (admin app scope) |
| WF-022 | Admin Team Management | -- | UNCOVERED (admin app scope) |
| WF-023 | Org Suspension/Cancellation | -- | UNCOVERED (admin app scope) |

> **Note:** M03 workflows are admin app scope. Only WF-019 has partial memberry app coverage.

### M04: Organization Admin (5 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-024 | Org Settings | officer/settings.spec.ts, states/settings-states.spec.ts | COVERED |
| WF-025 | Officer Transition | officer/role-assignment.spec.ts, officer/guard-enforcement.spec.ts | PARTIAL -- role assignment tested, but handoff flow not covered |
| WF-026 | Disciplinary Action | officer/roster.spec.ts (suspend/reinstate) | COVERED |
| WF-027 | Org Dashboard | officer/dashboard.spec.ts, states/officer-dashboard-states.spec.ts | COVERED |
| WF-028 | Org Public Page | journeys/public-org.spec.ts | COVERED |

### M05: Membership (9 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-029 | Membership Application | officer/application-review.spec.ts | COVERED |
| WF-030 | Member Roster | officer/roster.spec.ts, states/roster-states.spec.ts | COVERED |
| WF-031 | Bulk CSV Import | officer/roster.spec.ts | PARTIAL -- no dedicated import test |
| WF-032 | Membership Status Computation | officer/roster.spec.ts (BR-01), member/status-display.spec.ts | COVERED |
| WF-033 | Membership Categories | -- | UNCOVERED |
| WF-034 | Member Directory | member/directory.spec.ts | COVERED |
| WF-035 | Reinstatement | officer/roster.spec.ts (reinstate action) | COVERED |
| WF-036 | Member Transfer | member/transfer.spec.ts | COVERED |
| WF-037 | Cross-Org Matching | auth.spec.ts ([BR-21]) | PARTIAL -- multi-org cards tested, matching logic not exercised |

### M06: Dues & Payments (8 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-038 | Pay Dues Online | member/dues.spec.ts, member/payments.spec.ts, member/pay-token.spec.ts | COVERED |
| WF-039 | Configure Dues & Funds | officer/settings.spec.ts, states/settings-states.spec.ts, journeys/dues-lifecycle.spec.ts | COVERED |
| WF-040 | Batch Dues Reminders | officer/dues-reminders.spec.ts | COVERED |
| WF-041 | Process Refund | officer/payment-refund.spec.ts | COVERED |
| WF-042 | Auto-Lapse on Expiry | officer/payment-expiry.spec.ts | COVERED |
| WF-043 | Financial Dashboard | officer/payments.spec.ts, journeys/dues-lifecycle.spec.ts | COVERED |
| WF-044 | Manual Payment Recording | officer/payments.spec.ts, actions/dues-actions.spec.ts | COVERED |
| WF-045 | Payment Receipt Generation | -- | UNCOVERED |

### M07: Communications (5 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-046 | Send Announcement | officer/communications.spec.ts, actions/comms-elections-actions.spec.ts | COVERED |
| WF-047 | Message Templates | -- | UNCOVERED |
| WF-048 | Delivery Stats | -- | UNCOVERED |
| WF-049 | Communication Dashboard | officer/communications.spec.ts, states/communications-states.spec.ts | COVERED |
| WF-050 | Email Opt-Out Management | -- | UNCOVERED |

### M08: Events (7 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-051 | Create & Publish Event | officer/events.spec.ts, actions/events-actions.spec.ts | COVERED |
| WF-052 | Event Registration | member/events.spec.ts, member/event-capacity.spec.ts | COVERED |
| WF-053 | QR Check-In | officer/event-checkin.spec.ts | COVERED |
| WF-054 | Event Cancellation | -- | UNCOVERED |
| WF-055 | Events Dashboard | officer/events.spec.ts, journeys/event-lifecycle.spec.ts | COVERED |
| WF-056 | My Events | member/events.spec.ts, states/events-states.spec.ts | COVERED |
| WF-057 | Waitlist Management | member/event-capacity.spec.ts | PARTIAL -- capacity tested, waitlist promotion not exercised |

### M09: Training (5 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-058 | Create Training Course | officer/training.spec.ts, actions/training-actions.spec.ts | COVERED |
| WF-059 | Manage Enrollments | officer/enrollment-management.spec.ts | COVERED |
| WF-060 | Mark Completion & Award Credits | officer/training-completion.spec.ts, member/training-completion-flow.spec.ts | COVERED |
| WF-061 | Training Certificate Generation | member/certificates.spec.ts | COVERED |
| WF-062 | Paid Training Payment Gate | -- | UNCOVERED |

### M10: Credit Tracking (4 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-063 | Manual Credit Entry | member/credits.spec.ts | COVERED |
| WF-064 | Credit Dashboard | member/credits.spec.ts, states/credits-states.spec.ts | COVERED |
| WF-065 | Cross-Org Credit Aggregation | member/credits.spec.ts (BR-14) | PARTIAL -- referenced but cross-org aggregation not deeply tested |
| WF-066 | Credit Cycle Configuration | -- | UNCOVERED |

### M11: Documents & Credentials (5 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-071 | Download Member ID Card | member/certificates.spec.ts | COVERED |
| WF-072 | Public Verification (QR) | member/certificates.spec.ts (BR-18) | PARTIAL -- QR auth tested, public scan not exercised |
| WF-073 | Document Management | -- | UNCOVERED |
| WF-074 | Certificate Template Management | -- | UNCOVERED |
| WF-075 | Access Log Tracking | -- | UNCOVERED |

### M12: Elections & Governance (4 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-076 | Create Election & Nominations | officer/elections.spec.ts, stubs/nomination-eligibility.spec.ts | PARTIAL -- stub tests auth gate only; elections.spec.ts covers create + nominations |
| WF-077 | Member Votes | officer/elections.spec.ts (BR-33, BR-43) | PARTIAL -- election integrity tested, but secret ballot UX not fully exercised |
| WF-078 | Bylaw Ratification | -- | UNCOVERED |
| WF-079 | Election-to-Officer Transition | -- | UNCOVERED |

### M13: Professional Feed (4 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-080 | Browse Feed | stubs/feed-moderation.spec.ts (auth gate only) | DEFERRED |
| WF-081 | Create Post | -- | DEFERRED |
| WF-082 | Content Moderation | stubs/feed-moderation.spec.ts (auth gate only) | DEFERRED |
| WF-083 | Feed Analytics | -- | DEFERRED |

### M14: National Dashboard (3 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-084 | Cross-Org Dashboard | stubs/national-dashboard.spec.ts (auth gate only) | DEFERRED |
| WF-085 | Benchmark Reports | -- | DEFERRED |
| WF-086 | Data Export | -- | DEFERRED |

### M15: Job Board (5 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-087 | Post Job Listing | stubs/job-posting-expiry.spec.ts (auth gate only) | DEFERRED |
| WF-088 | Browse Job Board | -- | DEFERRED |
| WF-089 | Apply for Job | -- | DEFERRED |
| WF-090 | Job Posting Expiry | stubs/job-posting-expiry.spec.ts (auth gate only) | DEFERRED |
| WF-091 | Employer Dashboard | -- | DEFERRED |

### M16: Advertising (4 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-092 | Create Campaign | -- | DEFERRED |
| WF-093 | Campaign Budget Management | -- | DEFERRED |
| WF-094 | Ad Delivery & Targeting | -- | DEFERRED |
| WF-095 | Campaign Analytics | -- | DEFERRED |

### M17: Marketplace (3 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-096 | Vendor Registration | stubs/marketplace-referral.spec.ts (auth gate only) | DEFERRED |
| WF-097 | Product Listing | -- | DEFERRED |
| WF-098 | Referral Disclosure | stubs/marketplace-referral.spec.ts (auth gate only) | DEFERRED |

### M18: Surveys & Polls (3 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-101 | Create Survey | stubs/survey-anonymity.spec.ts (auth gate only) | DEFERRED |
| WF-102 | Survey Response Collection | stubs/survey-anonymity.spec.ts (auth gate only) | DEFERRED |
| WF-103 | Quick Poll | -- | DEFERRED |

### M19: Committee Management (5 workflows) -- DEFERRED

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-104 | Create Committee | stubs/committee-dissolution.spec.ts (auth gate only) | DEFERRED |
| WF-105 | Manage Committee Members | -- | DEFERRED |
| WF-106 | Manage Tasks | -- | DEFERRED |
| WF-107 | Committee Meetings | -- | DEFERRED |
| WF-108 | Committee Dissolution | stubs/committee-dissolution.spec.ts (auth gate only) | DEFERRED |

### Cross-Cutting Workflows (6 workflows)

| WF-ID | Description | Test File(s) | Status |
|-------|-------------|--------------|--------|
| WF-109 | Notification Lifecycle | -- | UNCOVERED (backend concern) |
| WF-110 | Email Queue Processing | -- | UNCOVERED (backend concern) |
| WF-111 | Audit Log Retention | -- | UNCOVERED (admin app scope) |
| WF-112 | Booking Event Lifecycle | -- | UNCOVERED (not in memberry app) |
| WF-113 | Slot Generation | -- | UNCOVERED (not in memberry app) |
| WF-114 | Booking Confirmation Timer | -- | UNCOVERED (not in memberry app) |

---

## 2. Business Rule Coverage

### Phase 1 BRs (BR-01 to BR-32)

| BR-ID | Rule | E2E Test File(s) | Status |
|-------|------|-------------------|--------|
| BR-01 | Membership Status Computation | officer/roster.spec.ts | COVERED |
| BR-02 | Grace Period Default | officer/settings.spec.ts | COVERED |
| BR-03 | Membership Transitions | officer/roster.spec.ts | COVERED |
| BR-04 | Dues Amount per Org | journeys/dues-lifecycle.spec.ts, officer/payments.spec.ts, officer/settings.spec.ts | COVERED |
| BR-05 | Fund Allocation | journeys/dues-lifecycle.spec.ts, officer/payments.spec.ts, officer/settings.spec.ts | COVERED |
| BR-06 | Payment Recording | journeys/dues-lifecycle.spec.ts, officer/payments.spec.ts, member/payments.spec.ts | COVERED |
| BR-07 | Dues Expiry Extension on Payment | journeys/dues-lifecycle.spec.ts, member/payments.spec.ts | COVERED |
| BR-08 | Refund Policy | officer/payments.spec.ts | COVERED |
| BR-09 | Officer Role Assignment | officer/guard-enforcement.spec.ts, officer/nav-reachability.spec.ts | COVERED |
| BR-10 | Platform Admin Impersonation | officer/settings.spec.ts | PARTIAL -- settings test references rule, no impersonation exercise |
| BR-11 | Credit Cycle Start | member/credits.spec.ts | COVERED |
| BR-12 | Credit Carry-Over | member/credits.spec.ts, member/credit-carryover.spec.ts | COVERED |
| BR-13 | Auto vs Manual Credits | member/credits.spec.ts, member/training.spec.ts | COVERED |
| BR-14 | Cross-Org Credit Aggregation | member/credits.spec.ts | PARTIAL -- referenced, cross-org scenario not deeply exercised |
| BR-15 | Training vs Event Distinction | journeys/event-lifecycle.spec.ts, member/events.spec.ts, member/training.spec.ts, officer/training.spec.ts, officer/events.spec.ts | COVERED |
| BR-16 | Activity Visibility | officer/events.spec.ts, stubs/wave6/6e-training-visibility.spec.ts | PARTIAL -- officer side covered, member visibility stub only |
| BR-17 | Attendance Confirmation | officer/events.spec.ts | COVERED |
| BR-18 | QR Code Authentication | member/certificates.spec.ts | PARTIAL -- QR auth tested, scanner flow not exercised |
| BR-19 | ID Card Generation | member/certificates.spec.ts | COVERED |
| BR-20 | Certificate Generation | member/certificates.spec.ts | COVERED |
| BR-21 | Multi-Org Member Account | auth.spec.ts | COVERED |
| BR-22 | Member Matching on Import | officer/roster.spec.ts | PARTIAL -- roster tests exist, matching logic not directly tested |
| BR-23 | License Number Format | officer/roster.spec.ts | PARTIAL -- roster test references, format normalization not directly tested |
| BR-24 | Invitation Expiry | auth.spec.ts | COVERED |
| BR-25 | OTP Registration | auth.spec.ts, auth/otp-registration.spec.ts | COVERED |
| BR-26 | Session Management | auth.spec.ts, auth/session-management.spec.ts | COVERED |
| BR-27 | Event Registration Limits | journeys/event-lifecycle.spec.ts, member/events.spec.ts, member/event-capacity.spec.ts, officer/events.spec.ts | COVERED |
| BR-28 | Communication Deduplication | officer/communications.spec.ts | PARTIAL -- comms tested, dedup behavior not directly asserted |
| BR-29 | Org Public Page | journeys/public-org.spec.ts | COVERED |
| BR-30 | Payment Gateway Isolation | officer/settings.spec.ts | PARTIAL -- settings tested, cross-org isolation not directly verified for gateways |
| BR-31 | SVG Upload Security | officer/settings.spec.ts | PARTIAL -- settings tested, SVG sanitization not directly exercised |
| BR-32 | Financial Record Retention | officer/payments.spec.ts | PARTIAL -- payments tested, 7yr retention not directly verified |

### Phase 2 BRs (BR-33 to BR-37)

| BR-ID | Rule | E2E Test File(s) | Status |
|-------|------|-------------------|--------|
| BR-33 | Election Integrity | officer/elections.spec.ts | COVERED |
| BR-34 | Nomination Eligibility | stubs/nomination-eligibility.spec.ts | PARTIAL -- stub has real tests (eligible/ineligible member), but marked as stub |
| BR-35 | Feed Content Moderation | stubs/feed-moderation.spec.ts (auth gate only) | STUB -- module not implemented |
| BR-36 | National Dashboard Access | stubs/national-dashboard.spec.ts (auth gate only) | STUB -- module not implemented |
| BR-37 | Job Posting Expiry | stubs/job-posting-expiry.spec.ts (auth gate only) | STUB -- module not implemented |

### Phase 3 BRs (BR-38 to BR-40)

| BR-ID | Rule | E2E Test File(s) | Status |
|-------|------|-------------------|--------|
| BR-38 | Marketplace Referral Disclosure | stubs/marketplace-referral.spec.ts (auth gate only) | STUB -- module not implemented |
| BR-39 | Committee Dissolution | stubs/committee-dissolution.spec.ts (auth gate only) | STUB -- module not implemented |
| BR-40 | Survey Anonymity | stubs/survey-anonymity.spec.ts (auth gate only) | STUB -- module not implemented |

### Extended BRs (BR-41 to BR-51)

| BR-ID | Rule | E2E Test File(s) | Status |
|-------|------|-------------------|--------|
| BR-41 | Election State Machine Transitions | officer/elections.spec.ts | COVERED |
| BR-42 | One Vote Per Person Per Position | -- | UNCOVERED |
| BR-43 | Voting Only When Status Is votingOpen | officer/elections.spec.ts | COVERED |
| BR-44 | Election Certification Cross-Module Effects | -- | UNCOVERED |
| BR-45 | Credit Entry Requires ActivityName and Positive Amount | -- | UNCOVERED |
| BR-46 | Credit Cycle Auto-Computed | -- | UNCOVERED |
| BR-47 | Banned Users Rejected at Auth Middleware | auth.spec.ts | COVERED |
| BR-48 | Bulk Payment Batch Size Limit | -- | UNCOVERED |
| BR-49 | Active Status Includes Grace Period | -- | UNCOVERED |
| BR-50 | Election Date Ordering DB Constraints | -- | UNCOVERED |
| BR-51 | Internal Service Token Timing-Safe Comparison | -- | UNCOVERED (backend concern) |

---

## 3. Persona Flow Coverage

### P1: Platform Admin (22 flows) -- OUT OF SCOPE

All PA-1 through PA-22 flows are admin app scope. No memberry E2E coverage expected.

| Flow | Description | Status |
|------|-------------|--------|
| PA-1 to PA-22 | All platform admin flows | OUT OF SCOPE (admin app) |

### P2: Chapter President (14 flows)

| Flow | Description | Test File(s) | Status |
|------|-------------|--------------|--------|
| CO-1 | Signup/setup | auth.spec.ts, officer/settings.spec.ts | COVERED |
| CO-7 | Review applications | officer/application-review.spec.ts | COVERED |
| CO-9 | Officer transition | officer/role-assignment.spec.ts | PARTIAL -- assignment tested, transition handoff not fully exercised |
| CO-10 | Edit org settings | officer/settings.spec.ts | COVERED |
| CO-11 | Invite chapter | -- | UNCOVERED |
| CO-12 | Engagement analytics | -- | UNCOVERED |
| CO-13 | Org benchmarking | -- | UNCOVERED |
| CP-1 | First value moment | officer/dashboard.spec.ts | PARTIAL -- dashboard loads, first-value experience not specifically tested |
| CP-2 | Elections | officer/elections.spec.ts | COVERED |
| CP-3 | Roster review | officer/roster.spec.ts | COVERED |
| CP-4 | Platform admin communication | -- | UNCOVERED |
| CP-5 | Financial report review | officer/reports-credits.spec.ts | PARTIAL -- credits report tested, financial report not directly |
| CP-6 | Member suspension | officer/roster.spec.ts (suspend action) | COVERED |
| CP-7 | End-of-term transition | -- | UNCOVERED |

**P2 Score: 7 COVERED, 2 PARTIAL, 5 UNCOVERED (50% covered)**

### P3: Chapter Treasurer (11 flows)

| Flow | Description | Test File(s) | Status |
|------|-------------|--------------|--------|
| CO-6 | Record manual payment | officer/payments.spec.ts, actions/dues-actions.spec.ts | COVERED |
| CO-8 | View financial reports | officer/payments.spec.ts, journeys/dues-lifecycle.spec.ts | COVERED |
| CT-1 | First value moment | officer/dashboard.spec.ts | PARTIAL |
| CT-2 | Batch dues reminders | officer/dues-reminders.spec.ts | COVERED |
| CT-3 | Payment reconciliation | officer/payment-reconciliation.spec.ts | COVERED |
| CT-4 | Periodic report submission | -- | UNCOVERED |
| CT-5 | Dues rate update | officer/settings.spec.ts | COVERED |
| CT-6 | Gateway configuration | officer/settings.spec.ts | PARTIAL -- settings tested, gateway config not deeply exercised |
| CT-7 | Payment refund | officer/payment-refund.spec.ts | COVERED |
| CT-8 | Payment mismatch | officer/payment-correction.spec.ts | COVERED |
| CT-9 | Payment correction | officer/payment-correction.spec.ts | COVERED |

**P3 Score: 8 COVERED, 2 PARTIAL, 1 UNCOVERED (73% covered)**

### P4: Chapter Secretary (13 flows)

| Flow | Description | Test File(s) | Status |
|------|-------------|--------------|--------|
| CO-2 | Compose announcement | officer/communications.spec.ts, actions/comms-elections-actions.spec.ts | COVERED |
| CO-3 | Create event | officer/events.spec.ts, actions/events-actions.spec.ts | COVERED |
| CO-4 | Create training | officer/training.spec.ts, actions/training-actions.spec.ts | COVERED |
| CO-5 | QR check-in | officer/event-checkin.spec.ts | COVERED |
| CO-14 | Add member manually | officer/roster.spec.ts | PARTIAL -- roster tested, manual add not specifically |
| CO-15 | Bulk member import | officer/roster.spec.ts | PARTIAL -- no dedicated import test |
| CS-1 | Roster maintenance | officer/roster.spec.ts, states/roster-states.spec.ts | COVERED |
| CS-2 | Event logistics | officer/events.spec.ts, officer/event-checkin.spec.ts | COVERED |
| CS-3 | Membership reports | officer/reports-credits.spec.ts | PARTIAL |
| CS-4 | Meeting agenda distribution | -- | UNCOVERED |
| CS-5 | Data correction requests | -- | UNCOVERED |
| CS-6 | Deceased member handling | -- | UNCOVERED |
| CS-7 | Member reinstatement | officer/roster.spec.ts (reinstate action) | COVERED |

**P4 Score: 7 COVERED, 3 PARTIAL, 3 UNCOVERED (54% covered)**

### P5: Society Officer (14 flows)

| Flow | Description | Test File(s) | Status |
|------|-------------|--------------|--------|
| SO-1 | Create training course | officer/training.spec.ts | COVERED |
| SO-2 | Manage enrollments | officer/enrollment-management.spec.ts | COVERED |
| SO-3 | Mark completion/award credits | officer/training-completion.spec.ts, member/training-completion-flow.spec.ts | COVERED |
| SO-4 | Training analytics | -- | UNCOVERED |
| SO-5 | Discovery | member/training-browse.spec.ts | PARTIAL -- browse tested, discovery UX not deeply exercised |
| SO-6 | Society onboarding | -- | UNCOVERED |
| SO-7 | First value moment | -- | UNCOVERED |
| SO-8 | Regulatory approval maintenance | -- | UNCOVERED |
| SO-9 | Cross-org promotion | -- | UNCOVERED |
| SO-10 | Society configuration | -- | UNCOVERED |
| SO-11 | Training cancellation | -- | UNCOVERED |
| SO-12 | Credit correction | -- | UNCOVERED |
| SO-13 | Training lifecycle | officer/training.spec.ts, states/training-states.spec.ts | PARTIAL -- create + list tested, full lifecycle not |
| SO-14 | Officer transition | -- | UNCOVERED |

**P5 Score: 3 COVERED, 2 PARTIAL, 9 UNCOVERED (21% covered)**

### P6: Member (27 flows)

| Flow | Description | Test File(s) | Status |
|------|-------------|--------------|--------|
| M-1 | Self-registration | auth.spec.ts, auth/otp-registration.spec.ts | COVERED |
| M-2 | Account claim | auth/account-claim.spec.ts | COVERED |
| M-3 | Pay dues online | member/dues.spec.ts, member/payments.spec.ts, member/pay-token.spec.ts | COVERED |
| M-4 | Register for training + earn credits | member/training.spec.ts, member/training-completion-flow.spec.ts | COVERED |
| M-5 | Register for event | member/events.spec.ts, member/event-capacity.spec.ts | COVERED |
| M-6 | Manual credit entry | member/credits.spec.ts | COVERED |
| M-7 | Cross-org membership | auth.spec.ts ([BR-21]) | PARTIAL -- dashboard multi-org cards, not full cross-org exercise |
| M-8 | Apply via public page | journeys/public-org.spec.ts | PARTIAL -- public page loads, application flow not exercised |
| M-9 | Edit profile/privacy | profile.spec.ts | COVERED |
| M-10 | Browse directory | member/directory.spec.ts | COVERED |
| M-11 | Download ID card | member/certificates.spec.ts | COVERED |
| M-12 | Download certificate | member/certificates.spec.ts | COVERED |
| M-13 | Password reset | auth/password-reset.spec.ts | COVERED |
| M-14 | View dues history | member/dues.spec.ts, member/payments.spec.ts | COVERED |
| M-15 | Manage notifications | settings.spec.ts | COVERED |
| M-16 | Transfer membership | member/transfer.spec.ts | COVERED |
| M-17 | Organic discovery | -- | UNCOVERED |
| M-18 | Contact officer | -- | UNCOVERED |
| M-19 | Gateway unavailable | member/gateway-error.spec.ts | COVERED |
| M-20 | Offline use | -- | UNCOVERED |
| M-21 | Duplicate merge request | -- | UNCOVERED |
| M-22 | Payment dispute | -- | UNCOVERED |
| M-23 | Account lockout | -- | UNCOVERED |
| M-24 | Status transition experience | member/status-display.spec.ts | COVERED |
| M-25 | Account deletion | member/delete-account.spec.ts | COVERED |
| M-26 | Data export | member/data-export.spec.ts | COVERED |
| M-27 | Voluntary org departure | member/leave-org.spec.ts | COVERED |

**P6 Score: 18 COVERED, 2 PARTIAL, 7 UNCOVERED (67% covered)**

---

## 4. State Machine Coverage

Based on WORKFLOW_MAP.md Section 5 (22 state machines) cross-referenced against `states/` directory and related test files.

| State Machine | States Documented | Test File(s) | Transitions Tested | Gaps |
|---------------|-------------------|--------------|-------------------|------|
| Membership Status | Pending, Active, Grace, Lapsed, Suspended, Revoked, Transferred | officer/roster.spec.ts, member/status-display.spec.ts, states/roster-states.spec.ts | Active->Suspended->Active | Pending->Active, Active->Grace->Lapsed not exercised end-to-end |
| Payment Status | Pending, Completed, Failed, Refunded | officer/payments.spec.ts, officer/payment-refund.spec.ts, states/dues-states.spec.ts | Pending->Completed, Completed->Refunded | Failed state not tested |
| Event Status | Draft, Published, Cancelled, Completed | officer/events.spec.ts, states/events-states.spec.ts | Draft->Published | Published->Cancelled, Published->Completed not tested |
| Event Registration | Registered, Waitlisted, Cancelled, Attended | member/events.spec.ts, member/event-capacity.spec.ts | Registered, capacity check | Waitlisted->Registered promotion, Cancelled not tested |
| Training Status | Draft, Published, InProgress, Completed, Cancelled | officer/training.spec.ts, states/training-states.spec.ts | Draft->Published, InProgress->Completed | Cancelled not tested |
| Enrollment Status | Enrolled, Completed, Dropped | officer/enrollment-management.spec.ts, member/training-completion-flow.spec.ts | Enrolled->Completed | Enrolled->Dropped not tested |
| Election Status | Draft, NominationsOpen, VotingOpen, Closed, Certified | officer/elections.spec.ts | Draft->NominationsOpen->VotingOpen->Closed | Certified transition and cross-module effects not tested |
| Announcement Status | Draft, Scheduled, Sent, Failed | officer/communications.spec.ts, states/communications-states.spec.ts | Draft->Sent | Scheduled, Failed not tested |
| Organization Lifecycle | Provisioning, Trial, Active, Suspended, Cancelled | -- | None | Entirely untested (admin app scope) |
| Notification Status | Queued, Sent, Delivered, Read | -- | None | Backend concern, no E2E tests |
| Post (M13) | Draft, Published, Hidden, Removed | stubs/feed-moderation.spec.ts | None (auth gate only) | DEFERRED |
| Job Listing (M15) | Draft, Published, Expired, Closed | stubs/job-posting-expiry.spec.ts | None (auth gate only) | DEFERRED |
| Campaign (M16) | Draft, Active, Paused, Completed | -- | None | DEFERRED |
| Creative (M16) | Pending, Approved, Rejected | -- | None | DEFERRED |
| Survey (M18) | Draft, Active, Closed | stubs/survey-anonymity.spec.ts | None (auth gate only) | DEFERRED |
| Vendor (M17) | Pending, Verified, Suspended, Rejected | stubs/marketplace-referral.spec.ts | None (auth gate only) | DEFERRED |
| Committee (M19) | Active, Expired, Dissolved, Renewed | stubs/committee-dissolution.spec.ts | None (auth gate only) | DEFERRED |
| Task (M19) | Open, InProgress, Completed, Overdue | -- | None | DEFERRED |
| Document (M11) | Draft, Published, Archived | -- | None | No document lifecycle E2E test |
| Onboarding (M01) | Started, InProgress, Completed, Resumed | member/onboarding.spec.ts | Started->InProgress | Resumed not tested |
| Invitation Token (M01) | Pending, Claimed, Expired | auth.spec.ts, auth/account-claim.spec.ts | Pending->Expired tested | Pending->Claimed tested via account-claim |
| Email Queue | Pending, Sent, Failed | -- | None | Backend concern |

---

## 5. Summary

### Coverage Totals

| Metric | Covered | Partial | Uncovered | Deferred | Total | Coverage % |
|--------|---------|---------|-----------|----------|-------|------------|
| **Workflows (M01-M12)** | 46 | 12 | 12 | -- | 70 | 66% COVERED, 83% COVERED+PARTIAL |
| **Workflows (M13-M19, Cross)** | 0 | 0 | 6 | 38 | 44 | DEFERRED |
| **Workflows (All)** | 46 | 12 | 18 | 38 | 114 | 40% COVERED |
| **Business Rules (BR-01 to BR-32)** | 22 | 10 | 0 | -- | 32 | 69% COVERED, 100% COVERED+PARTIAL |
| **Business Rules (BR-33 to BR-51)** | 5 | 1 | 7 | 6 | 19 | 26% COVERED |
| **Business Rules (All)** | 27 | 11 | 7 | 6 | 51 | 53% COVERED, 75% COVERED+PARTIAL |
| **Persona P2 Flows** | 7 | 2 | 5 | -- | 14 | 50% |
| **Persona P3 Flows** | 8 | 2 | 1 | -- | 11 | 73% |
| **Persona P4 Flows** | 7 | 3 | 3 | -- | 13 | 54% |
| **Persona P5 Flows** | 3 | 2 | 9 | -- | 14 | 21% |
| **Persona P6 Flows** | 18 | 2 | 7 | -- | 27 | 67% |
| **State Machines (Implemented)** | 3 | 8 | 0 | -- | 11 | 27% fully tested |

### Cross-Cutting Test Assets

The test suite also includes valuable cross-cutting tests not mapped to specific workflows:
- **role-boundaries.spec.ts** -- 15 tests verifying RBAC (member/treasurer/secretary restrictions)
- **cross-org-isolation.spec.ts** -- 3 IDOR prevention tests
- **security.spec.ts** -- 4 auth gate tests
- **infrastructure.spec.ts** -- 5 test infrastructure validation tests
- **mobile/viewport.spec.ts** -- 7 responsive layout tests
- **states/*.spec.ts** -- 10 files covering loading/success/error/permission/a11y states
- **actions/*.spec.ts** -- 10 files covering real CRUD operations across modules

### Top Priority Gaps (Ordered by Risk)

#### P0 -- Security/Data Integrity

1. **BR-42: One Vote Per Person Per Position** -- Election integrity rule with no E2E test. Allows double-voting if broken.
2. **BR-44: Election Certification Cross-Module Effects** -- Officer role auto-assignment from election results untested.
3. **BR-48: Bulk Payment Batch Size Limit** -- Financial safety rule, no E2E test.
4. **BR-49: Active Status Includes Grace Period** -- Membership computation edge case, untested.
5. **WF-007: MFA Enrollment** -- No TOTP E2E test. Security feature gap.

#### P1 -- Revenue/Core Flows

6. **WF-045: Payment Receipt Generation** -- No receipt download test. Revenue-adjacent.
7. **WF-054: Event Cancellation** -- No cancellation + refund E2E flow.
8. **WF-062: Paid Training Payment Gate** -- Payment before enrollment not tested.
9. **P5 Society Officer coverage at 21%** -- Weakest persona. SO-4 through SO-14 mostly uncovered.
10. **State machine transitions** -- Most state machines only test 1-2 transitions out of 3-5.

#### P2 -- Completeness

11. **WF-033: Membership Categories** -- CRUD not tested.
12. **WF-047/048/050: Communications (templates, stats, opt-out)** -- Only send/dashboard tested.
13. **WF-073/074/075: Document Management** -- No E2E coverage.
14. **WF-066: Credit Cycle Configuration** -- Admin config not tested.
15. **BR-45/46: Credit entry validation and auto-compute** -- No E2E assertion.

### Recommendations

1. **Immediate:** Add E2E tests for BR-42 (double-vote prevention) and BR-44 (election->officer transition). These are data integrity risks in a governance module.
2. **Next sprint:** Cover WF-054 (event cancellation), WF-045 (receipts), WF-062 (paid training gate). Revenue-impacting gaps.
3. **Society Officer persona:** P5 at 21% is the weakest. Add SO-4 (training analytics), SO-11 (training cancellation), SO-12 (credit correction) as minimum viable coverage.
4. **State machine depth:** Expand existing state tests to cover failure/cancellation transitions (Payment Failed, Event Cancelled, Training Cancelled, Enrollment Dropped).
5. **Deferred modules (M13-M19):** Current stub tests only check auth gates. When these modules are implemented, each needs full workflow coverage. The stubs provide a good skeleton.
