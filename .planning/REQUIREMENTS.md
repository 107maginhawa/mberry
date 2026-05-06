# Requirements: Memberry

**Defined:** 2026-05-06
**Core Value:** Members can manage their association membership, track continuing education credits, and stay current on dues — from any device, with minimal friction.

## v1 Requirements

Requirements for current milestone. Each maps to roadmap phases.

### Testing & CI

- [ ] **TEST-01**: All 40 business rules have passing E2E test coverage (currently 33/40)
- [ ] **TEST-02**: E2E tests use deterministic fixtures, not hardcoded seed credentials
- [ ] **TEST-03**: GitHub Actions workflow runs lint, typecheck, unit tests, and E2E tests on every PR
- [ ] **TEST-04**: Contract test suite (Hurl) runs in CI and covers all API endpoints
- [ ] **TEST-05**: Account app has E2E tests for booking, settings, and security flows
- [ ] **TEST-06**: Admin app has E2E tests for CRUD operations on orgs, associations, and members
- [ ] **TEST-07**: Frontend unit tests exist for critical Memberry app components (vitest + testing-library)
- [ ] **TEST-08**: Pre-commit gate (typecheck + tests + build) passes reliably

### Billing

- [x] **BILL-01**: Billing schema includes all TODO fields (paymentCaptureMethod, lineItems, paidBy, voidedBy, etc.)
- [x] **BILL-02**: Billing Drizzle schema matches TypeSpec billing definitions
- [x] **BILL-03**: Admin access checks enforced on billing handlers
- [x] **BILL-04**: Billing module has E2E tests covering invoice lifecycle

### Audit

- [x] **AUDT-01**: Audit module captures write events (create, update, delete) across all modules
- [x] **AUDT-02**: Audit event triggers fire on CRUD operations automatically
- [ ] **AUDT-03**: Audit module has E2E tests for event capture and log retrieval
- [ ] **AUDT-04**: Admin app has audit dashboard showing recent events

### Data Model

- [ ] **DATA-01**: Single canonical schema replaces dual custom/TypeSpec-generated schemas
- [ ] **DATA-02**: Status enums unified (no more custom vs association contradictions)
- [ ] **DATA-03**: Translation glue code removed after schema unification
- [ ] **DATA-04**: Data migration preserves all existing records during unification
- [ ] **DATA-05**: All tests updated to verify single unified schema

### API Specification

- [ ] **SPEC-01**: TypeSpec definitions exist for dues module
- [ ] **SPEC-02**: TypeSpec definitions exist for membership module
- [ ] **SPEC-03**: TypeSpec definitions exist for events module
- [ ] **SPEC-04**: TypeSpec definitions exist for training module
- [x] **SPEC-05**: TypeSpec definitions exist for elections module
- [x] **SPEC-06**: TypeSpec definitions exist for certificates module
- [x] **SPEC-07**: SDK auto-generates React Query hooks for all custom modules
- [x] **SPEC-08**: OpenAPI spec documents all endpoints (base + custom)

### DevOps

- [ ] **DEVX-01**: GitHub Actions workflow for build across all apps and services
- [x] **DEVX-02**: GitHub Actions workflow for deploy to staging environment
- [ ] **DEVX-03**: Production deploy workflow with health checks
- [ ] **DEVX-04**: Canary/health monitoring for production

### UI Infrastructure

- [ ] **UINF-01**: Shared UI component package (`packages/ui`) extracts duplicated Radix-UI wrappers
- [ ] **UINF-02**: Component preview/documentation (Storybook or equivalent)
- [ ] **UINF-03**: All three apps import shared components from `packages/ui`

## v2 Requirements

### Mobile & Offline

- **MOBL-01**: Tauri mobile builds for iOS and Android
- **MOBL-02**: Cadence P2P sync activated end-to-end (currently stub)
- **MOBL-03**: Offline-first data access via embedded API

### Platform

- **PLAT-01**: Multi-tenancy SaaS infrastructure
- **PLAT-02**: White-label branding per association
- **PLAT-03**: API rate limiting and throttling

### Integrations

- **INTG-01**: PayMongo integration for Philippines payment processing
- **INTG-02**: EMR/health product distribution channel
- **INTG-03**: CPD reporting to professional regulatory boards

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile-native apps | Tauri handles desktop/mobile via webview |
| Payment gateways beyond Stripe | Deferred, PayMongo for v2 |
| EMR/health product integrations | AMS is distribution channel; products come later |
| Real-time sync (cadence activation) | Stub exists, activation deferred to v2 |
| Multi-tenancy SaaS | Single-tenant per deployment for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 0 | In Progress |
| TEST-02 | Phase 0 | Pending |
| TEST-03 | Phase 0 | Pending |
| TEST-04 | Phase 0 | Pending |
| TEST-05 | Phase 5 | Pending |
| TEST-06 | Phase 5 | Pending |
| TEST-07 | Phase 8 | Pending |
| TEST-08 | Phase 0 | Pending |
| BILL-01 | Phase 1 | Complete |
| BILL-02 | Phase 1 | Complete |
| BILL-03 | Phase 1 | Complete |
| BILL-04 | Phase 1 | Complete |
| AUDT-01 | Phase 2 | Complete |
| AUDT-02 | Phase 2 | Complete |
| AUDT-03 | Phase 2 | Pending |
| AUDT-04 | Phase 2 | Pending |
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| DATA-04 | Phase 3 | Pending |
| DATA-05 | Phase 3 | Pending |
| SPEC-01 | Phase 4 | Pending |
| SPEC-02 | Phase 4 | Pending |
| SPEC-03 | Phase 4 | Pending |
| SPEC-04 | Phase 4 | Pending |
| SPEC-05 | Phase 4 | Complete |
| SPEC-06 | Phase 4 | Complete |
| SPEC-07 | Phase 4 | Complete |
| SPEC-08 | Phase 4 | Complete |
| DEVX-01 | Phase 6 | Pending |
| DEVX-02 | Phase 6 | Complete |
| DEVX-03 | Phase 6 | Pending |
| DEVX-04 | Phase 6 | Pending |
| UINF-01 | Phase 7 | Pending |
| UINF-02 | Phase 7 | Pending |
| UINF-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after initial definition*
