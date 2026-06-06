# 02 — Role Permission Map: Training/Credits Module

**Module:** Training / Credits (M09 + M10)
**Audit Date:** 2026-05-26
**Auditor:** Journey Test Audit Agent

---

## Role Inventory

| Role | Access Pattern |
|------|---------------|
| **Member** | Browse/enroll in published trainings, view own enrollments, view own credits |
| **Officer / Society Officer** | Create/edit/publish/cancel/complete trainings, view all enrollments, manage accredited providers, view credit compliance report, configure CPD settings |
| **President** | Same as Officer + full credit-compliance access confirmed in RBAC tests |
| **Treasurer** | Blocked from credit-compliance endpoint (confirmed in RBAC tests) |
| **Admin** | Platform-level (not training-specific; uses `authMiddleware({ roles: ["admin"] })` on other routes) |
| **Unauthenticated** | [CRITICAL — see P0 findings below] |

---

## Handler-Level Auth Analysis

### Core Training Handlers (`services/api-ts/src/handlers/training/`)

| Handler | Generated Route | `authMiddleware` in routes.ts | Handler-level auth | Officer check | Finding |
|---------|----------------|-------------------------------|-------------------|---------------|---------|
| `createTraining.ts` | `POST /association/training` | **NONE** | Session used but not checked | **NONE** | **P0** |
| `listTrainings.ts` | `GET /association/training` | **NONE** | None visible | **NONE** | **P0** |
| `updateTraining.ts` | `PATCH /association/training/:trainingId` | **NONE** | Session used | **NONE** | **P0** |
| `cancelTraining.ts` | `POST /association/training-lifecycle/:trainingId/cancel` | **NONE** | None | **NONE** | **P0** |
| `markComplete.ts` | `POST /association/training-lifecycle/:trainingId/complete` | **NONE** | None | **NONE** | **P0** |
| `enroll.ts` | `POST /association/training-lifecycle/:trainingId/enroll` | **NONE** | Session used; membership check | Membership check only | **P0** |
| `listEnrollments.ts` | `GET /association/training-lifecycle/:trainingId/enrollments` | **NONE** | None | **NONE** | **P0** |
| `listMyTrainings.ts` | `GET /association/training-lifecycle/my` | **NONE** | Session used | **NONE** | **P0** |

### Accredited Provider Handlers

| Handler | `authMiddleware` in routes | Handler auth | Officer check |
|---------|---------------------------|-------------|---------------|
| `createAccreditedProvider.ts` | **NONE** | `ctx.get('user')` check + `requirePosition([SOCIETY_OFFICER, PRESIDENT])` | YES — position-based |
| `listAccreditedProviders.ts` | **NONE** | Same — user check + `requirePosition` | YES |
| `updateAccreditedProvider.ts` | **NONE** | Same pattern | YES |
| `deleteAccreditedProvider.ts` | **NONE** | Same pattern | YES |

### Generated Routes — ALL Training Routes Missing `authMiddleware`

Evidence from `services/api-ts/src/generated/openapi/routes.ts` lines 1791–1983:

```
// createTraining
app.post('/association/training',
  zValidator('json', validators.CreateTrainingBody, validationErrorHandler),
  registry.createTraining as unknown as Handler
  // NO authMiddleware
);
```

This pattern repeats for ALL ~32 training-related generated routes. Compare to secured routes elsewhere:
```
app.delete('/association/subscription-topics/:topicId',
  authMiddleware({ roles: ["admin"] }),   // ← other routes have this
  ...
```

---

## P0 Findings

### [P0-AUTH-01] All Core Training Routes Lack `authMiddleware` in Generated Routes

- **File:** `services/api-ts/src/generated/openapi/routes.ts` lines 1791–1983
- **Evidence:** None of the ~32 `/association/training*` routes include `authMiddleware()` at the route-registration layer
- **Impact:** Any unauthenticated request can call `POST /association/training`, `PATCH /association/training/:id`, `DELETE /association/training/:id`, `POST /association/training-lifecycle/:trainingId/complete`, etc.
- **Partial mitigation:** Some handlers read `session` from context — if the session middleware always runs globally this may be mitigated, but it is [NEEDS MANUAL CONFIRMATION] whether a global auth middleware wraps the entire app
- **Severity:** P0 — potential auth bypass on all training mutations

### [P0-AUTH-02] `createTraining` Has No Officer/Role Check

- **File:** `services/api-ts/src/handlers/training/createTraining.ts`
- **Evidence:** Handler reads `session.user.id` but performs no role check. Any authenticated member could create a training.
- **Severity:** P0 — privilege escalation; members can create trainings

### [P0-AUTH-03] `updateTraining`, `cancelTraining`, `markComplete` Have No Officer Check

- **Files:** `updateTraining.ts`, `cancelTraining.ts`, `markComplete.ts`
- **Evidence:** None contain `requirePosition` or role check. Any authenticated user who knows the training ID and org ID can modify, cancel, or mark complete.
- **Severity:** P0

### [P0-AUTH-04] `markComplete` Has No Auth — Credit Creation Is Unguarded

- **File:** `services/api-ts/src/handlers/training/markComplete.ts`
- **Evidence:** `markComplete` auto-creates CPD credit entries (BR-13). No auth check means any caller can award credits to any person.
- **Severity:** P0 — data integrity + auth bypass

---

## P1 Findings

### [P1-AUTH-05] Frontend Officer Pages Have No Backend Auth Enforcement for Training CRUD

- **Evidence:** `createAccreditedProvider.ts` correctly uses `requirePosition` in handler, but `createTraining.ts`, `updateTraining.ts`, `cancelTraining.ts` do not. The frontend restricts these to officer routes (`/org/$orgSlug/officer/training/`), but backend allows any caller.
- **Severity:** P1 — frontend-only enforcement

### [P1-AUTH-06] CPD Config Endpoint Auth

- **File:** `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/cpd.tsx`
- **API calls:** `GET/PATCH /api/association/member/cpd-config/:orgId`
- **Status:** [NEEDS MANUAL CONFIRMATION] — need to verify `authMiddleware` + officer check on these routes

---

## Routes WITH Proper Auth (Reference)

- `GET /credit-compliance/:organizationId` — confirmed `authMiddleware()` + `officerAuthMiddleware()` in handwired routes (confirmed in `route-protection-handwired.test.ts`)
- `createAccreditedProvider`, `listAccreditedProviders`, `updateAccreditedProvider`, `deleteAccreditedProvider` — all have handler-level `user` check + `requirePosition([SOCIETY_OFFICER, PRESIDENT])`

---

## Summary

| Auth status | Count |
|------------|-------|
| Fully secured (middleware + role) | 5 (accredited providers + credit-compliance) |
| Missing `authMiddleware` in routes (relies on handler session) | ~28 training routes |
| Missing officer/role check entirely | ~8 core training handlers |
| **P0 unguarded mutations** | 4 (create, update, cancel, markComplete) |
