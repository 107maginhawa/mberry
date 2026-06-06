# MODULE SUMMARY — Training / Credits (M09 + M10)

**Audit Date:** 2026-05-26
**Auditor:** Journey Test Audit Agent
**Module Handler Path:** `services/api-ts/src/handlers/training/`
**TypeSpec Path:** `specs/api/src/association/operations/training.tsp`, `specs/api/src/association/member/credits.tsp`

---

## Confidence Score: 3.5 / 10

The module has two production-breaking defects (broken create endpoint, missing auth), poor E2E depth, and a systemic auth gap across all generated training routes.

---

## Finding Counts

| Severity | Count |
|----------|-------|
| P0 — Critical / Auth bypass | **6** |
| P1 — Major workflow gap | **12** |
| P2 — Minor / Validation gap | **8** |
| P3 — Cleanup | **0** |

---

## All P0 Findings

| ID | Finding | File(s) |
|----|---------|---------|
| P0-AUTH-01 | ALL ~32 `/association/training*` routes missing `authMiddleware` in generated routes | `generated/openapi/routes.ts` lines 1791–1983 |
| P0-AUTH-02 | `createTraining` has no officer/role check — any member can create | `handlers/training/createTraining.ts` |
| P0-AUTH-03 | `updateTraining`, `cancelTraining` have no role check | `updateTraining.ts`, `cancelTraining.ts` |
| P0-AUTH-04 | `markComplete` has no role check — triggers credit creation for any caller | `handlers/training/markComplete.ts` |
| P0-ROUTE-01 | Training create/edit form calls non-existent API endpoints → 404 | `features/training/components/training-form.tsx` |
| P0-JOURNEY-01 | Officer create training journey completely broken; no E2E test catches it | `training-form.tsx` + test gap |

---

## All P1 Findings

| ID | Finding |
|----|---------|
| P1-AUTH-05 | Frontend-only role enforcement for training CRUD (officer pages exist but backend unguarded) |
| P1-AUTH-06 | CPD config endpoint auth unconfirmed |
| P1-ROUTE-02 | Courses sub-module (10+ routes) has no frontend pages |
| P1-ROUTE-03 | `my-cpd.tsx` route may be dead/duplicate vs `/my/credits` |
| P1-CONTRACT-01 | All body handlers use `ctx.req.json()` not `ctx.req.valid('json')` — zValidator bypass |
| P1-CONTRACT-02 | No Hurl tests for accredited providers or CPD configuration |
| P1-CONTRACT-03 | Handler module boundary mismatch (`training/` handler vs `association:operations` TypeSpec) |
| P1-FORM-01 | No confirmation dialogs on cancel/delete/mark-complete destructive actions |
| P1-FORM-02 | Training type values differ between frontend form and domain spec (AC-M09-004) |
| P1-INT-02 | Enrolled state not persisted after enrollment — resets on page refresh |
| P1-INT-03 | Credit compliance report hard-codes `requiredCredits=45` ignoring CPD config |
| P1-JOURNEY-03 | No E2E test for successful enrollment |
| P1-JOURNEY-04 | Zero E2E coverage for CPD settings journey |
| P1-JOURNEY-05 | Accredited providers: no frontend page found; backend handlers exist |

---

## Product Decisions Needed

1. **[PRODUCT] Accredited Provider Management UI:** Handlers exist with proper auth but no frontend page was found. Is this managed via the admin app? Is it in scope for memberry?

2. **[PRODUCT] Required Credits Source of Truth:** The credit compliance report hard-codes `requiredCredits=45` (PRC standard). The CPD settings page defaults to 60. Which governs? Should the report read from the org's CPD config?

3. **[PRODUCT] Courses Sub-Module:** 10+ generated routes exist for a "courses" entity (distinct from trainings). No frontend pages. Is this a planned but unimplemented feature? Should routes be dark until frontend is built?

4. **[PRODUCT] `my-cpd.tsx` Route:** Purpose vs `/my/credits` unclear. Duplicate or distinct view?

5. **[PRODUCT] Enrollment Confirmation:** Should enrolling in a training require a confirmation dialog (especially for paid trainings via payment gateway)?

6. **[PRODUCT] Training Cancel Confirmation:** No cancel UI found. Is cancel an officer-only action? Should it notify enrolled members?

---

## Key Architecture Notes

### Auth Gap is Systemic

All ~32 `/association/training*` routes in `generated/openapi/routes.ts` are missing `authMiddleware()` at the route level. Compare to other routes (e.g., subscription topics, audit logs, billing) that correctly include `authMiddleware({ roles: [...] })`. This suggests the training TypeSpec module was either not annotated with auth requirements or the code generator did not emit them. **Fix requires:** adding `@useAuth` or equivalent to the TypeSpec definitions and re-generating, OR adding `authMiddleware()` manually in the handler wiring.

### Two Parallel Enrollment Systems

There are two enrollment APIs:
- `/association/training-lifecycle/:trainingId/enroll` — used by frontend, handled by `enroll.ts`
- `/association/training/enrollments` (POST/GET) — generated but no frontend usage found

This is confusing and likely a migration artifact. The lifecycle routes are the active ones.

### Frontend Uses Non-Standard API Pattern for Training Form

`training-form.tsx` uses raw `fetch()` to custom URLs instead of the SDK hooks. This bypasses type safety and points to non-existent routes. All other SDK-generating routes use `@monobase/sdk-ts/generated/react-query` hooks. The form needs to be rewritten to use `createTrainingMutation()` and `updateTrainingMutation()` from the SDK.

### Credit Creation Is a Side Effect of `markComplete`

`markComplete.ts` auto-creates a `CreditEntry` record (BR-13) via `CreditEntryRepository`. This is the correct pattern, well-tested by `flow-02.training-credit-award.test.ts`, and has duplicate-guard logic. The risk is that `markComplete` itself has no auth guard.

### Accredited Providers — Correct Auth Pattern

`createAccreditedProvider.ts` and siblings correctly implement: `ctx.get('user')` check + `requirePosition([SOCIETY_OFFICER, PRESIDENT])`. This is the **correct pattern** that should be adopted by `createTraining.ts`, `updateTraining.ts`, `cancelTraining.ts`, and `markComplete.ts`.

---

## Recommended Fix Priority

1. **Immediate (P0):** Add `authMiddleware()` + officer position check to `createTraining`, `updateTraining`, `cancelTraining`, `markComplete` handlers
2. **Immediate (P0):** Fix `training-form.tsx` to use correct API routes (`POST /association/training`, `PATCH /association/training/:trainingId`) or SDK mutations
3. **Short-term (P1):** Add E2E test for officer create training → verify training appears in list
4. **Short-term (P1):** Add E2E test for member enroll → verify enrolled state persists
5. **Short-term (P1):** Fix all handlers to use `ctx.req.valid('json')` instead of `ctx.req.json()`
6. **Medium-term (P1):** Add Hurl contract tests for accredited providers
7. **Medium-term (P1):** Resolve training type mismatch between form and domain spec
