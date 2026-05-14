# Roadmap: Memberry

## Milestones

- ✅ **v1.0.0 Foundation** — Phases 0-10 (shipped 2026-05-07)
- ✅ **v1.1.0 Auth & Permission Enforcement** — Phases 11-17 (shipped 2026-05-13)
- 🔄 **v1.2.0 Pilot Launch** — Phases 18-25 (in progress)

## Phases

<details>
<summary>✅ v1.0.0 Foundation (Phases 0-10) — SHIPPED 2026-05-07</summary>

- [x] Phase 0: Test Retrofit & CI Foundation (3 plans, superseded) — completed 2026-05-06
- [x] Phase 1: Billing Schema Completion (2/2 plans) — completed 2026-05-06
- [x] Phase 2: Audit Module Completion (3/3 plans) — completed 2026-05-06
- [x] Phase 3: Data Model Unification (4/4 plans) — completed 2026-05-06
- [x] Phase 4: TypeSpec/OpenAPI Reconciliation (11/11 plans) — completed 2026-05-06
- [x] Phase 5: Account & Admin App Hardening (4/4 plans) — completed 2026-05-06
- [x] Phase 6: CI/CD & DevOps Pipeline (3/3 plans) — completed 2026-05-06
- [x] Phase 7: Shared Component Library (3/3 plans) — completed 2026-05-06
- [x] Phase 8: Frontend Unit Tests (3/3 plans) — completed 2026-05-06
- [x] Phase 9: Test Infrastructure Hardening (2/2 plans) — completed 2026-05-06
- [x] Phase 10: Deploy Platform Decision (1/1 plan) — completed 2026-05-06

</details>

<details>
<summary>✅ v1.1.0 Auth & Permission Enforcement (Phases 11-17) — SHIPPED 2026-05-13</summary>

### v1.1.0 Auth & Permission Enforcement (TDD)

**Goal:** Fix authorization gaps found by UAT audit + Codex cross-review. Every phase uses TDD — failing tests first, then implementation.

**Reference:** `docs/TDD-AUTH-PLAN.md` (full plan), `docs/UAT-CHECKLIST.md` (267 testable items)

- [x] **Phase 11: Test Infrastructure & Seed Users** (completed 2026-05-08)
  - Create 3 dedicated officer test users (Treasurer, Secretary, Society Officer)
  - Add officer_term records linking each to correct position
  - Create `apiAs(email)` test helper for role-based API calls
  - Update E2E test config with new user constants
  - **Verify:** All 5 users login, correct positions in DB
  - **Deps:** None
  - **Est:** 2-3 hours
  - **Plans:** 3 plans
    - [x] 11-01-PLAN.md -- Seed script + E2E config (3 officers, 4 positions, 4 terms)
    - [x] 11-02-PLAN.md -- apiAs() test helper (TDD)
    - [x] 11-03-PLAN.md -- Seed user verification tests

- [x] **Phase 12: Backend Auth — Route Protection** (completed 2026-05-13)
  - RED: Write ~35 API tests asserting member gets 403 on officer endpoints
  - RED: Write cross-org isolation (IDOR) tests — officer of Org A blocked from Org B
  - GREEN: Add `officerAuthMiddleware()` to hand-wired `app.ts` routes (org profile, roster, applications, dues dashboard, payments, gateway)
  - GREEN: Add role middleware to generated `/association/*` mutation routes (events, training, elections, dues, communications)
  - GREEN: Ensure `orgContextMiddleware` validates officer's org scope
  - **Verify:** Member gets 403 on all officer endpoints. Cross-org blocked.
  - **Deps:** Phase 11
  - **Est:** 2-3 days
  - **Plans:** 6 plans
    - [x] 12-01-PLAN.md — RED: hand-wired route officer protection tests
    - [x] 12-02-PLAN.md — RED: association mutation route officer protection tests
    - [x] 12-03-PLAN.md — GREEN: wire officerAuthMiddleware to app.ts + create requireOfficerTerm utility
    - [x] 12-03b-PLAN.md — GREEN: add requireOfficerTerm to association:operations handlers
    - [x] 12-03c-PLAN.md — GREEN: add requireOfficerTerm to association:member handlers
    - [x] 12-04-PLAN.md — Seed second org officer + IDOR tests

