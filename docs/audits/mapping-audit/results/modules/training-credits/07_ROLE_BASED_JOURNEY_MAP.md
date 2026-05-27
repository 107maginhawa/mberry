# 07 — Role-Based Journey Map: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26

---

## Journey 1: Member — Browse and Enroll in Training

**Persona:** Active member
**Entry:** Sidebar → Training or `/org/$orgSlug/training/`

| Step | Frontend Route | API Call | Auth at Step | E2E Coverage |
|------|---------------|----------|-------------|-------------|
| 1. Browse training catalog | `/org/$orgSlug/training/` | `GET /association/training?status=published` | Frontend: authenticated route. Backend: **NO authMiddleware** | `training-completion-flow.spec.ts` — weak (checks any text) |
| 2. Click training card | Navigate to `/org/$orgSlug/training/$trainingId` | — | Frontend gate only | `training-completion-flow.spec.ts` — conditional |
| 3. View training detail | `/org/$orgSlug/training/$trainingId` | `GET /association/training/:trainingId` | Frontend: authenticated. Backend: **NO authMiddleware** | `training.spec.ts` — error handling test only |
| 4. Click Enroll | POST via SDK mutation | `POST /association/training-lifecycle/:trainingId/enroll` | Handler checks session + membership | NO E2E test for successful enroll |
| 5. See success toast | — | — | — | NO |

**Auth gaps at steps 1, 2, 3:** Backend routes lack `authMiddleware`. Frontend guards exist (within `_authenticated` layout).

**Critical gap:** No E2E test verifies successful enrollment flow end-to-end.

---

## Journey 2: Member — View My Trainings and Credits

**Persona:** Active member (enrolled in at least one training)
**Entry:** `/my/training` or `/my/credits`

| Step | Frontend Route | API Call | Auth | E2E Coverage |
|------|---------------|----------|------|-------------|
| 1. My Training page | `/my/training` | `GET /association/training-lifecycle/my` | Handler reads session | `training.spec.ts` — heading + stat cards (WEAK) |
| 2. My Credits page | `/my/credits/` | `GET /api/persons/me/credit-summary`, `GET /api/persons/me/credit-entries` | [NEEDS MANUAL CONFIRMATION] | `credits.spec.ts` — stat cards visible (WEAK) |
| 3. Log manual credit | `/my/credits/log` | [NEEDS MANUAL CONFIRMATION] | [UNKNOWN] | `credits.spec.ts` — heading check |
| 4. Org-scoped CPD tracker | `/org/$orgSlug/my-cpd` | [NEEDS MANUAL CONFIRMATION] | [UNKNOWN] | NOT FOUND |

**Critical gap:** No E2E test verifies credits are actually updated after training completion.

---

## Journey 3: Officer — Create and Publish Training

**Persona:** Society officer / president
**Entry:** `/org/$orgSlug/officer/training/` → "Create Training"

| Step | Frontend Route | API Call | Auth | E2E Coverage |
|------|---------------|----------|------|-------------|
| 1. View training list | `/org/$orgSlug/officer/training/` | Uses `TrainingList` component | Frontend: officer route. Backend: **NO authMiddleware** | `training.spec.ts` officer — checks seeded data (STRONG) |
| 2. Click "Create Training" | Navigate to `/org/$orgSlug/officer/training/new` | — | — | `training.spec.ts` — button visible (WEAK) |
| 3. Fill training form | `/org/$orgSlug/officer/training/new` | — | — | NOT TESTED |
| 4. **Click "Save Draft"** | Same | **`POST /api/training/create/${orgId}`** — **404** | — | **NOT TESTED** |
| 5. **Click "Publish"** | Same | **`POST /api/training/create/${orgId}`** — **404** | — | **NOT TESTED** |

**This journey is broken at step 4.** The entire create flow fails because the frontend calls a non-existent URL.

---

## Journey 4: Officer — Mark Training Complete + Award Credits

**Persona:** Society officer
**Entry:** Training detail → Attendance tab

| Step | Frontend Route | API Call | Auth | E2E Coverage |
|------|---------------|----------|------|-------------|
| 1. View training detail | `/org/$orgSlug/officer/training/$trainingId` | `GET /association/training/:trainingId` | Frontend: officer route. Backend: **NO authMiddleware** | `training-completion.spec.ts` — attendance tab visible (WEAK) |
| 2. Switch to Attendance tab | Same route | — | — | `training-completion.spec.ts` — conditional check |
| 3. Mark attendee complete | `/officer/training/$trainingId/attendance` | `POST /association/training-lifecycle/:trainingId/complete` | Handler reads body.personId — **NO officer check** | NOT TESTED end-to-end |
| 4. Credit auto-created (BR-13) | — | Auto via `markComplete.ts` | No auth | Unit tested: `flow-02.training-credit-award.test.ts` (STRONG) |
| 5. Member credit reflects update | `/my/credits` | — | — | NOT TESTED end-to-end |

