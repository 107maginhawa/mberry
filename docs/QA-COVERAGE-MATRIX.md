# QA Coverage Matrix — Memberry

Updated 2026-05-11. Cross-references routes, business rules, user journeys, and test coverage.

## Route Matrix (30/30 passing)

| # | Route | Loads | Data | E2E Tests | BR Coverage | Journey Coverage |
|---|-------|-------|------|-----------|-------------|-----------------|
| 1 | /dashboard | ✅ | ✅ | 6 tests (dashboard.spec) | — | M-17, CO-1, CT-1, CP-1 |
| 2 | /my/profile | ✅ | ✅ | 5 tests (profile.spec) | BR-23 (license format) | M-9 |
| 3 | /my/settings | ✅ | ✅ | 5 tests (settings.spec) | BR-26 (sessions) | M-15 |
| 4 | /my/certificates | ✅ | ✅ | 4 tests (certificates.spec) | BR-20 (cert gen) | M-12 |
| 5 | /my/credits | ✅ | ✅ | 4 tests (credits.spec) | BR-11,12,13,14 | M-4, M-6 |
| 6 | /my/events | ✅ | ✅ | 3 tests (events.spec) | BR-27 (reg limits) | M-5 |
| 7 | /my/payments | ✅ | ✅ | 3 tests (payments.spec) | BR-04,06,07 | M-3, M-14 |
| 8 | /my/training | ✅ | ✅ | 2 tests (training.spec) | BR-15,16 | M-4 |
| 9 | /my/id-card | ✅ | ✅ | in certificates.spec | BR-18,19 (QR/ID) | M-11 |
| 10 | /my/data-export | ✅ | ✅ | 2 tests (data-export.spec) | BR-32 (retention) | M-26 |
| 11 | /my/notifications | ✅ | ✅ | in profile-settings-actions | BR-28 (dedup) | M-15 |
| 12 | /my/organizations | ✅ | ✅ | in profile-settings-actions | BR-21 (multi-org) | M-7, M-27 |
| 13 | officer/dashboard | ✅ | ✅ | 3 tests (officer/dashboard) | — | CO-1 |
| 14 | officer/roster | ✅ | ✅ | 6 tests (roster.spec) | BR-22 (matching) | CS-1 |
| 15 | officer/events | ✅ | ✅ | 7 tests (officer/events) | BR-15,16,17,27 | CO-3, CS-2 |
| 16 | officer/training | ✅ | ✅ | 4 tests (officer/training) | BR-15,17 | CO-4, SO-1 |
| 17 | officer/elections (list) | ✅ | ✅ | 4 tests (elections.spec) | BR-33,34 | CP-2 |
| 18 | officer/elections/$id | ✅ | ✅ | in elections.spec | BR-33,34 | CP-2 |
| 19 | officer/communications | ✅ | ✅ | 4 tests (communications) | BR-28 (dedup) | CO-2 |
| 20 | officer/payments | ✅ | ✅ | 6 tests (payments.spec) | BR-06,07,08 | CO-6, CT-1 |
| 21 | officer/officers | ✅ | ✅ | 5 tests (officers-admin) | BR-09 (roles) | CO-9 |
| 22 | settings/dues | ✅ | ✅ | in settings.spec | BR-04 (dues amt) | CT-5 |
| 23 | settings/funds | ✅ | ✅ | in settings.spec | BR-05 (allocation) | CT-5 |
| 24 | settings/categories | ✅ | ✅ | in settings.spec | — | CS-1 |
| 25 | settings/gateway | ✅ | ✅ | in settings.spec | BR-30 (isolation) | CT-6 |
| 26 | settings/chapters | ✅ | ✅ | in settings.spec | — | CO-11 |
| 27 | settings/org | ✅ | ✅ | in settings.spec | BR-31 (SVG) | CO-10 |
| 28 | reports/credits | ✅ | ✅ | 3 tests (reports-credits) | BR-11,14 | SO-4 |
| 29 | reports/financial | ✅ | ✅ | in dues-actions | BR-32 | CT-4 |
| 30 | roster/import | ✅ | ✅ | in membership-actions | BR-22 (matching) | CO-15 |

---

## Business Rule Coverage (40 BRs)

### Phase 1 BRs (BR-01 to BR-32)

