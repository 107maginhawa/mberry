# Roadmap: Memberry

## Milestones

- ✅ **v1.0.0 Foundation** — Phases 0-10 (shipped 2026-05-07)
- ✅ **v1.1.0 Auth & Permission Enforcement** — Phases 11-17 (shipped 2026-05-13)
- ✅ **v1.2.0 Pilot Launch** — Phases 18-25 (shipped 2026-05-14)
- ✅ **v1.3.0 Test Confidence** — Phases 26-33 (shipped 2026-05-15)
- ✅ **v1.4.0 Brownfield Rescue Cycle 1** — Phases 34-37 (shipped 2026-05-20)
- ✅ **v1.5.0 Brownfield Rescue Cycle 2** — Phases 38-45 (shipped 2026-05-20)

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

<details>
<summary>✅ v1.2.0 Pilot Launch (Phases 18-25) — SHIPPED 2026-05-14</summary>

**Goal:** Ship all compliance-critical and officer-essential features to launch the first live pilot with a Philippine dental association.

- [x] **Phase 18: Dues Invoice Security Fix** — Enforce org-scoped RBAC on dues endpoints (2026-05-14)
- [x] **Phase 19: Account Deletion + Data Export** — PH DPA compliance (deletion, anonymization, export) (completed 2026-05-13)
- [x] **Phase 20: Payment Flow** — Offline payment recording with receipts and concurrency safety (completed 2026-05-13)
- [x] **Phase 21: Officer Daily Ops** — Roster, bulk approvals, filtering with scoped validation (completed 2026-05-14)
- [x] **Phase 22: PRC CPD Compliance** — Accreditation fields, credit categories, compliance summary (completed 2026-05-14)
- [x] **Phase 23: Member Departure + Deceased** — Lifecycle termination status enum, billing exclusion (completed 2026-05-14)
- [x] **Phase 24: Quality Gap Closure** — Roster 500 fix, audit filter bug, BR-35 through BR-40 (completed 2026-05-14)
- [x] **Phase 25: Email/Notif Guards + Handler Tests** — Rate limiting, bounce suppression, deceased guard, unsubscribe (completed 2026-05-14)

</details>

### v1.3.0 Test Confidence (Phases 26-33)

**Goal:** Close test coverage gaps identified by adversarial audit. Formalize the T1-T8 TDD backfill — fix CI gates, rewrite stub tests, add frontend component tests, upgrade E2E from existence-checks to behavioral, complete flow registry.

**Reference:** `.claude/plans/spicy-sniffing-lynx.md` (full T1-T8 plan with agent-verified data)

- [x] **Phase 26: CI Gaps + Infrastructure Fixes (T1)** — Wire test:registry to CI, fix meaningless assertions, add test:br script
- [x] **Phase 27: Backend Handler Test Depth (T2)** — Rewrite pure-function stubs in elections/membership to use makeCtx+stubRepo
- [x] **Phase 28: BR Edge Cases + Integration Strategy (T3)** — Deepen BR-32/33/34, shrink KNOWN_INCOMPLETE from 5→2
- [x] **Phase 29: Frontend Components — Dues/Membership/Dashboard (T4)** — 20 new component tests, coverage 24/46 (52%)
- [x] **Phase 30: Frontend Components — Remaining Modules (T5)** — 22 new component tests, coverage 46/46 (100%)
- [x] **Phase 31: E2E Behavioral Upgrade (T6)** — KNOWN_INCOMPLETE 2→0, upgraded shallow E2E specs
- [x] **Phase 32: Flow Registry Completion (T7)** — FLOW-03/09 covered, FLOW-04/07/08/10 deferred (60% flow coverage)
- [x] **Phase 33: Ratchet + Shallow-Test Lint (T8)** — Vitest thresholds ratcheted, lint:shallow in CI, QA matrix updated

### v1.4.0 Brownfield Rescue Cycle 1 (Phases 34-37)

