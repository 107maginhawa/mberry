# Phase 5: Account & Admin App Hardening - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E test coverage for Memberry and Admin apps' critical user flows. Account app deferred to later phase — only needs basic activation/license verification test.

</domain>

<decisions>
## Implementation Decisions

### Test Scope & Priority
- Focus on Memberry and Admin apps — account app is just activation/license, will be expanded later
- Account app: minimal test — just verify account is activated
- Admin app: CRUD operations on orgs, associations, and members (matches success criteria)
- Memberry app: fill gaps in existing E2E suite — booking, settings, and security flows
- Happy path + one error case per flow (matches existing memberry test pattern)
- Reuse existing memberry E2E helpers (helpers/auth.ts pattern)

### Test Data Strategy
- Deterministic fixtures for CI portability (aligns with TEST-02 requirement)
- Generate unique users per test (existing pattern: `signup-${Date.now()}@test.com`)
- Use seeded admin/operator accounts from existing seed data for admin tests

### CI Integration
- Same Playwright config pattern as admin app (workers:1, serial execution)
- Run alongside memberry tests — separate playwright projects in same CI step
- Standard ports: memberry on 3001, admin on configured port

### Claude's Discretion
- Specific test case details and assertions
- Helper extraction and organization
- CI workflow file structure

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/memberry/tests/e2e/helpers/auth.ts` — signIn helper, reusable pattern
- `apps/memberry/tests/e2e/` — 20+ spec files showing test patterns
- `apps/admin/tests/e2e/admin-smoke.spec.ts` — existing admin smoke test
- `apps/admin/tests/e2e/audit.spec.ts` — existing admin audit test
- `apps/admin/playwright.config.ts` — existing Playwright config

### Established Patterns
- Business rule annotations in test files (`// Business Rules: [BR-21] [BR-24]`)
- Playwright test.describe blocks for grouping related flows
- signIn helper for authentication before tests
- waitForLoadState('networkidle') for page load waits
- getByLabel/getByRole for accessible selectors

### Integration Points
- Admin routes: organizations, associations, members, operators, audit, feature-flags, impersonate
- Account routes: auth, dashboard, bookings, settings, notifications, onboarding
- Memberry routes: member flows (dashboard, events, training, payments, credits, certificates), officer flows

</code_context>

<specifics>
## Specific Ideas

- Account app just acts as app activation/license in cloud — minimal testing needed now
- Memberry and Admin are the primary focus apps
- Account app will be expanded later when its role grows

</specifics>

<deferred>
## Deferred Ideas

- Full account app E2E coverage — deferred until account app role expands beyond activation/license
- Notifications E2E testing — depends on OneSignal integration
- Onboarding flow testing — account app deferred

</deferred>