- [x] **Phase 13: Position-Based RBAC** (completed 2026-05-13)
  - RED: Write position-specific API tests (Treasurer-only, President-only, Secretary-allowed endpoints)
  - GREEN: Create `requirePosition(positions[])` middleware checking `officer_term` table
  - GREEN: Wire `requirePosition` to each route group per permission matrix
  - GREEN: Update `officer-sidebar.tsx` to filter nav by position
  - GREEN: Update `requireOrgOfficer` guard to pass position info to route context
  - **Verify:** Each role sees only their sections. Cross-position mutations blocked.
  - **Deps:** Phase 12
  - **Est:** 2-3 days
  - **Plans:** 5 plans
    - [x] 13-01-PLAN.md — RED tests + requirePosition utility + position titles constants
    - [x] 13-02-PLAN.md — Wire requirePosition to 16 member + communications handlers
    - [x] 13-03-PLAN.md — Wire requirePosition to 13 operations handlers
    - [x] 13-04-PLAN.md — Wire requirePosition to app.ts inline routes + verify GREEN
    - [x] 13-05-PLAN.md — Frontend sidebar position filtering

- [x] **Phase 14: Negative E2E Tests — Role Boundaries** (completed 2026-05-13)
  - RED->GREEN: Member cannot access officer routes (6 tests)
  - RED->GREEN: Treasurer cannot create events/send announcements (5 tests)
  - RED->GREEN: Secretary cannot record payments/refunds/configure gateway (5 tests)
  - RED->GREEN: Cross-org isolation E2E (3 tests)
  - **Verify:** All 19 negative tests pass
  - **Deps:** Phase 13
  - **Est:** 1-2 days
  - **Plans:** 2 plans
    - [x] 14-01-PLAN.md — Role boundary E2E tests (member, treasurer, secretary restrictions)
    - [x] 14-02-PLAN.md — Cross-org isolation E2E tests

- [x] **Phase 15: Dues Reminder UI + BR Edge Cases** (completed 2026-05-13)
  - Batch dues reminder trigger — replace TODO placeholders with real notification creation
  - Dunning template CRUD — implement 7 handler stubs (schema + repo + handlers)
  - Integration verification — response shape matching + integration test
  - ~~BR-03, BR-05, BR-07, BR-08, BR-27~~ — already done in Phase 17
  - **Verify:** Reminder processor creates notifications. Dunning CRUD works. All tests pass.
  - **Deps:** Phase 13
  - **Est:** 1-2 days
  - **Plans:** 3 plans
    - [x] 15-01-PLAN.md — Batch dues reminder backend (schema + processor + handler)
    - [x] 15-02-PLAN.md — Dunning template CRUD (schema + repo + 7 handlers)
    - [x] 15-03-PLAN.md — Integration verification (response shape + integration test)

- [x] **Phase 16: Mobile & Transfer Validation** (completed 2026-05-13)
  - RED->GREEN: Transfer lifecycle tests — 16 unit tests covering full state machine (create -> approve -> complete, deny, reverse order, invalid transitions)
  - RED->GREEN: Mobile viewport tests (375x812) — 9 E2E tests across dashboard, officer nav, payments, org pages
  - Added mobile Playwright project (Chromium with 375x812 viewport)
  - **Verify:** 2181 API tests pass. 9 mobile E2E tests pass. No regressions.
  - **Deps:** Phase 14
  - **Plans:** 2 plans
    - [x] 16-01-PLAN.md — Transfer lifecycle unit tests (16 tests, 6 handlers)
    - [x] 16-02-PLAN.md — Mobile viewport E2E tests (9 tests, Playwright config)

- [x] **Phase 17: Domain Design Remediation** (Codex-verified audit, completed 2026-05-13)
  - Wave 0.5: Fix 3 new Codex P1s (dues-config form, cross-org tier validation)
  - Wave 1: Fix payment/membership invariants (refund, transactions, lifecycle service, billingFrequency, dead code cleanup)
  - Wave 2: Fix election invariants (BR-33, BR-34, voter validation, role enforcement)
  - Wave 3: DB constraints (unique indexes, FKs, CHECK constraints, position normalization)
  - **Verify:** All 2123+ tests pass per wave. No regressions.
  - **Deps:** None (independent of auth phases)
  - **Est:** 3-5 days
  - **Plans:** 15 plans (00a-00c, 01-15)
    - [x] 15-00a-PLAN.md — Dues config form payload fix
    - [x] 15-00b-PLAN.md — Dues config create vs PATCH
    - [x] 15-00c-PLAN.md — Cross-org tier validation
    - [x] 15-01-PLAN.md — Fix live refund (BR-08)
    - [x] 15-02-PLAN.md — approveMembershipApplication transaction
    - [x] 15-03-PLAN.md — recordDuesPayment outer transaction
    - [x] 15-04-PLAN.md — Lifecycle service
    - [x] 15-05-PLAN.md — Consume billingFrequency
    - [x] 15-06-PLAN.md — Delete dead handlers/dues/ files
    - [x] 15-07-PLAN.md — BR-34 nomination eligibility
    - [x] 15-08-PLAN.md — BR-33 two candidates per position
    - [x] 15-09-PLAN.md — Voter/nominee/position validation
    - [x] 15-10-PLAN.md — President-only certification
    - [x] 15-11-PLAN.md — Role enforcement on election handlers
    - [x] 15-12-PLAN.md — Unique (org, person) on memberships
    - [x] 15-13-PLAN.md — Unique (election_id, voter_id, position_id) on votes
    - [x] 15-14-PLAN.md — Missing FK constraints
    - [x] 15-15-PLAN.md — Temporal CHECK + election position normalization

