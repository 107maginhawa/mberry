# Roadmap: Memberry

## Overview

Memberry is a brownfield healthcare AMS with 9 base modules and 6 custom domain modules already implemented. This milestone focuses on hardening the existing codebase: completing the test safety net, finishing incomplete modules (billing, audit), unifying the dual data model, reconciling TypeSpec definitions, and building CI/CD and shared UI infrastructure. Phase 0 establishes the safety net that all other phases depend on.

## Phases

**Phase Numbering:**
- Integer phases (0-8): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 0: Test Retrofit & CI Foundation** - Complete test coverage safety net for safe refactoring
- [x] **Phase 1: Billing Schema Completion** - Complete the billing module with all TODO fields and access controls
- [x] **Phase 2: Audit Module Completion** - Full audit trail for compliance across all modules
- [ ] **Phase 3: Data Model Unification** - Single canonical schema replacing dual custom/TypeSpec models
- [x] **Phase 4: TypeSpec/OpenAPI Reconciliation** - Spec-first definitions for all 6 custom modules
- [ ] **Phase 5: Account & Admin App Hardening** - E2E test coverage for account and admin apps
- [ ] **Phase 6: CI/CD & DevOps Pipeline** - Production-ready build, test, and deploy workflows
- [ ] **Phase 7: Shared Component Library** - DRY up duplicated UI components across apps
- [ ] **Phase 8: Frontend Unit Tests** - Component-level test coverage for critical Memberry components

## Phase Details

### Phase 0: Test Retrofit & CI Foundation
**Goal**: Every existing feature has a passing test, enabling safe refactoring in later phases
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-08
**Success Criteria** (what must be TRUE):
  1. All 40 business rules have passing E2E tests (up from 33/40)
  2. E2E tests run against deterministic fixtures, not hardcoded seed data
  3. `bun run test` and `bun run typecheck` pass in GitHub Actions on every PR
  4. Contract test suite (Hurl) runs green in CI covering all API endpoints
  5. Pre-commit gate (typecheck + tests + build) passes reliably on local dev
**Plans**: 3 plans
Plans:
- [ ] 00-01-PLAN.md — Deterministic fixtures + 7 stub E2E tests (BR-34 to BR-40)
- [ ] 00-02-PLAN.md — Unified CI workflow + Hurl contract tests for stub BRs
- [ ] 00-03-PLAN.md — Husky pre-commit hook with lint-staged

### Phase 1: Billing Schema Completion
**Goal**: Billing module is fully functional with complete schema, access controls, and test coverage
**Depends on**: Phase 0
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04
**Success Criteria** (what must be TRUE):
  1. Invoice creation includes all fields (paymentCaptureMethod, lineItems, paidBy, voidedBy, etc.)
  2. Billing Drizzle schema matches TypeSpec billing definitions with no drift
  3. Non-admin users cannot access billing management endpoints
  4. E2E tests verify full invoice lifecycle (create, pay, void, refund)
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Handler response mapping, access controls, void threshold, schema verification
- [x] 01-02-PLAN.md — TDD lifecycle + access control + response field tests

### Phase 2: Audit Module Completion
**Goal**: All write operations across modules are automatically captured in an audit trail
**Depends on**: Phase 0
**Requirements**: AUDT-01, AUDT-02, AUDT-03, AUDT-04
**Success Criteria** (what must be TRUE):
  1. Creating, updating, or deleting a record in any module produces an audit event
  2. Audit triggers fire automatically (not manually called in each handler)
  3. Admin can view recent audit events in a dashboard with filtering
  4. E2E tests verify audit capture for representative CRUD operations
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Global audit middleware + unit tests (AUDT-01, AUDT-02)
- [x] 02-02-PLAN.md — Admin audit dashboard at /audit (AUDT-04)
- [x] 02-03-PLAN.md — E2E tests for audit capture + dashboard verification (AUDT-03)
**UI hint**: yes

### Phase 3: Data Model Unification
**Goal**: Single canonical schema replaces the dual custom/TypeSpec-generated models
**Depends on**: Phase 0, Phase 1, Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. One schema definition per entity (no parallel custom vs TypeSpec-generated schemas)
  2. Status enums are consistent across all modules (no translation needed)
  3. Translation glue code (`organization_id` <-> `tenant_id`) is removed
  4. All existing records survive migration with zero data loss
  5. All tests pass against the unified schema
**Plans**: 3 plans
Plans:
- [ ] 00-01-PLAN.md — Deterministic fixtures + 7 stub E2E tests (BR-34 to BR-40)
- [ ] 00-02-PLAN.md — Unified CI workflow + Hurl contract tests for stub BRs
- [ ] 00-03-PLAN.md — Husky pre-commit hook with lint-staged

### Phase 4: TypeSpec/OpenAPI Reconciliation
**Goal**: All 6 custom modules have TypeSpec definitions and auto-generated SDK hooks
**Depends on**: Phase 3
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06, SPEC-07, SPEC-08
**Success Criteria** (what must be TRUE):
  1. TypeSpec definitions exist for dues, membership, events, training, elections, and certificates
  2. `cd specs/api && bun run build` produces OpenAPI including all custom module endpoints
  3. SDK auto-generates React Query hooks for all custom modules (no manual fetch calls)
  4. OpenAPI spec documents every endpoint in the system (base + custom)
