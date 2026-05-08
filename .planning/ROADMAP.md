# Roadmap: Memberry

## Milestones

- ✅ **v1.0.0 Foundation** — Phases 0-10 (shipped 2026-05-07)
- 🔄 **v1.1.0 Auth & Permission Enforcement** — Phases 11-16 (TDD)

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

- [ ] **Phase 12: Backend Auth — Route Protection**
  - RED: Write ~35 API tests asserting member gets 403 on officer endpoints
  - RED: Write cross-org isolation (IDOR) tests — officer of Org A blocked from Org B
  - GREEN: Add `officerAuthMiddleware()` to hand-wired `app.ts` routes (org profile, roster, applications, dues dashboard, payments, gateway)
  - GREEN: Add role middleware to generated `/association/*` mutation routes (events, training, elections, dues, communications)
  - GREEN: Ensure `orgContextMiddleware` validates officer's org scope
  - **Verify:** Member gets 403 on all officer endpoints. Cross-org blocked.
  - **Deps:** Phase 11
  - **Est:** 2-3 days
  - **Plans:** 6 plans
    - [ ] 12-01-PLAN.md — RED: hand-wired route officer protection tests
    - [ ] 12-02-PLAN.md — RED: association mutation route officer protection tests
    - [ ] 12-03-PLAN.md — GREEN: wire officerAuthMiddleware to app.ts + create requireOfficerTerm utility
    - [ ] 12-03b-PLAN.md — GREEN: add requireOfficerTerm to association:operations handlers
    - [ ] 12-03c-PLAN.md — GREEN: add requireOfficerTerm to association:member handlers
    - [ ] 12-04-PLAN.md — Seed second org officer + IDOR tests

- [ ] **Phase 13: Position-Based RBAC**
  - RED: Write position-specific API tests (Treasurer-only, President-only, Secretary-allowed endpoints)
  - GREEN: Create `requirePosition(positions[])` middleware checking `officer_term` table
  - GREEN: Wire `requirePosition` to each route group per permission matrix
  - GREEN: Update `officer-sidebar.tsx` to filter nav by position
  - GREEN: Update `requireOrgOfficer` guard to pass position info to route context
  - **Verify:** Each role sees only their sections. Cross-position mutations blocked.
  - **Deps:** Phase 12
  - **Est:** 2-3 days
  - **Plans:** 5 plans
    - [ ] 13-01-PLAN.md — RED tests + requirePosition utility + position titles constants
    - [ ] 13-02-PLAN.md — Wire requirePosition to 16 member + communications handlers
    - [ ] 13-03-PLAN.md — Wire requirePosition to 13 operations handlers
    - [ ] 13-04-PLAN.md — Wire requirePosition to app.ts inline routes + verify GREEN
    - [ ] 13-05-PLAN.md — Frontend sidebar position filtering

- [ ] **Phase 14: Negative E2E Tests — Role Boundaries**
  - RED->GREEN: Member cannot access officer routes (6 tests)
  - RED->GREEN: Treasurer cannot create events/send announcements (5 tests)
  - RED->GREEN: Secretary cannot record payments/refunds/configure gateway (5 tests)
  - RED->GREEN: Cross-org isolation E2E (3 tests)
  - **Verify:** All 19 negative tests pass
  - **Deps:** Phase 13
  - **Est:** 1-2 days

- [ ] **Phase 15: Dues Reminder UI + BR Edge Cases**
  - RED: Batch dues reminder trigger — treasurer sends reminders to filtered members
  - RED: Dunning template CRUD — treasurer creates/edits templates
  - GREEN: Build reminder trigger UI, wire to existing dunning API
  - RED: Dues expiry extension logic (BR-07) — extend from current expiry, not today
  - RED: Fund allocation rounding (BR-05) — last fund absorbs remainder
  - RED: Refund reversal (BR-08) — reverses expiry, status auto-recomputes
  - RED: Membership state machine (BR-03) — valid transitions only, invalid silently rejected
  - RED: Event registration limits (BR-27) — waitlist promotion, late cancellation
  - GREEN: Verify/fix all BR logic
  - **Verify:** All BR edge cases pass. Reminder UI works.
  - **Deps:** Phase 13
  - **Est:** 2-3 days

- [ ] **Phase 16: Mobile & Transfer Validation**
  - RED: Transfer lifecycle E2E — member initiates, source approves, target approves
  - RED: Mobile viewport tests (375x812) — dashboard, officer nav, payment form, event registration
  - GREEN: Fix layout issues found
  - GREEN: Validate existing transfer UI + API flow
  - **Verify:** Core flows work on mobile. Transfer lifecycle completes.
  - **Deps:** Phase 14
  - **Est:** 1-2 days

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
| 11. Test Infrastructure & Seed Users | v1.1.0 | 3/3 | Complete   | 2026-05-08 |
| 12. Backend Auth — Route Protection | v1.1.0 | 0/6 | Not Started | -- |
| 13. Position-Based RBAC | v1.1.0 | 0/5 | Not Started | -- |
| 14. Negative E2E Tests — Role Boundaries | v1.1.0 | 0/0 | Not Started | -- |
| 15. Dues Reminder UI + BR Edge Cases | v1.1.0 | 0/0 | Not Started | -- |
| 16. Mobile & Transfer Validation | v1.1.0 | 0/0 | Not Started | -- |