</details>

### v1.2.0 Pilot Launch (Phases 18-25)

**Goal:** Ship all compliance-critical and officer-essential features to launch the first live pilot with a Philippine dental association.

- [x] **Phase 18: Dues Invoice Security Fix** — Enforce org-scoped RBAC on dues endpoints (2026-05-14)
- [x] **Phase 19: Account Deletion + Data Export** — PH DPA compliance (deletion, anonymization, export) (completed 2026-05-13)
- [x] **Phase 20: Payment Flow** — Offline payment recording with receipts and concurrency safety (completed 2026-05-13)
- [x] **Phase 21: Officer Daily Ops** — Roster, bulk approvals, filtering with scoped validation (completed 2026-05-14)
- [x] **Phase 22: PRC CPD Compliance** — Accreditation fields, credit categories, compliance summary (completed 2026-05-14)
- [x] **Phase 23: Member Departure + Deceased** — Lifecycle termination status enum, billing exclusion (completed 2026-05-14)
- [x] **Phase 24: Quality Gap Closure** — Roster 500 fix, audit filter bug, BR-35 through BR-40 (completed 2026-05-14)
- [ ] **Phase 25: Email/Notif Guards + Handler Tests** — Rate limiting, bounce suppression, deceased guard, unsubscribe

## Phase Details

### Phase 18: Dues Invoice Security Fix
**Goal**: Dues invoice endpoints enforce org-scoped authorization so only chapter officers can mark invoices paid or query dues data for their own chapter
**Depends on**: Nothing (first phase of v1.2.0 — critical security path)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. A member calling markDuesInvoicePaid receives 403 (officer role required)
  2. An officer of Org A cannot mark invoices paid for Org B (chapter scope enforced)
  3. Dues query endpoints return 403 when caller has no membership in the queried organization
  4. Existing officer payment flows continue to work correctly (no regression)
**Plans:** 2/2 plans executed
Plans:
- [x] 18-01-PLAN.md — RED: Security tests for mutation + read handler auth gaps
- [x] 18-02-PLAN.md — GREEN: Apply requirePosition + cross-org isolation to 11 handlers

### Phase 19: Account Deletion + Data Export
**Goal**: Users can request deletion of their account (with 30-day grace and cancellation) and export all personal data as machine-readable JSON, satisfying Philippine Data Privacy Act requirements
**Depends on**: Nothing (independent compliance work)
**Requirements**: DPA-01, DPA-02, DPA-03, DPA-04, DPA-05, DPA-06
**Success Criteria** (what must be TRUE):
  1. Member can request account deletion from account settings; receives confirmation with 30-day notice
  2. Member can cancel a pending deletion request before the 30-day window closes
  3. After 30 days, scheduled job anonymizes PII in-place (name, email, phone replaced); financial records preserved
  4. Member can download a JSON export covering profile, memberships, payments, training, certificates, and events
  5. Audit log entries for anonymization writes do not capture PII in the before_state payload
**Plans:** 2/2 plans complete
Plans:
- [x] 19-01-PLAN.md — Backend: deletion processor job, export gap fill (certs+events), anonymization fix, session cleanup, tests
- [x] 19-02-PLAN.md — Frontend: account deletion/export UI on settings page