**Goal:** Resolve remaining compliance violations (V-07 through V-20) identified by `/oli-audit-compliance`. All P0 violations resolved in prior milestones. No critical stabilization needed — all work is improvement or spec alignment.

**Generated by:** `/oli-magic --auto` from `EXISTING_CODEBASE_ADOPTION_AUDIT.md` + `COMPLIANCE_REPORT.md`

- [x] **Phase 34: Wave G1 — Stabilization** — Membership input validation, grace period bounds, election test gaps (3/3 plans, completed 2026-05-20)
- [x] **Phase 35: Wave G2 — Training Refactor** — Credit cycle start date fix in markComplete (1/1 plan, completed 2026-05-20)
- [x] **Phase 36: Wave G3 — Architecture Cleanup** — Cross-context decoupling, comms consolidation doc (2/2 plans, completed 2026-05-20)
- [x] **Phase 37: Wave G4 — New Capabilities** — Concurrent session limits (1/1 plan, completed 2026-05-20)

### v1.5.0 Brownfield Rescue Cycle 2 (Phases 38-45)

**Goal:** Frontend quality, type safety, accessibility, and validation hardening across all 3 apps. Fresh findings from codebase exploration — raw HTML bypassing component library, `as any` type erosion, weak ARIA coverage, generic error UX, query invalidation bugs.

**Generated by:** `/oli-magic` Cycle 2 from fresh codebase exploration (2026-05-20)

**Waves:**
- [x] **Phase 38: Wave H1a — Query Key Alignment + State Sync** — Fixed dues query invalidation + state sync (completed 2026-05-20)
- [x] **Phase 39: Wave H1b — Terminology Alignment** — Aligned terminated→removed across stack (completed 2026-05-20)
- [x] **Phase 40: Wave H2a — Raw HTML Replacement + Accessibility** — 21 raw HTML→@monobase/ui, 51 role="alert" added (completed 2026-05-20)
- [x] **Phase 41: Wave H2b — Input Validation Hardening** — All 11 forms wired with react-hook-form+zod (completed 2026-05-20)
- [x] **Phase 42: Wave H3a — Type Safety: Dues + Membership** — 24 as-any eliminated (completed 2026-05-20)
- [x] **Phase 43: Wave H3b — Type Safety: All Apps + Backend** — 108 files, zero unjustified as-any (completed 2026-05-20)
- [x] **Phase 44: Wave H4 — P2/P3 Violation Sweep + Test Health** — 362/0 frontend, 4238/0 backend (completed 2026-05-20)
- [x] **Phase 45: Wave H5 — Regression Gates + Final Audit** — ESLint rules enforced, final scorecard written (completed 2026-05-20)

## Phase Details

### Phase 34: Wave G1 — Stabilization
**Goal:** Fix remaining P1/P2 stabilization items in elections and membership modules. Sequential — changes touch shared auth/validation patterns.

**Requirements:**
- S-001 (V-07): Add minimum 2-candidate check before transitioning election to `votingOpen` (BR-33 gap in transition logic, not castVote)
- S-002 (V-20): Add Zod validation on `body.status` in `updateMember.ts` — currently accepts any string
- S-003 (V-10): Validate grace period days 0-90 range at API level in dues config handlers
- S-012 (V-07/BR-34): Add E2E test for nomination eligibility (PARTIAL → COMPLETE)

**Success Criteria:**
- Election cannot transition to votingOpen with < 2 candidates for any position
- updateMember rejects invalid status values with 400
- Grace period outside 0-90 rejected with validation error
- BR-34 has backend + contract + E2E coverage

**Mode:** tdd
**Depends on:** (none)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 35: Wave G2 — Training & Membership Refactors
**Goal:** Align training credit logic and membership terminology with spec. Independent modules — parallel safe.

**Requirements:**
- S-004 (V-12): Fix credit cycle start to use member registration date, not activity date
- S-005 (V-13): Implement 50% credit carry-over cap per BR-12
- S-006 (V-14): Add license number normalization (strip whitespace, uppercase) in importMembers
- S-007 (V-17): Standardize memberNumber vs licenseNumber — use licenseNumber per glossary