**Plans**: 11 plans (7 original + 4 gap closure)
Plans:
- [x] 04-01-PLAN.md — Reconcile election enum + register elections/certificates in main.tsp (SPEC-05, SPEC-06)
- [x] 04-02-PLAN.md — Author dues + membership custom operation TypeSpec (SPEC-01, SPEC-02)
- [x] 04-03-PLAN.md — Author events + training custom operation TypeSpec (SPEC-03, SPEC-04)
- [x] 04-04-PLAN.md — Build pipeline + SDK generation + decommission hand-wired routes (SPEC-07, SPEC-08)
- [x] 04-05-PLAN.md — Migrate dues + membership frontend to SDK hooks (SPEC-07)
- [x] 04-06-PLAN.md — Migrate elections/certificates/events/training frontend to SDK hooks (SPEC-07)
- [x] 04-07-PLAN.md — Migrate route files to SDK hooks + human verification (SPEC-07)
- [x] 04-08-PLAN.md — [GAP] Fix broken db import in 48 handler stubs + API typecheck (SPEC-08)
- [x] 04-09-PLAN.md — [GAP] Replace manual api.get in record-payment-form with SDK hook (SPEC-07)
- [x] 04-10-PLAN.md — [GAP] TypeSpec for persons/me, credits, officer-terms, notifs custom endpoints (SPEC-08)
- [x] 04-11-PLAN.md — [GAP] TypeSpec for announcements + admin + public + rebuild pipeline (SPEC-08)

### Phase 5: Account & Admin App Hardening
**Goal**: Account and admin apps have E2E test coverage for critical user flows
**Depends on**: Phase 0
**Requirements**: TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. Account app E2E tests cover booking, settings, and security flows
  2. Admin app E2E tests cover CRUD operations on orgs, associations, and members
  3. All E2E tests pass in CI alongside existing memberry app tests
**Plans**: 4 plans
Plans:
**Wave 1**
- [x] 05-01-PLAN.md — Admin app E2E tests: organizations, associations, members CRUD with delete (TEST-06)
- [x] 05-02-PLAN.md — Account activation test + playwright config fix + Memberry security flow spec (TEST-05)
- [x] 05-04-PLAN.md — Account app booking + settings E2E tests (TEST-05)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-03-PLAN.md — CI workflow extension: boot admin + account apps, run all E2E suites (TEST-05, TEST-06)

### Phase 6: CI/CD & DevOps Pipeline
**Goal**: Production-ready build, test, and deploy pipeline in GitHub Actions
**Depends on**: Phase 0
**Requirements**: DEVX-01, DEVX-02, DEVX-03, DEVX-04
**Success Criteria** (what must be TRUE):
  1. GitHub Actions builds all apps and services on every PR
  2. Staging deploy triggers automatically on merge to main
  3. Production deploy workflow includes health checks before traffic switch
  4. Canary/health monitoring alerts on production failures
**Plans**: 3 plans

**Wave 1**
- [x] 06-01-PLAN.md — Extend CI with build-api, build-frontends, and unit-tests jobs (DEVX-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-02-PLAN.md — Staging + production deploy workflow with health check gates (DEVX-02, DEVX-03)
- [x] 06-03-PLAN.md — Scheduled production health monitor with GitHub issue alerting (DEVX-04)

### Phase 7: Shared Component Library
**Goal**: Duplicated UI components extracted into a shared package used by all apps
**Depends on**: Phase 5
**Requirements**: UINF-01, UINF-02, UINF-03
**Success Criteria** (what must be TRUE):
  1. `packages/ui` contains extracted Radix-UI wrapper components
  2. Component preview exists (Storybook or equivalent) for shared components
  3. All three apps (account, memberry, admin) import from `packages/ui` instead of local copies
**Plans**: 3 plans

**Wave 1**
- [x] 07-01-PLAN.md — Create packages/ui scaffold + extract 20+ shadcn components from account (UINF-01)
- [x] 07-02-PLAN.md — Ladle component preview with 8+ stories (UINF-02)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-03-PLAN.md — Migrate all three apps to import from @monobase/ui, delete local duplicates (UINF-03)

**UI hint**: yes

### Phase 8: Frontend Unit Tests
**Goal**: Critical Memberry app components have unit test coverage
**Depends on**: Phase 0
**Requirements**: TEST-07
**Success Criteria** (what must be TRUE):
  1. Vitest + testing-library configured and running in the memberry app
  2. Critical components (dashboard, dues table, member list) have unit tests
  3. Unit tests run in CI alongside E2E and contract tests
**Plans**: 3 plans
Plans:
- [ ] 00-01-PLAN.md — Deterministic fixtures + 7 stub E2E tests (BR-34 to BR-40)
- [ ] 00-02-PLAN.md — Unified CI workflow + Hurl contract tests for stub BRs
- [ ] 00-03-PLAN.md — Husky pre-commit hook with lint-staged

## Progress

**Execution Order:**
Phase 0 first. Then Phases 1, 2, 5, 6, 8 in parallel (all depend only on Phase 0). Phase 3 after 0+1+2. Phase 4 after 3. Phase 7 after 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Test Retrofit & CI Foundation | 0/? | Not started | - |
| 1. Billing Schema Completion | 0/2 | Not started | - |
| 2. Audit Module Completion | 2/3 | Executing | - |
| 3. Data Model Unification | 0/? | Not started | - |
| 4. TypeSpec/OpenAPI Reconciliation | 9/11 | In Progress|  |
| 5. Account & Admin App Hardening | 0/4 | Planned | - |
| 6. CI/CD & DevOps Pipeline | 0/3 | Planned | - |
| 7. Shared Component Library | 0/3 | Planned | - |
| 8. Frontend Unit Tests | 0/? | Not started | - |