### Phase 20: Payment Flow
**Goal**: Officers can record offline dues payments (GCash, bank transfer), generate member-viewable receipts, and the system prevents double-payment via optimistic locking
**Depends on**: Phase 18 (needs RBAC fix before payment mutation endpoints are safe)
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. Officer can record an offline payment against an open invoice specifying method and reference number
  2. Recorded payment changes invoice status to paid and generates a receipt record
  3. Member can view their own payment receipt; officer can view receipts for chapter members
  4. Concurrent recording of payment on the same invoice by two officers results in exactly one success and one conflict error (no double-payment)
**Plans:** 2/2 plans complete
Plans:
- [x] 20-01-PLAN.md — Optimistic locking on markPaid + wire invoice linking in recordDuesPayment
- [x] 20-02-PLAN.md — Self-service personId enforcement in listDuesPayments
**UI hint**: yes

### Phase 21: Officer Daily Ops
**Goal**: Officers have a functional chapter management dashboard — roster with dues/training status, bulk membership approvals with partial success, and status filters — all validated at per-record org scope
**Depends on**: Phase 18 (RBAC fix ensures roster and bulk endpoints are secure)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Officer can load chapter roster showing member name, dues status, and training credit summary in a single request (server-side JOIN, no N+1)
  2. Officer can bulk approve a list of membership applications and receive a partial-success response identifying which succeeded and which failed
  3. Bulk approval validates organization scope per record (an officer cannot approve applications outside their chapter even in a mixed-org batch)
  4. Officer can filter roster by membership status, dues status, and training compliance and receive correctly filtered results
**Plans:** 4/4 plans complete
Plans:
- [x] 21-01-PLAN.md — TypeSpec models + codegen (OfficerRosterMember, BulkApprove, new query params)
- [x] 21-02-PLAN.md — Roster handler + repo extension with JOIN + DB-level filters
- [x] 21-03-PLAN.md — Bulk approve handler with per-record org scope validation
- [x] 21-04-PLAN.md — Frontend: roster dues/training columns + filters, bulk approve UI
**UI hint**: yes

### Phase 22: PRC CPD Compliance
**Goal**: Training events and credit entries carry PRC accreditation metadata, officers can view per-member CPD compliance summaries, and an accredited providers registry tracks provider status and expiry
**Depends on**: Nothing (independent of security and payment work)
**Requirements**: PRC-01, PRC-02, PRC-03, PRC-04
**Success Criteria** (what must be TRUE):
  1. Training event creation accepts and stores PRC accreditation number and accredited provider reference
  2. CPD credit entries store category, approval code, and verification status alongside the credit hours
  3. Officer can view a compliance summary per member showing total credits earned vs required for the current CPD cycle
  4. Accredited providers registry shows provider list with status (active/suspended/expired) and highlights providers with expiry within 30 days
**Plans:** 4/4 plans complete
Plans:
- [x] 22-01-PLAN.md — Schema extensions (training PRC fields, credit entry CPD fields, accredited_provider table)
- [x] 22-02-PLAN.md — Accredited provider CRUD handlers + route registration + tests
- [x] 22-03-PLAN.md — Training/credit entry handler updates + compliance byCategory extension
- [x] 22-04-PLAN.md — Frontend: compliance category columns + provider registry page + sidebar
**UI hint**: yes

### Phase 23: Member Departure + Deceased
**Goal**: Officers can record member resignation or death with proper status codes, and departed/deceased members are automatically excluded from dues billing and notification sends
**Depends on**: Nothing (independent lifecycle work; email guards in Phase 25 will consume deceased flag)
**Requirements**: LIF-01, LIF-02, LIF-03, LIF-04
**Success Criteria** (what must be TRUE):
  1. Officer can mark a member as resigned with a termination reason code; the membership record reflects status `resigned`
  2. Officer can mark a member as deceased with a date of death; the membership record reflects status `deceased`
  3. The membership status field uses an enum supporting resigned, deceased, expelled, and lapsed (not a boolean)
  4. Departed and deceased members are excluded from dues invoice generation and bulk notification sends
**Plans:** 3/3 plans complete
Plans:
- [x] 23-01-PLAN.md -- Schema + TypeSpec enum extension + codegen (resigned, deceased, expelled, dateOfDeath)
- [x] 23-02-PLAN.md -- resignMembership + deceaseMembership handlers with TDD
- [x] 23-03-PLAN.md -- Billing/notification exclusion guard tests (LIF-03)