**Success Criteria:**
- Credit cycle start date derived from membership registration
- Carry-over credits capped at 50% of required
- License numbers normalized on import
- Codebase uses consistent `licenseNumber` term

**Mode:** tdd
**Depends on:** Phase 34
**Status:** not-started
**Disk Status:** not-started

---

### Phase 36: Wave G3 — Architecture Cleanup
**Goal:** Reduce cross-module coupling and improve TypeSpec coverage. Independent tracks — parallel safe.

**Requirements:**
- S-008 (V-18): Decouple `registerForEvent.ts` from direct MembershipRepository import — use service layer or event
- S-009 (V-16): Document comms module consolidation plan (communication + comms + email → unified strategy)
- S-010 (V-19): Add TypeSpec definitions for remaining hand-wired modules (training, events, elections, certificates, invite)

**Success Criteria:**
- registerForEvent uses membership check via service, not direct repo import
- `docs/architecture/COMMS-CONSOLIDATION.md` documents merge plan with migration steps
- TypeSpec coverage ≥ 80% (from ~60%)

**Mode:** tdd
**Depends on:** Phase 34
**Status:** not-started
**Disk Status:** not-started

**Integration test required:** S-008 (cross-module)

---

### Phase 37: Wave G4 — New Capabilities
**Goal:** Implement spec features not yet in code. Parallel safe — independent from prior waves.

**Requirements:**
- S-011 (V-15): Add concurrent session limit (configurable, default 5) via Better-Auth
- S-013 (V-22-V-29): Track remaining P3 items — cross-org credit aggregation, ID card generation, OTP audit, org public page (backlog, not blocking)

**Success Criteria:**
- Users exceeding session limit get oldest session revoked
- P3 items logged in backlog with rationale for deferral

**Mode:** tdd
**Depends on:** Phase 35, Phase 36
**Status:** not-started
**Disk Status:** not-started

---

### Phase 38: Wave H1a — Query Key Alignment + State Sync Fix
**Goal:** Fix data-correctness bugs in dues module query invalidation and state sync.

**Requirements:**
- S-C2-001: Replace string literal query keys with generated functions from @monobase/sdk-ts
- S-C2-002: Add x-org-id header to invalidation key in dues-config-form.tsx
- S-C2-003: Replace manual syncedRef/prevOrgIdRef with proper useEffect cleanup keyed on orgId

**Success Criteria:**
- Zero string literal query keys in dues module
- Org-switch properly invalidates cached data
- Component test proves stale data eliminated

**Mode:** tdd
**Depends on:** (none)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 39: Wave H1b — Terminology Alignment
**Goal:** Resolve terminology splits: `terminated` vs `removed` membership status AND `orgId` vs `organizationId` inconsistency (42 vs 47 usages).

**Requirements:**
- S-C2-004 (V-09 carry): Audit TypeSpec, generated validators, handler logic, and frontend display. Align membership status to single canonical term. Regenerate.
- S-C2-029: Unify `orgId`/`organizationId` naming across frontend and handler code. 593 route params ($orgId) are structural — DON'T touch. Scope: 78 variable declarations + 126 organizationId references. Pick canonical form, search-replace with verification.

**Success Criteria:**
- grep confirms single membership status vocabulary
- TypeSpec, validators, handlers, and UI all match
- `orgId` vs `organizationId` usage converged to single canonical form
- Terminology dimension target: 9/10

**Mode:** tdd
**Depends on:** (none)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 40: Wave H2a — Raw HTML Replacement + Accessibility (ALL APPS)
**Goal:** Replace all raw HTML elements with @monobase/ui primitives across all 3 apps. Add ARIA to error states.

**Requirements:**
- S-C2-005: Replace raw `<button>` in payment-history-table.tsx with Button
- S-C2-006: Replace raw `<input>` in 10 memberry locations with Input from @monobase/ui
- S-C2-007: Add `role="alert"` + `aria-live="polite"` to all error state divs. Create shared `<ErrorState>` component.
- S-C2-008: Add retry buttons to error states wiring `refetch()` from query hooks
- S-C2-024: Replace 8 raw `<input>` in admin app routes