| BR | Description | Unit Tests | E2E Tests | Status |
|----|-------------|-----------|-----------|--------|
| **BR-01** | Membership status computation | ✅ repo tests | ❌ no E2E | **GAP** — no E2E verifying status transitions on UI |
| **BR-02** | Grace period (30 days) | ✅ repo tests | ❌ no E2E | **GAP** — grace period behavior not E2E tested |
| **BR-03** | Membership state machine | ✅ repo tests | ❌ no E2E | **GAP** — transition rules not E2E tested |
| **BR-04** | Dues amount per org | ✅ handler tests | ✅ settings.spec | OK |
| **BR-05** | Fund allocation (sum=100%) | ✅ handler tests | ✅ settings.spec | OK |
| **BR-06** | Payment recording | ✅ handler tests | ✅ dues-actions | OK |
| **BR-07** | Dues expiry extension | ✅ handler tests | ✅ payment-expiry.spec | OK |
| **BR-08** | Refund policy | ✅ handler tests | ✅ payment-refund.spec | OK |
| **BR-09** | Officer role assignment | ✅ handler tests | ✅ officers-admin | OK |
| **BR-10** | Platform admin impersonation | ❌ | ❌ | **GAP** — not implemented (Phase 1 P0) |
| **BR-11** | Credit cycle start | ✅ handler tests | ✅ credits.spec | OK |
| **BR-12** | Credit carry-over | ✅ handler tests | ✅ credit-carryover.spec | OK |
| **BR-13** | Auto vs manual credits | ✅ handler tests | ✅ credits.spec | OK |
| **BR-14** | Cross-org credit aggregation | ✅ handler tests | ✅ credits.spec | OK |
| **BR-15** | Training vs event distinction | ✅ handler tests | ✅ events/training | OK |
| **BR-16** | Activity visibility | ✅ handler tests | partial | **PARTIAL** — visibility toggle not E2E tested |
| **BR-17** | Attendance confirmation | ✅ handler tests | ✅ event-checkin.spec | OK |
| **BR-18** | QR code authentication | ✅ handler tests | ✅ certificates | OK |
| **BR-19** | ID card generation | ✅ handler tests | ✅ certificates | OK |
| **BR-20** | Certificate generation | ✅ handler tests | ✅ certificates | OK |
| **BR-21** | Multi-org member account | ✅ handler tests | ✅ organizations | OK |
| **BR-22** | Member matching on import | ✅ handler tests | ✅ import | OK |
| **BR-23** | License number format | ✅ handler tests | ✅ profile | OK |
| **BR-24** | Invitation expiry (7 days) | ✅ handler tests | ✅ auth.spec | OK |
| **BR-25** | OTP registration | ✅ handler tests | ✅ otp-registration.spec | OK |
| **BR-26** | Session management | ✅ handler tests | ✅ security.spec | OK |
| **BR-27** | Event registration limits | ✅ handler tests | ✅ event-capacity.spec | OK |
| **BR-28** | Communication deduplication | ✅ handler tests | ❌ no E2E | **GAP** — dedup not verifiable in E2E |
| **BR-29** | Org public page | ✅ handler tests | ✅ public-org | OK |
| **BR-30** | Payment gateway isolation | ✅ handler tests | ✅ gateway | OK |
| **BR-31** | SVG upload security | ✅ handler tests | ❌ no E2E | **GAP** — sanitization not E2E tested |
| **BR-32** | Financial record retention | ✅ handler tests | partial | **PARTIAL** — retention policy not directly tested |

### Phase 2 BRs (BR-33 to BR-37) — stub tests only

| BR | Description | Unit Tests | E2E Tests | Status |
|----|-------------|-----------|-----------|--------|
| **BR-33** | Election integrity | partial | stub (404/501) | **STUB** — elections work but integrity rules not tested |
| **BR-34** | Nomination eligibility | ❌ | stub | **STUB** |
| **BR-35** | Feed content moderation | ❌ | stub | **NOT IMPL** |
| **BR-36** | National dashboard access | ❌ | stub | **NOT IMPL** |
| **BR-37** | Job posting expiry | ❌ | stub | **NOT IMPL** |

### Phase 3 BRs (BR-38 to BR-40) — stub tests only

