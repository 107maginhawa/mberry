# 04 — Frontend Interaction Integrity: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile

---

## Profile Page (`/my/profile`)

### Interactive Elements

| Element | Action | API Call | Backend Handler | Status |
|---------|--------|----------|----------------|--------|
| "Edit Profile" button | Shows `ProfileEditForm` | — | — | OK |
| "Save Changes" button (form submit) | PATCH person | `updatePersonMutation()` → `PATCH /persons/:person` | `updatePerson` | OK |
| "Cancel" button | Hides form | — | — | OK |
| "Publish to Directory" button | POST/PATCH directory profile | `POST /api/association/member/directory/profiles` | directory module | OK |
| Visibility dropdown | PATCH directory visibility | `PATCH /api/association/member/directory/profiles/:id` | directory module | OK |
| "Preview" toggle | Toggles preview mode | — | — | OK |
| Avatar display | Shows avatar from `person.avatar.url` | — | — | OK |

### Form Fields in ProfileEditForm

| Field | Schema Validation | Backend Field | Mismatch? |
|-------|------------------|--------------|-----------|
| First Name | `z.string().min(1)` | `firstName` | OK |
| Last Name | `z.string().optional()` | `lastName` | OK |
| Middle Name | `z.string().optional()` | `middleName` | OK |
| Specialization | `z.string().optional()` | `specialization` | OK |
| License Number | `z.string().optional()` | `licenseNumber` | OK |
| PRC ID | `z.string().optional()` | `prcId` | OK |
| Bio | `z.string().optional()` | `bio` | OK |
| Email | Disabled (display only) | `contactInfo.email` | OK — explicitly locked |
| Phone | `z.string().optional()` | `contactInfo.phone` | OK |
| Timezone | `z.string().optional()` | `timezone` | OK |
| Language | `z.string().optional()` | `preferredLanguage` | OK |
| Street/City/State/Postal/Country | Optional string fields | `primaryAddress.*` | OK |

### Avatar Upload

**Finding**: The profile page displays avatar via `person.avatar.url` and the `updateMyProfile` handler accepts an `avatar` field (tested in `profile-spec-compliance.test.ts`). However, the profile edit form does NOT include an avatar file upload input.

**File**: `apps/memberry/src/routes/_authenticated/my/profile.tsx`  
**Evidence**: No `<input type="file">` or avatar upload component in `ProfileEditForm`. Avatar is stored as `{ fileId, url }` JSONB but no UI flow exists to upload a new file via the storage module.

**Severity**: P2 — Feature advertised (avatar displayed, field accepted by backend) but no UI to change it.

### SDK Call Mismatch

**Finding**: Profile page uses `updatePersonMutation` (targets `PATCH /persons/:person`) not `updateMyProfile` (targets `PATCH /persons/me`). This is technically correct — `updatePerson` handles `me` as a special case mapping to user ID. But it uses the admin-capable route with `user:owner` auth, not the purpose-built `updateMyProfile` route with `user` auth.

**Impact**: No security gap (handler enforces `user.id === personId`), but inconsistent with the intended API design. Two handlers serve the same purpose with different auth middleware.

---

## Settings Page (`/my/settings`)

### Interactive Elements

| Element | Tab | Action | API Call | Handler | Status |
|---------|-----|--------|----------|---------|--------|
| General tab | general | Loads person data | `GET /api/persons/me` | NONE | **P1** — route 404s |
| Delete Account button | security | Shows confirm flow | — | — | OK |
| "Type DELETE" confirm input | security | Validates text = "DELETE" | — | — | OK |
| Confirm Delete button | security | POST delete request | `POST /api/persons/me/delete` | `requestMyAccountDeletion` | OK |
| Cancel Deletion button | security | POST cancel | `POST /api/persons/me/cancel-delete` | `cancelMyAccountDeletion` | OK |
| Push/Email toggle per category | notifications | PATCH preference | `PATCH /api/persons/me/notification-preferences` | `updateMyNotificationPreferences` | OK |
| Privacy toggles per field | privacy | PATCH privacy | `PATCH /api/persons/me/privacy` | `updateMyPrivacySettings` | OK |
| Org selector (privacy) | privacy | Changes active org context | local state | — | OK |
| ChangePasswordCard | security | Better-Auth UI | Better-Auth internal | — | OK |
| TwoFactorCard | security | Better-Auth UI | Better-Auth internal | — | OK |
| PasskeysCard | security | Better-Auth UI | Better-Auth internal | — | OK |
| SessionsCard | security | Better-Auth UI | Better-Auth internal | — | OK |

### Account Deletion Flow

**Positive finding**: Deletion has a proper multi-step confirmation:
1. "Delete Account" → shows warning + text input
2. User must type "DELETE" exactly
3. Only then "Confirm Delete" becomes enabled
4. Backend enforces 30-day grace period

**Gap**: No confirmation dialog for cancelling deletion — cancel is a single click. Low risk (cancelling deletion is safe), but inconsistent UX.

---

## Data Export Page (`/my/data-export`)

Delegates entirely to `DataExport` component in `apps/memberry/src/features/account/components/data-export`.

**File**: `apps/memberry/src/routes/_authenticated/my/data-export.tsx`  
[NEEDS MANUAL CONFIRMATION] — `DataExport` component not audited. Assumed to call `GET /api/persons/me/export` → `exportMyData` handler.

---

## Credits Pages (`/my/credits`, `/my/credits/log`)

**API used**: `GET /api/persons/me/credits` → `getMyCredits` handler  
**Auth gap**: Route has no `authMiddleware` (see FINDING-PP-P0-001). Handler secondary check exists.  
[NEEDS MANUAL CONFIRMATION] — credits/log.tsx content not audited in detail.

---

## Summary of Frontend/Backend Mismatches

| ID | Severity | Finding |
|----|----------|---------|
| FINDING-PP-P1-001 | P1 | Settings general tab calls `GET /persons/me` which is unregistered — likely 404 |
| FINDING-PP-P2-001 | P2 | No avatar upload UI despite backend + handler support |
| FINDING-PP-P2-002 | P2 | Profile page uses `updatePerson` SDK mutation (admin route) instead of `updateMyProfile` route |