**Success Criteria:**
- Zero raw `<button>`/`<input>`/`<select>`/`<textarea>` in production code (test mocks exempt)
- All error states have `role="alert"`
- All data-fetch error states have retry button

**Mode:** tdd
**Depends on:** (none)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 41: Wave H2b — Input Validation Hardening (react-hook-form + zod)
**Goal:** Add client-side validation to all financial forms using the already-installed react-hook-form + zod + @hookform/resolvers stack.

**Requirements:**
- S-C2-009: Negative amount rejection, amount > 0, date sanity, currency format — via zod schemas
- S-C2-010: `aria-describedby` linking inputs to error messages
- S-C2-025: Wire react-hook-form into 11 forms that currently use uncontrolled state

**Success Criteria:**
- All 11 forms use zod schemas + react-hook-form
- Invalid input rejected client-side with accessible error messages
- Validation errors linked via `aria-describedby`

**Mode:** tdd
**Depends on:** Phase 40 (uses ErrorState pattern)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 42: Wave H3a — Type Safety: Dues + Membership
**Goal:** Eliminate `as any` casts in dues (15) and membership (9) modules.

**Requirements:**
- S-C2-011: Fix dues `as any` — add TypeSpec for hand-wired endpoints or create typed wrapper hooks
- S-C2-012: Fix membership `as any` — same approach

**Success Criteria:**
- Zero `as any` in dues + membership production code
- `tsc --noEmit` passes across all workspaces

**Mode:** tdd
**Depends on:** Phase 38 (query key changes may affect types)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 43: Wave H3b — Type Safety: All Apps + Backend
**Goal:** Eliminate remaining `as any` casts across events, training, elections, admin, account, and backend notification triggers.

**Requirements:**
- S-C2-013..016: Fix all remaining memberry `as any` casts (~40)
- S-C2-026: Fix admin app `as any` (4 real, excl routeTree.gen.ts)
- S-C2-027: Audit + fix account app `as any` (~22, separate generated from real)
- S-C2-028: Fix backend `as any` in notification triggers — add proper types for eventStartsAt, eventName, position
- S-C2-019: Add `no-explicit-any` ESLint rule (error for new code, warning for existing)

**Success Criteria:**
- Production `as any` ≤ 5 across all apps (routeTree.gen.ts exempted)
- Backend handlers zero `as any`
- ESLint rule prevents regression

**Mode:** tdd
**Depends on:** Phase 42 (pattern established)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 44: Wave H4 — P2/P3 Sweep + Test Health
**Goal:** Close carry-forward violations, fix failing/skipped tests, push backend test coverage to 9/10.

**Requirements:**
- S-C2-017: Re-audit — triage which P2s were resolved by H1-H3 waves. Fix survivors.
- S-C2-018: Triage P3s — fix quick wins, defer remaining with documented rationale.
- S-C2-030: Fix 32 failing tests and resolve 27 skipped/todo tests (fix or document-defer).

**Success Criteria:**
- Open P2 violations ≤ 2
- All P3s either fixed or explicitly deferred with rationale
- Zero failing tests, zero unexplained skips
- Backend test coverage dimension: 9/10

**Mode:** tdd
**Depends on:** Phases 38-43 (must run after all prior waves)
**Status:** not-started
**Disk Status:** not-started

---

### Phase 45: Wave H5 — Regression Gates + Final Audit
**Goal:** Lock in quality gains with lint rules, coverage ratchets, and final audit. All feasible scores to 9.

**Requirements:**
- S-C2-020: Custom ESLint rule `no-raw-html-elements` for all apps
- S-C2-021: Update coverage ratchets for new component tests
- S-C2-022: Final compliance re-audit (target ≥ 9.0)
- S-C2-023: Final confidence re-audit (target ≥ 9.0)

