# TODOS

## Data Model Unification
- **What:** Unify custom handler tables (organization_id) with TypeSpec-generated association tables (tenant_id/org_id) into a single schema
- **Why:** Two parallel data models exist with translation glue (e.g., updateMember.ts:17 maps between status enums). Contradictory status values (custom: active/grace/lapsed/suspended/pending vs association: pendingPayment/active/gracePeriod/lapsed/expired/suspended/terminated). Tests currently encode both models, making future unification harder.
- **Pros:** Single source of truth, no translation glue, tests verify one schema
- **Cons:** Large migration, risk of breaking working code, requires careful data migration
- **Context:** Codex outside voice flagged this during eng review (2026-05-02). Custom handlers (dues/, membership/, events/) are wired to Memberry app. Association handlers (association:member/, association:operations/) are TypeSpec-generated. Both are active in app.ts. Decision: test current reality, unify later.
- **Depends on:** Test retrofit completing first (provides safety net for migration)

## Deterministic Test Data Strategy
- **What:** Replace hardcoded seed credentials and out-of-band POST calls in E2E tests with deterministic fixtures
- **Why:** Current E2E tests use hardcoded org IDs and a helper that POSTs to /persons after signup because normal signup doesn't create needed records. Gate checks only work on machines with correct seed data. Not CI-portable.
- **Pros:** Tests work in CI without manual seeding, reproducible, no flaky ordering
- **Cons:** Fixture system needs design and implementation
- **Context:** Codex outside voice finding (2026-05-02). Current auth helper at apps/memberry/tests/e2e/helpers/auth.ts:46 does out-of-band person creation. Seed script exists at services/api-ts seed-modules.
- **Depends on:** Nothing (can be done in parallel with test retrofit)

## TypeSpec/OpenAPI Reconciliation for New Modules
- **What:** Align TypeSpec definitions with custom handler modules (dues, membership, events, training, elections, certificates)
- **Why:** Custom modules were built without corresponding TypeSpec definitions. The OpenAPI spec doesn't document these endpoints. SDK can't auto-generate hooks for them.
- **Pros:** Auto-generated SDK hooks, API documentation, type safety across frontend/backend
- **Cons:** Significant effort to define TypeSpec for 7 modules (~46 handlers)
- **Context:** Deferred during CEO review (2026-05-02). Architecture debt, separate PR. Custom modules use manual route registration (app.ts:151-157) while TypeSpec modules use registerOpenAPIRoutes.
- **Depends on:** Data model unification (should pick canonical schema first)

## Frontend Unit Tests
- **What:** Add component/hook unit tests for Memberry app features
- **Why:** E2E tests cover user flows but not component edge cases (conditional rendering, hook state, error boundaries)
- **Pros:** Faster feedback loop than E2E, catches rendering edge cases
- **Cons:** Requires test setup (vitest + testing-library), may overlap with E2E coverage
- **Context:** Deferred during CEO review (2026-05-02). E2E covers user flows. Frontend units are follow-up PR.
- **Depends on:** Test retrofit (provides patterns and infrastructure)