### Phase 24: Quality Gap Closure
**Goal**: Three pre-existing defects are resolved: the roster API 500, the audit log filter bug, and the deferred BR-35 through BR-40 business rules
**Depends on**: Nothing (independent bug fixes and deferred rules)
**Requirements**: QAL-01, QAL-02, QAL-03
**Success Criteria** (what must be TRUE):
  1. GET /association/member/roster returns 200 with data (no longer throws 500 on handler param mismatch)
  2. Audit log queries with eventType and/or category params return only matching records (filter actually applied)
  3. BR-35 through BR-40 are implemented with corresponding unit tests that pass
**Plans:** 2/2 plans complete
Plans:
- [x] 24-01-PLAN.md — Audit log filter fix (TypeSpec @query params + codegen + tests)
- [x] 24-02-PLAN.md — Roster 500 fix + BR-35/BR-40 registry path correction

### Phase 25: Email/Notif Guards + Handler Tests
**Goal**: Email infrastructure is hardened with rate limiting, bounce suppression, and a deceased/departed guard; remaining untested handlers have unit test coverage
**Depends on**: Phase 23 (deceased flag must exist before the guard can check it)
**Requirements**: EML-01, EML-02, EML-03, EML-04, EML-05
**Success Criteria** (what must be TRUE):
  1. Bulk email sends are rate-limited; transactional emails (password reset, receipt) bypass rate limits and deliver immediately
  2. A hard bounce on any address suppresses that address from all future sends; the suppression list is queryable by officers
  3. Sending email or push notification to a deceased or departed member is blocked at the send layer (not silently queued)
  4. All email messages include a one-click unsubscribe header and a visible unsubscribe link; clicking either suppresses the address
  5. All previously untested API handlers have unit test coverage with passing tests
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Test Retrofit & CI Foundation | v1.0.0 | 0/3 (superseded) | Complete | 2026-05-06 |
| 1. Billing Schema Completion | v1.0.0 | 2/2 | Complete | 2026-05-06 |
| 2. Audit Module Completion | v1.0.0 | 3/3 | Complete | 2026-05-06 |
| 3. Data Model Unification | v1.0.0 | 4/4 | Complete | 2026-05-06 |
| 4. TypeSpec/OpenAPI Reconciliation | v1.0.0 | 11/11 | Complete | 2026-05-06 |
| 5. Account & Admin App Hardening | v1.0.0 | 4/4 | Complete | 2026-05-06 |
| 6. CI/CD & DevOps Pipeline | v1.0.0 | 3/3 | Complete | 2026-05-06 |
| 7. Shared Component Library | v1.0.0 | 3/3 | Complete | 2026-05-06 |
| 8. Frontend Unit Tests | v1.0.0 | 3/3 | Complete | 2026-05-06 |
| 9. Test Infrastructure Hardening | v1.0.0 | 2/2 | Complete | 2026-05-06 |
| 10. Deploy Platform Decision | v1.0.0 | 1/1 | Complete | 2026-05-06 |
| 11. Test Infrastructure & Seed Users | v1.1.0 | 3/3 | Complete | 2026-05-08 |
| 12. Backend Auth — Route Protection | v1.1.0 | 6/6 | Complete | 2026-05-13 |
| 13. Position-Based RBAC | v1.1.0 | 5/5 | Complete | 2026-05-13 |
| 14. Negative E2E Tests — Role Boundaries | v1.1.0 | 2/2 | Complete | 2026-05-13 |
| 15. Dues Reminder UI + BR Edge Cases | v1.1.0 | 3/3 | Complete | 2026-05-13 |
| 16. Mobile & Transfer Validation | v1.1.0 | 2/2 | Complete | 2026-05-13 |
| 17. Domain Design Remediation | v1.1.0 | 18/18 | Complete | 2026-05-13 |
| 18. Dues Invoice Security Fix | v1.2.0 | 2/2 | Complete | 2026-05-14 |
| 19. Account Deletion + Data Export | v1.2.0 | 2/2 | Complete   | 2026-05-13 |
| 20. Payment Flow | v1.2.0 | 2/2 | Complete   | 2026-05-13 |
| 21. Officer Daily Ops | v1.2.0 | 4/4 | Complete   | 2026-05-14 |
| 22. PRC CPD Compliance | v1.2.0 | 4/4 | Complete   | 2026-05-14 |
| 23. Member Departure + Deceased | v1.2.0 | 3/3 | Complete   | 2026-05-14 |
| 24. Quality Gap Closure | v1.2.0 | 2/2 | Complete   | 2026-05-14 |
| 25. Email/Notif Guards + Handler Tests | v1.2.0 | 0/? | Not started | — |