**Auth gap at step 3:** `markComplete` has no role check — any authenticated user who knows the IDs can mark completion and trigger credit creation.

---

## Journey 5: Officer — View Credit Compliance Report

**Persona:** Society officer / president
**Entry:** `/org/$orgSlug/officer/reports/credits`

| Step | Frontend Route | API Call | Auth | E2E Coverage |
|------|---------------|----------|------|-------------|
| 1. View compliance report | `/org/$orgSlug/officer/reports/credits` | `GET /api/credit-compliance/${orgId}` | Frontend: officer route. Backend: `authMiddleware()` + `officerAuthMiddleware()` (hand-wired) | `reports-credits.spec.ts` — [NEEDS MANUAL CONFIRMATION] |
| 2. Filter by status | Same | Client-side | — | NOT TESTED |

This journey has proper backend auth (hand-wired). Compliance report auth is the only properly secured training-adjacent route.

---

## Journey 6: Officer — Configure CPD Settings

**Persona:** Society officer
**Entry:** `/org/$orgSlug/officer/settings/cpd`

| Step | API Call | Auth | E2E Coverage |
|------|----------|------|-------------|
| 1. Load current config | `GET /api/association/member/cpd-config/:orgId` | [NEEDS MANUAL CONFIRMATION] | NOT FOUND |
| 2. Change settings | — | — | NOT FOUND |
| 3. Save | `PATCH /api/association/member/cpd-config/:orgId` | [NEEDS MANUAL CONFIRMATION] | NOT FOUND |

**Zero E2E coverage for CPD settings journey.**

---

## Journey 7: Officer — Manage Accredited Providers

**Persona:** Society officer / president
**Entry:** [NEEDS MANUAL CONFIRMATION — no frontend page found]

| Handler | Auth | E2E Coverage |
|---------|------|-------------|
| `createAccreditedProvider.ts` | Handler: user check + `requirePosition` | NOT FOUND |
| `listAccreditedProviders.ts` | Same | NOT FOUND |
| `updateAccreditedProvider.ts` | Same | NOT FOUND |
| `deleteAccreditedProvider.ts` | Same | NOT FOUND |

**No frontend page found for accredited provider management.** Backend handlers exist and are properly auth-gated but there is no UI. [NEEDS PRODUCT DECISION] — is this managed elsewhere (admin app)?

---

## E2E Coverage Summary by Journey

| Journey | E2E Tests | Quality | Critical Gap |
|---------|-----------|---------|-------------|
| J1: Member browse + enroll | `training.spec.ts`, `training-completion-flow.spec.ts` | WEAK | No enroll success test |
| J2: Member view trainings/credits | `training.spec.ts`, `credits.spec.ts` | WEAK | No credit balance verification |
| J3: Officer create training | `training.spec.ts` (officer) | WEAK | Create flow not tested (broken endpoint) |
| J4: Officer mark complete + credits | `training-completion.spec.ts` | WEAK | No end-to-end credit award test |
| J5: Officer credit compliance | [NEEDS MANUAL CONFIRMATION] | UNKNOWN | — |
| J6: Officer CPD settings | NONE | NONE | Complete gap |
| J7: Accredited providers | NONE | NONE | Complete gap + no frontend |

---

## P0 Findings

### [P0-JOURNEY-01] Journey 3 (Officer Create Training) Is Completely Broken

- **Evidence:** `training-form.tsx` calls `/api/training/create/${orgId}` which does not exist
- **No E2E test catches this** because no E2E test attempts actual creation
- **Severity:** P0

### [P0-JOURNEY-02] Journey 4 Step 3 (Mark Complete) Has No Role Guard

- **Evidence:** `markComplete.ts` — no `requirePosition` or role check; auto-creates credits
- **Severity:** P0

---

## P1 Findings

### [P1-JOURNEY-03] Journey 1 Step 4 (Enroll) — No E2E Test for Success Path

- **Severity:** P1

### [P1-JOURNEY-04] Journey 6 (CPD Settings) — Zero E2E Coverage

- **Severity:** P1

### [P1-JOURNEY-05] Journey 7 (Accredited Providers) — No Frontend Page

- **Severity:** P1 + [NEEDS PRODUCT DECISION]
