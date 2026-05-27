# MODULE SUMMARY: Person/Profile (Module 9)

**Audit Date**: 2026-05-26  
**Auditor**: Journey Test Audit Agent  
**Module**: Person/Profile — Central PII Hub  
**Confidence Score**: 5.5/10

---

## Finding Counts

| Severity | Count |
|----------|-------|
| P0 | 2 |
| P1 | 4 |
| P2 | 6 |
| P3 | 3 |
| **Total** | **15** |

---

## P0 Findings (Must Fix Before Ship)

### FINDING-PP-P0-001: Missing `authMiddleware` on `GET /persons/me/credits`

**File**: `services/api-ts/src/generated/openapi/routes.ts` line 2679  
**Evidence**: Route registered without `authMiddleware(...)`. All other `/persons/me/*` routes have it. This is a defense-in-depth gap on a PII-adjacent endpoint returning CPD credit history.  
**Fix**: Regenerate routes from TypeSpec after adding security annotation to `getMyCredits` operation. Alternatively, ensure global session middleware runs before this route (verify middleware chain).

### FINDING-PP-P0-002: `executeAccountDeletion` has no auth check in handler body

**File**: `services/api-ts/src/handlers/person/executeAccountDeletion.ts`  
**Evidence**: Handler reads `personId` from path param with no `user`/`session` check. Handler is not registered in generated routes.ts.  
**Status**: [NEEDS MANUAL CONFIRMATION] — if invoked only from a trusted job runner (not HTTP), this is acceptable. If there is any HTTP path to this handler (admin route, webhook, etc.), it is a P0 PII exposure.  
**Action Required**: Confirm invocation path. If any HTTP exposure exists, add admin auth check immediately.

---

## P1 Findings

### FINDING-PP-P1-001: Settings general tab calls unregistered `GET /persons/me`

**File**: `apps/memberry/src/routes/_authenticated/my/settings.tsx` line 73  
**Evidence**: `api.get<any>('/api/persons/me')` — no such route exists in `routes.ts`. Hono router does not fall through `/persons/:person` for `me` when sub-routes are registered.  
**Impact**: Settings general tab cannot load profile name/email; account deletion pending banner likely broken.  
**Fix**: Change to `GET /persons/:person` with `person = session.user.id` (same as profile page uses).

### FINDING-PP-P1-002: Dead handler file pairs — maintenance hazard

**Files**: `deleteMyAccount.ts`, `requestAccountDeletion.ts`, `cancelAccountDeletion.ts`, `exportPersonData.ts`, `getNotificationPreferences.ts`, `updateNotificationPreferences.ts`, `getPrivacySettings.ts`, `updatePrivacySettings.ts`  
**Evidence**: None of these appear in `routes.ts` as registered routes. They are older versions superseded by `My*` variants.  
**Impact**: Test files for these dead handlers inflate coverage metrics. Risk of accidental re-wiring.  
**Fix**: Remove dead handler files + their test files, or add `// @deprecated` and a lint rule.

### FINDING-PP-P1-003: No E2E test for account deletion journey

No automated test verifies the account deletion request, grace period display, or cancellation. This is the primary DPA 2012 compliance feature.

### FINDING-PP-P1-004: No E2E test for GDPR data export

`GET /persons/me/export` aggregates PII + memberships + credits. No test verifies the export fires, returns correct shape, or contains real data.

---

## P2 Findings

### FINDING-PP-P2-001: No avatar upload UI

Backend accepts `avatar: { fileId, url }` in `updateMyProfile`. `ProfileEditForm` has no file input — no way for users to change their photo through the UI.

### FINDING-PP-P2-002: Profile page uses `updatePerson` (admin-capable route) instead of `updateMyProfile`

`updatePersonMutation` targets `PATCH /persons/:person` (role: `user:owner`) not `PATCH /persons/me` (role: `user`). No security gap, but inconsistent design.

### FINDING-PP-P2-003: `firstName` missing `max(50)` in frontend Zod schema

DB enforces `varchar(50)` — long names return a DB error instead of a user-friendly validation message.

### FINDING-PP-P2-004: `deleteMyAccount.ts` is dead duplicate of `requestMyAccountDeletion`

Different handler name, same purpose. Causes confusion and test coverage double-counting.

### FINDING-PP-P2-005: `exportPersonData.ts` unregistered — no admin route

Admin-side export handler exists with no HTTP route. If needed for admin use, it must be registered with proper admin auth.

### FINDING-PP-P2-006: Contract tests absent for 6 key privacy/deletion endpoints

No Hurl tests for: credits, export, delete, cancel-delete, notification-preferences, privacy.

---

## P3 Findings

### FINDING-PP-P3-001: Phone field has no format validation

No regex on frontend or backend for phone numbers. International format inconsistency will accumulate.

### FINDING-PP-P3-002: Privacy toggle fires no-op if orgId undefined

Frontend guard `if (!orgId) return` silently does nothing. Should show an error toast.

### FINDING-PP-P3-003: Account deletion confirm is buried in Security tab

No modal — inline expand pattern. Low discoverability. Consider a full-page confirmation or modal.

---

## Product Decisions Needed

1. **Avatar upload flow**: Should avatar be uploaded via the storage module first, then the URL referenced? Currently backend accepts `{ fileId, url }` but there is no upload UI. Decision needed on UX flow (drag-and-drop on profile? crop flow?).

2. **Admin update person route**: `PATCH /persons/:person` is restricted to `user:owner` only. Admins can read but not update person records via HTTP. Is this intentional? If admins need to update PII (e.g., corrections), a separate admin endpoint is needed.

3. **`executeAccountDeletion` invocation path**: Clarify whether this is job-only, admin-triggered, or both. If admin-triggered, it needs an HTTP route with proper admin auth.

4. **Dead handler cleanup**: Confirm the 8 dead handler files can be deleted. They appear to be superseded by `My*` variants. Removing them reduces confusion and test count inflation.

5. **`GET /persons/me` route**: Should this be added as an alias for `GET /persons/:person` with `me`? Or should the frontend be fixed to use the `:person` route? Backend decision affects API surface.

---

## Files Audited

| File | Type |
|------|------|
| `services/api-ts/src/handlers/person/*.ts` | 25 handler files |
| `services/api-ts/src/generated/openapi/routes.ts` (person section) | Generated routes |
| `services/api-ts/src/handlers/person/repos/person.schema.ts` | DB schema |
| `apps/memberry/src/routes/_authenticated/my/profile.tsx` | Frontend route |
| `apps/memberry/src/routes/_authenticated/my/settings.tsx` | Frontend route |
| `apps/memberry/src/routes/_authenticated/my/data-export.tsx` | Frontend route |
| `apps/memberry/tests/e2e/actions/profile-settings-actions.spec.ts` | E2E test |
| `specs/api/src/modules/person.tsp` (via TypeSpec listing) | TypeSpec |
| `specs/api/tests/contract/person-*.hurl` (5 files) | Contract tests |

---

## Confidence Score: 5.5/10

The person module has solid handler-level unit tests and strong spec-compliance tests (AC-M02). The critical gaps are: a P0 auth middleware omission on credits endpoint, a broken Settings general tab, zero E2E coverage for the DPA 2012 deletion and export journeys, and significant dead code accumulation.