**Success Criteria:**
- Codebase health ≥ 9.0
- Compliance score ≥ 9.0
- Confidence score ≥ 9.0
- P0 = 0, P1 = 0, P2 ≤ 2
- All feasible health dimensions at 9/10
- Graduation re-confirmed for Cycle 2

**Mode:** tdd
**Depends on:** Phase 44
**Status:** not-started
**Disk Status:** not-started

---

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
**Plans:** 6/6 plans complete
Plans:
- [x] 25-01-PLAN.md -- Schema extensions + suppression repo + unsub tokens + bulk rate limiter
- [x] 25-02-PLAN.md -- Processor guards (suppression, deceased, rate limit) + unsubscribe header injection
- [x] 25-03-PLAN.md -- Unsubscribe endpoint (RFC 8058) + list suppressions handler
- [x] 25-04-PLAN.md -- Handler tests: communication (27) + person (22)
- [x] 25-05-PLAN.md -- Handler tests: notifs (4) + platformadmin (17) + documents (15) + billing (11)
- [x] 25-06-PLAN.md -- Handler tests: training (5) + reviews (3) + events (1) + system (3) + booking (15) + membership (4) + invite (1)

### Phase 26: CI Gaps + Infrastructure Fixes (T1)
**Goal**: All test quality gates are wired into CI — no regressions can slip through undetected
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. `bun run test:registry` runs in CI coverage-gate job
  2. No `expect(true).toBe(true)` non-sentinel assertions exist in codebase
  3. Root package.json has `test:br` script for local BR coverage checks
**Plans:** 2 plans
Plans:
- [x] 26-01-PLAN.md — Fix meaningless assertions + add test:br script
- [x] 26-02-PLAN.md — Wire coverage-gate job into CI workflow

### Phase 27: Backend Handler Test Depth (T2)
**Goal**: Every handler test calls its real handler function — no pure-function stubs remain
**Depends on**: Phase 26
**Success Criteria** (what must be TRUE):
  1. `br-33.election-integrity.test.ts` imports and calls real election handlers with makeCtx+stubRepo
  2. `br-34.nomination-eligibility.test.ts` imports and calls real nomination handlers
  3. `br-p2-gap.test.ts` calls real handlers instead of asserting on hardcoded objects
  4. Zero tests define and assert on inline functions without importing production code
Plans: not yet planned

### Phase 28: BR Edge Cases + Integration Strategy (T3)
**Goal**: BR-32/33/34 removed from KNOWN_INCOMPLETE — coverage depth matches their rule class requirements
**Depends on**: Phase 27 (stubs must be rewritten before deepening)
**Success Criteria** (what must be TRUE):
  1. BR-32 has handler test asserting soft-delete behavior
  2. BR-33 has tests for duplicate vote prevention and minimum candidate check
  3. BR-34 has tests for deadline enforcement and ineligible member rejection
  4. `bun run scripts/br-coverage.ts --ci` KNOWN_INCOMPLETE = 2 (only BR-01, BR-03)
Plans: not yet planned

### Phase 29: Frontend Components — Dues/Membership/Dashboard (T4)
**Goal**: High-value frontend components have Vitest+RTL tests — coverage goes from 7% to ~50%
**Depends on**: Nothing (parallel with T1-T3)
**Success Criteria** (what must be TRUE):
  1. 21 new `.test.tsx` files in dues/ (13), membership/ (5), dashboard/ (6) components
  2. `cd apps/memberry && bun run test` passes
  3. Component inventory shows ≥24/46 tested
Plans: not yet planned

### Phase 30: Frontend Components — Remaining Modules (T5)
**Goal**: Frontend component coverage reaches 90%+
**Depends on**: Phase 29 (build on factory/pattern established in T4)
**Success Criteria** (what must be TRUE):
  1. ~22 new `.test.tsx` files across training, events, elections, communications, etc.
  2. Component inventory shows ≥43/46 tested
  3. `cd apps/memberry && bun run test` passes
Plans: not yet planned

