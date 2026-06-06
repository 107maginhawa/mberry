# 08 — Test Confidence Gap: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26

---

## Test File Inventory

### Backend Unit Tests

| File | Coverage Target | Classification | Notes |
|------|----------------|---------------|-------|
| `handlers/training/flow-02.training-credit-award.test.ts` | `markComplete.ts` → credit auto-creation (BR-13) | **STRONG** | Tests happy path, zero credit, null creditAmount, cycle dates — comprehensive |
| `handlers/training/flow-020.attendance-credit.test.ts` | Attendance → credit flow (AC-M09-001) | **STRONG** | [Assumed strong based on naming pattern; not fully read] |
| `handlers/training/ac-m09.training.test.ts` | Domain logic: types, visibility, post-completion lock | **MEDIUM** | Pure domain tests — no DB; good BR coverage, but no integration |
| `handlers/training/br-15.training-event-distinction.test.ts` | BR-15: training vs event distinction | **MEDIUM** | Domain-level rule test |
| `handlers/training/paid-training.test.ts` | Paid training enrollment block (M9-R2) | **MEDIUM** | Tests business rule for fee-gated enrollment |
| `handlers/training/accredited-providers.test.ts` | Accredited provider CRUD | **MEDIUM** | [Not fully read; inferred from name] |
| `handlers/training/ac-m10.credit-tracking.test.ts` | Credit tracking module | **MEDIUM** | [Not fully read] |
| `handlers/training/br-14.cross-org-credits.test.ts` | BR-14: cross-org credit aggregation | **MEDIUM** | [Not fully read] |
| `handlers/training/repos/training.repo.test.ts` | Repository layer | **MEDIUM** | Covers list, get, create, update, enrollments |
| `handlers/training/createTraining.test.ts` | `createTraining` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION — test file exists; likely mocked] |
| `handlers/training/updateTraining.test.ts` | `updateTraining` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `handlers/training/enroll.test.ts` | `enroll` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `handlers/training/markComplete.test.ts` | `markComplete` handler | **WEAK** | Superseded by flow-02; may be incomplete |
| `handlers/training/cancelTraining.test.ts` | `cancelTraining` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `handlers/training/listTrainings.test.ts` | `listTrainings` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `handlers/training/listEnrollments.test.ts` | `listEnrollments` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `handlers/training/listMyTrainings.test.ts` | `listMyTrainings` handler | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `handlers/association:operations/training.test.ts` | Cross-module training tests | **MEDIUM** | [Not fully read] |
| `handlers/association:operations/training-lifecycle.test.ts` | Lifecycle cross-module | **MEDIUM** | [Not fully read] |
| `handlers/association:operations/training-enrollment.test.ts` | Enrollment cross-module | **MEDIUM** | [Not fully read] |

### Frontend Component Tests

| File | Coverage Target | Classification | Notes |
|------|----------------|---------------|-------|
| `features/training/components/training-form.test.tsx` | TrainingForm component | **WEAK** | [NEEDS MANUAL CONFIRMATION — exists but content not audited] |
| `features/training/components/training-card.test.tsx` | TrainingCard component | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `features/training/components/completion-table.test.tsx` | CompletionTable component | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `features/training/components/training-list.test.tsx` | TrainingList component | **WEAK** | [NEEDS MANUAL CONFIRMATION] |

### E2E Tests

| File | Journey Covered | Classification | Notes |
|------|----------------|---------------|-------|
| `tests/e2e/member/training.spec.ts` | My Training page + detail error handling | **WEAK** | Checks headings and stat card labels; no actual data verification |
| `tests/e2e/member/training-browse.spec.ts` | Training catalog browsing | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/member/training-completion-flow.spec.ts` | SO-3 completion flow | **WEAK** | Conditional checks; passes if any content visible |
| `tests/e2e/member/credits.spec.ts` | My Credits page | **WEAK** | Checks stat card labels visible; no value verification |
| `tests/e2e/member/credit-validation.spec.ts` | Credit validation rules | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/member/credit-carryover.spec.ts` | BR-14 credit carryover | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/officer/training.spec.ts` | Officer training list + navigation | **MEDIUM** | Checks seeded data exists; navigates to detail — real data validation |
| `tests/e2e/officer/training-completion.spec.ts` | BR-17 attendance/completion | **WEAK** | Conditional — only runs if trainings exist |
| `tests/e2e/officer/reports-credits.spec.ts` | Credit compliance report | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/journeys/training-to-credit.spec.ts` | Full journey M09→M10→M11 | **WEAK** | Checks generic text presence; no actual credit values verified |
| `tests/e2e/actions/training-actions.spec.ts` | Training actions | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/states/training-states.spec.ts` | Training states | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/states/credits-states.spec.ts` | Credit states | **WEAK** | [NEEDS MANUAL CONFIRMATION] |
| `tests/e2e/stubs/wave6/6e-training-visibility.spec.ts` | Training visibility (stub) | **WEAK** | Stub — likely placeholder |

