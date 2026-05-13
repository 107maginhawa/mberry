# Roadmap: Memberry

## Milestones

- ✅ **v1.0 Foundation** - Phases 00-13 (shipped 2026-05-09)
- 🚧 **v1.1 Stabilization** - Phases 14-19 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation (Phases 00-13) - SHIPPED 2026-05-09</summary>

- [x] **Phase 00: Test Retrofit & CI Foundation** - Test fixtures, CI pipeline, pre-commit hooks
- [x] **Phase 01: Foundation Completion** - Core platform stabilization
- [x] **Phase 02: Audit Dashboard** - Filterable audit dashboard with pagination
- [x] **Phase 03: Schema Standardization** - tenantId→organizationId, enum camelCase, type consolidation
- [x] **Phase 04: TypeSpec Coverage + SDK Migration** - Full TypeSpec coverage, frontend SDK migration (11 sub-steps)
- [x] **Phase 05: E2E Test Specs** - Playwright E2E for account + memberry apps
- [x] **Phase 06: CI/CD Pipeline** - Build, deploy, health monitor workflows
- [x] **Phase 07: Shared UI Components** - @monobase/ui with 27 shadcn components + Ladle preview
- [x] **Phase 08: Frontend Unit Tests** - Vitest setup + CI integration
- [x] **Phase 09: Pre-commit Hooks** - Typecheck gate + CI unit tests
- [x] **Phase 10: Deploy Configuration** - Railway + Cloudflare deploy commands
- [x] **Phase 11: Test Infrastructure** - Seed users, apiAs helper, officer test data
- [x] **Phase 12: Backend Auth Route Protection** - officerAuthMiddleware + requireOfficerTerm (3 waves)
- [x] **Phase 13: Position-Based RBAC** - requirePosition utility + position-based sidebar nav (3 waves)

</details>

### ✅ v1.1 Stabilization (SHIPPED 2026-05-12)

**Milestone Goal:** Close audit findings, fix Codex-identified bugs, harden state machines, expand test coverage, standardize frontend patterns.

- [x] **Phase 14: P0/P1 Remediation + Codex Fixes** - Fix 4 Codex-verified bugs + close remaining P0/P1 items (c90f160)
- [x] **Phase 15: State Machine Guards** - Add transition validation to 5 unguarded state machines (3b2cd99)
- [x] **Phase 16: Pagination Expansion** - Apply OffsetPaginationParams to all list endpoints (6a75ded)
- [x] **Phase 17: Admin App SDK Migration** - Replace raw fetch() with TanStack Query + error boundaries (03ec878)
- [x] **Phase 18: Business Rule Completion** - BR-34 nomination eligibility implemented; BR-35-40 deferred (8912e5b)
- [x] **Phase 19: Communication Consolidation** - Merge 3 messaging modules into 2 (41d43c7)

## Phase Details

### Phase 14: P0/P1 Remediation + Codex Fixes
**Goal**: Fix 4 Codex-verified P1/P2 bugs in org-context middleware and event form. Close remaining P0/P1 remediation items.
**Depends on**: Phase 13
**Success Criteria** (what must be TRUE):
  1. Nested association routes like `/association/events/:eventId/cancel` correctly resolve orgId (not eventId)
  2. Mutations sending organizationId in request body are accepted by org-context middleware
  3. Public directory profile endpoint `/association/member/directory/search/:personId/public` is accessible without auth
  4. Event create/update form submits registrationFee as number, not BigInt
  5. invitation_token table has organizationId column
  6. All 18 P0/P1 items verified resolved
**Plans**: TBD

### Phase 15: State Machine Guards
**Goal**: Add transition validation to 5 unguarded state machines — ethics complaints, elections, announcements, events (draft→archived), training (draft→archived).
**Depends on**: Phase 14
**Success Criteria** (what must be TRUE):
  1. Ethics complaints cannot skip investigation step (submitted→resolved blocked)
  2. Elections cannot close before opening (draft→closed blocked)
  3. Announcements cannot be unpublished without archive transition
  4. Events cannot go from draft directly to archived (must publish first)
  5. Training cannot go from draft directly to archived (must publish first)
**Plans**: TBD

### Phase 16: Pagination Expansion
**Goal**: Apply existing OffsetPaginationParams standard to all list endpoints. Standard exists in `specs/api/src/common/pagination.tsp`.
**Depends on**: Phase 15
**Success Criteria** (what must be TRUE):
  1. All list endpoints in OpenAPI spec include limit/offset parameters
  2. Handler implementations pass pagination params to repo queries
  3. Frontend list components support pagination
  4. SDK regenerated with pagination types
**Plans**: TBD

### Phase 17: Admin App SDK Migration
**Goal**: Replace raw fetch() in admin app with TanStack Query + SDK hooks. Add error boundaries to admin and account apps.
**Depends on**: Phase 14
**Success Criteria** (what must be TRUE):
  1. Admin dashboard uses useQuery() instead of raw fetch()
  2. All admin routes use SDK-generated query options
  3. Admin app root layout has ErrorBoundary
  4. Account app root layout has ErrorBoundary
  5. All 3 apps verified using sonner for toasts
**Plans**: TBD

### Phase 18: Business Rule Completion
**Goal**: Complete remaining 7 of 40 documented business rules with TDD.
**Depends on**: Phase 15
**Success Criteria** (what must be TRUE):
  1. br-registry.json shows 40/40 rules complete
  2. Each new rule has RED→GREEN test cycle
  3. Contract tests exist for newly implemented rules
  4. EXECUTION-CHECKLIST.md updated
**Plans**: TBD

### Phase 19: Communication Consolidation
**Goal**: Merge communications module (announcements, 8 handlers, hand-wired) into communication module (28 handlers, TypeSpec). Keep comms (WebSocket) separate.
**Depends on**: Phase 17
**Success Criteria** (what must be TRUE):
  1. Announcement endpoints have TypeSpec definitions
  2. Announcement handlers moved to communication module directory
  3. Frontend imports updated to new module location
  4. communications/ directory removed
  5. comms/ (WebSocket) unchanged
**Plans**: TBD

## Progress

| Phase | Milestone | Status | Completed |
|-------|-----------|--------|-----------|
| 14. P0/P1 + Codex Fixes | v1.1 | ✅ Done | 2026-05-10 |
| 15. State Machine Guards | v1.1 | ✅ Done | 2026-05-10 |
| 16. Pagination Expansion | v1.1 | ✅ Done | 2026-05-10 |
| 17. Admin SDK Migration | v1.1 | ✅ Done | 2026-05-10 |
| 18. BR Completion | 0/1 | Complete    | 2026-05-13 |
| 19. Comms Consolidation | v1.1 | ✅ Done | 2026-05-10 |