### Phase 31: E2E Behavioral Upgrade (T6)
**Goal**: Key E2E tests verify real behavior, not just page presence. BR-01 and BR-03 close.
**Depends on**: Phase 28 (BR-33/34 handler tests exist before E2E)
**Success Criteria** (what must be TRUE):
  1. BR-01 E2E verifies membership status transitions (active→expired, pending→active)
  2. BR-03 E2E verifies renewal flow end-to-end (payment → status → confirmation)
  3. `bun run scripts/br-coverage.ts --ci` KNOWN_INCOMPLETE = 0
  4. Society Officer persona coverage ≥ 70%
  5. 5-10 existing shallow specs upgraded with form interaction / network intercepts
Plans: not yet planned

### Phase 32: Flow Registry Completion (T7)
**Goal**: Flow registry partial flows are resolved — either tested or explicitly deferred
**Depends on**: Phase 28 (flow tests need handler depth)
**Success Criteria** (what must be TRUE):
  1. FLOW-03 (notification side effect) implemented and tested → status: covered
  2. FLOW-09 gap investigated and resolved
  3. FLOW-04/07/08/10 either implemented+tested or marked DEFERRED with rationale
  4. `bun run test:registry` reflects updated flow coverage
Plans: not yet planned

### Phase 33: Ratchet + Shallow-Test Lint (T8)
**Goal**: All coverage metrics are ratcheted — future regressions are impossible
**Depends on**: Phases 30, 31, 32 (ratchet locks in gains from all prior work)
**Success Criteria** (what must be TRUE):
  1. Vitest thresholds in memberry + account configs match actual post-backfill coverage
  2. `scripts/lint-shallow-tests.ts` exists and runs in CI (informational)
  3. `docs/QA-COVERAGE-MATRIX.md` reflects final state
Plans: not yet planned

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
| 25. Email/Notif Guards + Handler Tests | v1.2.0 | 6/6 | Complete   | 2026-05-14 |
| 26. CI Gaps + Infrastructure Fixes (T1) | v1.3.0 | 2/2 | Complete | 2026-05-15 |
| 27. Backend Handler Test Depth (T2) | v1.3.0 | 1/1 | Complete | 2026-05-15 |
| 28. BR Edge Cases + Integration Strategy (T3) | v1.3.0 | 1/1 | Complete | 2026-05-15 |
| 29. Frontend Components — Dues/Membership/Dashboard (T4) | v1.3.0 | 3/3 | Complete | 2026-05-15 |
| 30. Frontend Components — Remaining Modules (T5) | v1.3.0 | 3/3 | Complete | 2026-05-15 |
| 31. E2E Behavioral Upgrade (T6) | v1.3.0 | 1/1 | Complete | 2026-05-15 |
| 32. Flow Registry Completion (T7) | v1.3.0 | 1/1 | Complete | 2026-05-15 |
| 33. Ratchet + Shallow-Test Lint (T8) | v1.3.0 | 1/1 | Complete | 2026-05-15 |
| 34. Wave G1 — Stabilization | v1.4.0 | 3/3 | Complete | 2026-05-20 |
| 35. Wave G2 — Training Refactor | v1.4.0 | 1/1 | Complete | 2026-05-20 |
| 36. Wave G3 — Architecture Cleanup | v1.4.0 | 2/2 | Complete | 2026-05-20 |
| 37. Wave G4 — New Capabilities | v1.4.0 | 1/1 | Complete | 2026-05-20 |
| 38. Wave H1a — Query Key Alignment + State Sync | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 39. Wave H1b — Terminology Alignment | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 40. Wave H2a — Raw HTML + Accessibility | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 41. Wave H2b — Input Validation Hardening | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 42. Wave H3a — Type Safety: Dues + Membership | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 43. Wave H3b — Type Safety: All Apps + Backend | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 44. Wave H4 — P2/P3 Sweep + Test Health | v1.5.0 | 1/1 | Complete | 2026-05-20 |
| 45. Wave H5 — Regression Gates + Final Audit | v1.5.0 | 1/1 | Complete | 2026-05-20 |
