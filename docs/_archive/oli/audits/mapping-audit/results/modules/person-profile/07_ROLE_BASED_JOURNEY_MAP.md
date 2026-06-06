# 07 — Role-Based Journey Map: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile

---

## Roles & Journeys Overview

| Role | Key Journeys |
|------|-------------|
| Member (user) | View profile, Edit profile, Change settings, Delete account, Export data, Manage credits |
| Officer | Same as member + can view other members via directory |
| Admin | List/view/update any person record via admin routes |
| System/Job | Execute account deletion after grace period |

---

## Journey 1: Member Views Own Profile

**Actor**: Authenticated member  
**Route**: `GET /my/profile`

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Navigate to `/my/profile` | — | `_authenticated` layout gate | OK |
| 2 | Load person data | `GET /persons/:person` via `getPersonOptions` SDK | `authMiddleware(["admin","support","user:owner"])` + owner check in handler | OK |
| 3 | Load memberships | `GET /persons/me/memberships` | `authMiddleware(["user"])` | OK |
| 4 | Display trust badges, standing meter | Client-side derived | — | OK |

**E2E coverage**: YES — `profile-settings-actions.spec.ts` tests profile page load and edit.

---

## Journey 2: Member Edits Own Profile

**Actor**: Authenticated member  
**Route**: `PATCH /my/profile` → form submit

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Click "Edit Profile" | — | — | OK |
| 2 | Fill form fields | — | — | OK |
| 3 | Submit | `PATCH /persons/:person` via `updatePersonMutation` | `authMiddleware(["user:owner"])` + `user.id === personId` | OK |
| 4 | Success → form closes | — | — | OK |

**E2E coverage**: YES — `profile-settings-actions.spec.ts` tests specialization edit + persistence.

---

## Journey 3: Member Requests Account Deletion

**Actor**: Authenticated member  
**Route**: Settings → Security tab

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Click "Delete Account" | — | — | OK |
| 2 | Type "DELETE" in confirm input | — | — | OK |
| 3 | Click "Confirm Delete" | `POST /persons/me/delete` | `authMiddleware(["user"])` | OK |
| 4 | Backend sets 30-day grace period | — | Handler checks `user` not null | OK |
| 5 | UI shows "deletion scheduled" banner | — | — | OK |

**E2E coverage**: NO — no E2E test covers account deletion flow.  
**Gap severity**: P1 — destructive PII action with no automated verification.

---

## Journey 4: Member Cancels Account Deletion

**Actor**: Authenticated member (within 30-day grace period)

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Settings shows "deletion scheduled" banner | `GET /persons/me` (P1 bug — unregistered route) | — | BROKEN |
| 2 | Click "Cancel Deletion" | `POST /persons/me/cancel-delete` | `authMiddleware(["user"])` | OK |

**Gap**: Step 1 is broken — settings general tab calls unregistered `GET /persons/me`. The deletion-pending banner may not display correctly if person data fails to load.  
**E2E coverage**: NO.

---

## Journey 5: Member Exports Personal Data (GDPR)

**Actor**: Authenticated member  
**Route**: `/my/data-export`

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Navigate to `/my/data-export` | — | `_authenticated` | OK |
| 2 | Load `DataExport` component | [NEEDS MANUAL CONFIRMATION] | — | UNKNOWN |
| 3 | Trigger export | `GET /persons/me/export` (assumed) | `authMiddleware(["user"])` | OK (if called) |
| 4 | Receive JSON blob | — | Handler checks `session` | OK |

**E2E coverage**: NO — no E2E test for data export flow.  
**Gap severity**: P1 — GDPR/DPA 2012 feature with no automated verification.

---

## Journey 6: Member Manages Notification Preferences

**Actor**: Authenticated member  
**Route**: Settings → Notifications tab

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Open Notifications tab | `GET /persons/me/notification-preferences` | `authMiddleware(["user"])` | OK |
| 2 | Toggle push/email per category | `PATCH /persons/me/notification-preferences` | `authMiddleware(["user"])` | OK |
| 3 | Optimistic update displayed | — | — | OK |

**E2E coverage**: PARTIAL — `profile-settings-actions.spec.ts` verifies toggles are visible and interactive but does NOT verify persistence (no reload check).

---

## Journey 7: Member Manages Privacy Settings

**Actor**: Authenticated member  
**Route**: Settings → Privacy tab

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | Open Privacy tab | `GET /persons/me/privacy` | `authMiddleware(["user"])` | OK |
| 2 | Select org (if multiple) | — | — | OK |
| 3 | Toggle field visibility | `PATCH /persons/me/privacy` | `authMiddleware(["user"])` | OK |
| 4 | Backend validates membership in org | ForbiddenError if not member | Handler logic | OK |

**E2E coverage**: NO — no E2E test for privacy settings.  
**Gap severity**: P2.

---

## Journey 8: Admin Lists/Views Persons

**Actor**: Admin or Support  
**Route**: Admin app (not memberry)

| Step | Frontend Action | API Call | Auth Check | Status |
|------|----------------|----------|------------|--------|
| 1 | List persons | `GET /persons` | `authMiddleware(["admin","support"])` | OK |
| 2 | View person | `GET /persons/:person` | `authMiddleware(["admin","support","user:owner"])` | OK |
| 3 | Update person | `PATCH /persons/:person` | `authMiddleware(["user:owner"])` | MISMATCH |

**Mismatch**: `listPersons` allows `admin` + `support`, `getPerson` allows `admin` + `support` + `user:owner`, but `updatePerson` only allows `user:owner`. Admin cannot update a person's record via this route. [NEEDS MANUAL CONFIRMATION] — is there a separate admin update path?

---

## Journey 9: System Executes Account Deletion

**Actor**: Scheduled job / system process

| Step | Action | Auth Check | Status |
|------|--------|------------|--------|
| 1 | Job checks persons with expired grace period | DB query | No HTTP auth needed |
| 2 | Calls `executeAccountDeletion` handler | No auth in handler | P0 if exposed via HTTP |
| 3 | PII anonymized, sessions killed | — | OK |

**E2E coverage**: NO — complex to test, requires time manipulation.  
**Gap severity**: P2 — unit test exists (`executeAccountDeletion.test.ts`), but no integration test.

---

## Journey Coverage Summary

| Journey | E2E Coverage | Severity of Gap |
|---------|-------------|----------------|
| View Own Profile | YES | — |
| Edit Own Profile | YES | — |
| Request Account Deletion | NO | P1 |
| Cancel Account Deletion | NO | P1 |
| Export Personal Data | NO | P1 |
| Manage Notification Prefs | PARTIAL | P2 |
| Manage Privacy Settings | NO | P2 |
| Admin Manages Persons | NO | P2 |
| System Executes Deletion | NO | P2 |