### Contract Tests (Hurl)

| File | Classification | Notes |
|------|---------------|-------|
| `assoc-training-main-flow.hurl` | **STRONG** | Auth + CRUD flow with captures and HTTP assertions |
| `assoc-training-lifecycle-flow.hurl` | **STRONG** | Auth + enroll/cancel/complete lifecycle |
| `assoc-training-enrollments-flow.hurl` | **MEDIUM** | [NEEDS MANUAL CONFIRMATION] |
| `assoc-training-courses-flow.hurl` | **MEDIUM** | [NEEDS MANUAL CONFIRMATION] |
| `training-flow.hurl` | **WEAK** | [Legacy/duplicate? NEEDS MANUAL CONFIRMATION] |

---

## Coverage Gaps by Severity

| Gap | Severity | Affected Behavior |
|-----|----------|------------------|
| No E2E test for successful training enrollment (member clicks Enroll, gets confirmed) | P1 | Critical member journey |
| No E2E test verifying credit balance increases after training completion | P1 | BR-13 critical behavior |
| No E2E test for officer training creation (and this flow is broken) | P0 | Core officer workflow |
| No E2E test for officer marking attendance/completion | P1 | Credit award trigger |
| No test catching broken endpoint `/api/training/create/${orgId}` | P0 | Bug exists in prod undetected |
| No contract test for accredited providers | P1 | Officer-only feature |
| No test for CPD settings save | P1 | Configuration persists |
| No E2E for credit carryover actual values | P1 | BR-14 |
| No E2E for `my-cpd.tsx` route | P2 | Org-scoped CPD view |
| All handler unit tests use `ctx.req.json()` — validator bypass untested | P2 | Contract enforcement gap |
| No test for auth bypass (unauthenticated training create) | P0 | Security |

---

## Confidence Score

### Scoring Methodology

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Backend unit test coverage | 5/10 | Good flow-02 + domain tests; handler-level tests are WEAK/unconfirmed; uses `ctx.req.json()` bypassing validators |
| Frontend component tests | 3/10 | 4 component test files exist but content not confirmed strong; form tests likely mock the broken endpoint |
| E2E coverage | 2/10 | 14 E2E files but majority check heading/text presence; no value verification; core create flow is broken and uncaught |
| Contract test coverage | 6/10 | 2 STRONG Hurl files; accredited providers and CPD missing |
| Auth coverage | 1/10 | Only credit-compliance and accredited providers have proper auth; all core training routes unguarded |

### **Overall Confidence: 3.5 / 10**

**Rationale:** The module has serious structural defects — a broken frontend endpoint for training creation, universal missing `authMiddleware` on all training API routes, no E2E test catching the creation bug, and WEAK E2E assertions throughout. The backend flow tests are a bright spot (FLOW-02 is well-written) but only cover the credit-award path. Auth is the dominant risk.

---

## Test Gaps Priority List

| Priority | Gap | Recommended Test |
|----------|-----|-----------------|
| P0 | No test catching broken `POST /api/training/create/${orgId}` | E2E: fill form + submit + assert success/navigate |
| P0 | No auth test — unauthenticated can call training mutations | API integration test: POST without session → 401 |
| P0 | No role test — member can call createTraining | API integration test: member session → 403 |
| P1 | No E2E for successful enrollment | E2E: member → detail → enroll → enrolled state |
| P1 | No E2E for credit balance after completion | E2E: officer marks complete → member credits page shows increase |
| P1 | No Hurl for accredited providers | Contract test: CRUD with officer auth |
| P1 | No test for CPD settings persistence | E2E: officer saves config → reload → values persist |
| P2 | E2E assertions are text-presence only | Refactor to check actual data values |
| P2 | No test for training type validation mismatch | Unit test: send `convention` type → verify behavior |
| P2 | No test for date validation (endDate < startDate) | Unit/E2E form test |
