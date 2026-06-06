# 06 — Backend API Contract Alignment: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26

---

## Handler-to-Generated-Route Registration Check

| Handler File | Expected Generated Registry Name | Found in routes.ts | Match |
|-------------|----------------------------------|-------------------|-------|
| `createTraining.ts` | `registry.createTraining` | YES — line 1793 | OK |
| `listTrainings.ts` | `registry.searchTrainings` | YES — line 1799 | OK (name mismatch: list vs search) |
| `updateTraining.ts` | `registry.updateTraining` | YES — line 1972 | OK |
| `cancelTraining.ts` | `registry.cancelCustomTraining` | YES — line 1811 | OK |
| `markComplete.ts` | `registry.completeCustomTraining` | YES — line 1825 | OK |
| `enroll.ts` | `registry.enrollInCustomTraining` | YES — line 1833 | OK |
| `listEnrollments.ts` | `registry.listCustomTrainingEnrollments` | YES — line 1840 | OK |
| `listMyTrainings.ts` | `registry.listMyCustomTrainings` | YES — line 1805 | OK |
| `createAccreditedProvider.ts` | [NEEDS MANUAL CONFIRMATION — not found in training section] | — | UNKNOWN |
| `updateAccreditedProvider.ts` | Same | — | UNKNOWN |
| `deleteAccreditedProvider.ts` | Same | — | UNKNOWN |
| `listAccreditedProviders.ts` | Same | — | UNKNOWN |

**Note:** Accredited provider routes were NOT found in the audited section of `routes.ts` (lines 1780–2000). They may be in a different section or hand-wired. [NEEDS MANUAL CONFIRMATION]

---

## `ctx.req.valid()` vs `ctx.req.json()` Validation Audit

Per conventions, handlers should use `ctx.req.valid('json')` (type-safe, pre-validated by zValidator middleware) not `ctx.req.json()` (raw, unvalidated).

| Handler | Method Used | Compliant |
|---------|------------|-----------|
| `createTraining.ts` | `await ctx.req.json()` | **NO** — bypasses generated validation |
| `updateTraining.ts` | `await ctx.req.json()` | **NO** |
| `markComplete.ts` | `await ctx.req.json()` | **NO** |
| `enroll.ts` | Uses `ctx.req.param()` only (no body) | N/A |
| `cancelTraining.ts` | Uses `ctx.req.param()` only | N/A |
| `listMyTrainings.ts` | No body needed | N/A |
| `listEnrollments.ts` | No body needed | N/A |
| `createAccreditedProvider.ts` | `await ctx.req.json()` | **NO** |
| `updateAccreditedProvider.ts` | `await ctx.req.json()` | **NO** |

**Pattern:** All body-consuming handlers use raw `ctx.req.json()` instead of `ctx.req.valid('json')`. This means zValidator middleware runs but the result is not used — handlers re-parse the raw body, potentially accepting fields that failed schema validation.

---

## TypeSpec Coverage

**TypeSpec files found:**
- `specs/api/src/association/member/credits.tsp` — credit tracking spec
- `specs/api/src/association/operations/training.tsp` — training spec (association:operations module)

**Coverage assessment:**
- Core training CRUD: COVERED (TypeSpec in `training.tsp`)
- Lifecycle (enroll, cancel, complete, check-in): COVERED
- Courses sub-module: COVERED (routes generated)
- Accredited providers: [NEEDS MANUAL CONFIRMATION] — handlers exist but unclear if TypeSpec covers them or if they're hand-wired
- Credit compliance: COVERED in TypeSpec (member credits)
- CPD configuration: [NEEDS MANUAL CONFIRMATION]

**Gap:** The `training` handler directory sits under `services/api-ts/src/handlers/training/` but the TypeSpec is in `specs/api/src/association/operations/training.tsp` — module boundary mismatch. The CLAUDE.md lists training as "hand-wired" but generated routes exist. This creates confusion about the authoritative source.

---

## Contract Test (Hurl) Coverage

| Hurl File | Routes Covered | Auth in Test |
|-----------|---------------|-------------|
| `assoc-training-main-flow.hurl` | `POST /association/training`, `GET /association/training`, `GET /association/training/:id`, `PATCH /association/training/:id`, publish, delete | YES — auth setup in step 0 |
| `assoc-training-lifecycle-flow.hurl` | `GET /association/training-lifecycle/my`, `POST enroll`, `GET enrollments`, cancel, check-in, complete | YES |
| `assoc-training-enrollments-flow.hurl` | `/association/training/enrollments/*` | [NEEDS MANUAL CONFIRMATION] |
| `assoc-training-courses-flow.hurl` | `/association/training/courses/*` | [NEEDS MANUAL CONFIRMATION] |
| `training-flow.hurl` | [NEEDS MANUAL CONFIRMATION — older file?] | [UNKNOWN] |

**Contract test coverage (confirmed):** Core CRUD + lifecycle flows have Hurl tests with auth.

**Gaps:**
- Accredited providers: No Hurl file found
- CPD configuration: No Hurl file found
- Credit entries / credit summary: No dedicated Hurl file found

---

## P1 Findings

### [P1-CONTRACT-01] All Body Handlers Use `ctx.req.json()` Instead of `ctx.req.valid('json')`

- **Files:** `createTraining.ts`, `updateTraining.ts`, `markComplete.ts`, `createAccreditedProvider.ts`, `updateAccreditedProvider.ts`
- **Evidence:** Each uses `await ctx.req.json()` despite zValidator middleware being present in the route registration
- **Impact:** Type-safe validation from OpenAPI schema is not enforced in handler code; invalid payloads that pass zValidator (edge cases) still reach business logic with raw parsed JSON
- **Severity:** P1

### [P1-CONTRACT-02] No Hurl Tests for Accredited Providers or CPD Configuration

- **Evidence:** 5 Hurl files exist but none named for accredited providers or CPD config
- **Impact:** These officer-only flows have no contract-level test coverage
- **Severity:** P1

### [P1-CONTRACT-03] Handler Module Boundary Mismatch (training vs association:operations)

- **Evidence:** Handlers in `services/api-ts/src/handlers/training/` but TypeSpec in `specs/api/src/association/operations/training.tsp`
- **Impact:** Future module splits or refactors may generate routes that shadow hand-wired ones
- **Severity:** P1

---

## P2 Findings

### [P2-CONTRACT-04] `createTraining` Body Accepts Unknown/Aliased Field Names

- **File:** `createTraining.ts`
- **Evidence:**
  ```typescript
  location: body.location ?? body.locationDetails,
  startDate: new Date(body.startAt ?? body.startDate),
  endDate: new Date(body.endAt ?? body.endDate),
  registrationFee: body.fee ?? body.registrationFee ?? 0,
  creditAmount: body.creditAmount ?? body.creditValue ?? 0,
  ```
- **Impact:** Handler accepts legacy/aliased fields that may not be in the OpenAPI spec, bypassing contract enforcement
- **Severity:** P2

### [P2-CONTRACT-05] `updateTraining` Strips Many Fields Silently

- **File:** `updateTraining.ts`
- **Evidence:** Destructures and discards: `type, scheduleDescription, locationType, coverImage, creditValueLocked, enrollmentMode, visibility` — these fields are accepted in body but silently ignored
- **Impact:** API consumers sending these fields receive 200 OK but changes are not applied — silent failure
- **Severity:** P2