| BR | Description | Unit Tests | E2E Tests | Status |
|----|-------------|-----------|-----------|--------|
| **BR-38** | Marketplace referral | ❌ | stub | **NOT IMPL** |
| **BR-39** | Committee dissolution | ❌ | stub | **NOT IMPL** |
| **BR-40** | Survey anonymity | ❌ | stub | **NOT IMPL** |

---

## User Journey Coverage (107 journeys)

### P6: Member (27 journeys)

| Journey | Description | E2E? | Gap? |
|---------|-------------|------|------|
| M-1 | Self-registration | ✅ auth.spec | |
| M-2 | Account claim | ✅ account-claim.spec | |
| M-3 | Pay dues online | ✅ dues-actions | |
| M-4 | Register for training + earn credits | ✅ training-browse | |
| M-5 | Register for event | ✅ events-actions | |
| M-6 | Manual credit entry | ✅ credits.spec | |
| M-7 | Cross-org membership | ✅ profile-settings | |
| M-8 | Apply via public page | ✅ public-org | |
| M-9 | Edit profile/privacy | ✅ profile.spec | |
| M-10 | Browse directory | ✅ directory.spec | |
| M-11 | Download ID card | ✅ certificates | |
| M-12 | Download certificate | ✅ certificates | |
| M-13 | Password reset | ✅ password-reset.spec | |
| M-14 | View dues history | ✅ payments.spec | |
| M-15 | Manage notifications | ✅ settings.spec | |
| M-16 | Transfer membership | ✅ transfer.spec | |
| M-17 | Organic discovery (dashboard) | ✅ dashboard.spec | |
| M-18 | Contact officer | ❌ | **GAP** — not implemented |
| M-19 | Gateway unavailable fallback | ✅ gateway-error.spec | |
| M-20 | Offline use | ❌ | **GAP** — PWA not E2E testable |
| M-21 | Duplicate merge request | ❌ | **GAP** — not implemented |
| M-22 | Payment dispute | ❌ | **GAP** — not implemented |
| M-23 | Account lockout | ❌ | **GAP** — not E2E tested |
| M-24 | Status transition experience | ✅ status-display.spec | |
| M-25 | Account deletion | ✅ delete-account.spec | |
| M-26 | Data export | ✅ data-export.spec | |
| M-27 | Voluntary org departure | ✅ leave-org.spec | |

**Member coverage: 22/27 (81%)**

### P2: Chapter President (14 journeys)

| Journey | Description | E2E? | Gap? |
|---------|-------------|------|------|
| CO-1 | Signup/setup | ✅ auth.spec | |
| CO-2 | Compose announcement | ✅ comms-elections | |
| CO-3 | Create event | ✅ events-actions | |
| CO-4 | Create training | ✅ training-actions | |
| CO-5 | QR check-in | ✅ event-checkin.spec | |
| CO-6 | Record manual payment | ✅ dues-actions | |
| CO-7 | Review applications | ✅ application-review.spec | |
| CO-9 | Officer transition | ✅ role-assignment.spec | |
| CO-10 | Edit org settings | ✅ settings.spec | |
| CO-11 | Invite chapter | ✅ chapters.spec | |
| CO-12 | Engagement analytics | ❌ | **GAP** — not implemented |
| CO-13 | Org benchmarking | ❌ | **GAP** — not implemented |
| CP-1 | First value moment | ✅ dashboard.spec | |
| CP-2 | Elections | ✅ elections.spec | |

**President coverage: 12/14 (86%)**

### P3: Treasurer (11 journeys)

| Journey | Description | E2E? | Gap? |
|---------|-------------|------|------|
| CO-6 | Record manual payment | ✅ dues-actions | |
| CO-8 | View financial reports | ✅ dues-actions | |
| CT-1 | First value moment | ✅ dashboard | |
| CT-2 | Batch dues reminders | ✅ dues-reminders.spec | |
| CT-3 | Payment reconciliation | ✅ payment-reconciliation.spec | |
| CT-4 | Periodic reports | ✅ reports-credits | |
| CT-5 | Dues rate update | ✅ settings.spec | |
| CT-6 | Gateway config | ✅ settings.spec | |
| CT-7 | Payment refund | ✅ payment-refund.spec | |
| CT-8 | Payment mismatch | ❌ | **GAP** — not implemented |
| CT-9 | Payment correction | ✅ payment-correction.spec | |

**Treasurer coverage: 10/11 (91%)**

### P4: Secretary (13 journeys)

| Journey | Description | E2E? | Gap? |
|---------|-------------|------|------|
| CO-2 | Compose announcement | ✅ comms-elections | |
| CO-3 | Create event | ✅ events-actions | |
| CO-4 | Create training | ✅ training-actions | |
| CO-5 | QR check-in | ✅ event-checkin.spec | |
| CO-14 | Add member manually | ❌ | **GAP** — manual add not tested |
| CO-15 | Bulk member import | ✅ membership-actions | |
| CS-1 | Roster maintenance | ✅ roster.spec | |
| CS-2 | Event logistics | partial | **PARTIAL** — basic test only |
| CS-3 | Membership reports | ❌ | **GAP** — not tested |
| CS-4 | Meeting agenda distribution | ❌ | **GAP** — not implemented |
| CS-5 | Data correction requests | ❌ | **GAP** — not implemented |
| CS-6 | Deceased member handling | ❌ | **GAP** — not implemented |
| CS-7 | Member reinstatement | ❌ | **GAP** — not tested |

**Secretary coverage: 6/13 (46%)**

### P5: Society Officer (14 journeys)

| Journey | Description | E2E? | Gap? |
|---------|-------------|------|------|
| SO-1 | Create training course | ✅ training-actions | |
| SO-2 | Manage enrollments | ✅ enrollment-management.spec | |
| SO-3 | Mark completion/award credits | ✅ training-completion.spec | |
| SO-4 | Training analytics | ❌ | **GAP** — not implemented |
| SO-5 | Discovery | ❌ | **GAP** — not implemented |
| SO-6 | Society onboarding | ❌ | **GAP** — not implemented |
| SO-7 | First value moment | ✅ dashboard | |
| SO-8 | Regulatory approval | ❌ | **GAP** — not implemented |
| SO-9 | Cross-org promotion | ❌ | **GAP** — not tested |
| SO-10 | Society configuration | ❌ | **GAP** — not implemented |
| SO-11 | Training cancellation | ❌ | **GAP** — not tested |
| SO-12 | Credit correction | ❌ | **GAP** — not tested |
| SO-13 | Training lifecycle | ❌ | **GAP** — lifecycle states not tested |
| SO-14 | Officer transition | ❌ | **GAP** — not tested |

**Society Officer coverage: 4/14 (29%)**

### P1: Platform Admin (22 journeys)

| Journey | Description | E2E? | Status |
|---------|-------------|------|--------|
| PA-1 to PA-22 | All admin journeys | ❌ | **NOT IMPL** — admin app exists but no E2E tests |

**Platform Admin coverage: 0/22 (0%)**

---

## Summary

### Overall Test Coverage

| Metric | Count |
|--------|-------|
| Routes passing | 30/30 (100%) |
| E2E test files | 69 |
| E2E test cases | 271 |
| Business rules (Phase 1) | 28/32 covered (88%) |
| Business rules (Phase 2-3) | 0/8 implemented |
| Member journeys | 22/27 (81%) |
| President journeys | 12/14 (86%) |
| Treasurer journeys | 10/11 (91%) |
| Secretary journeys | 6/13 (46%) |
| Society Officer journeys | 4/14 (29%) |
| Platform Admin journeys | 0/22 (0%) |
| **Total journey coverage** | **54/107 (50%)** |

### Remaining Gaps (actionable now)

1. **BR-01/02/03** — Membership status transitions (Active→Grace→Lapsed) not E2E tested
2. **BR-16** — Activity visibility toggle not E2E tested
3. **BR-28** — Communication deduplication not verifiable in E2E
4. **BR-31** — SVG upload sanitization not E2E tested
5. **BR-32** — Financial record retention not directly tested
6. **CT-8** — Payment mismatch not implemented

### Not-Yet-Implemented (skip for now)

- Phase 2: Elections integrity (BR-33/34 partial), Feed moderation (BR-35), National dashboard (BR-36), Jobs (BR-37)
- Phase 3: Marketplace (BR-38), Committees (BR-39), Surveys (BR-40)
- Platform Admin: All 22 journeys (admin app exists but minimal)
- Member: Contact officer (M-18), Offline (M-20), Merge (M-21), Dispute (M-22)
- Wave 6: 21 test.fixme stubs for features not yet built
