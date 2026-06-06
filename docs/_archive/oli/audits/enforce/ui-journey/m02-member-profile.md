# UI Journey Audit: M02 - Member Profile & Settings

**Date:** 2026-05-27
**Auditor:** oli-ui-journey (automated)
**Module:** m02-member-profile
**Spec sources:** MODULE_SPEC.md, API_CONTRACTS.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md

---

## R1: Action Registry

Every interactive element (button, link, form, toggle) discovered across m02 profile routes.

| ID | Route/Component | Element | Type | Label/Text | Handler/Target |
|----|-----------------|---------|------|------------|----------------|
| A-001 | `/my/profile` | Edit Profile button | Button | "Edit Profile" | `setEditing(true)` |
| A-002 | `/my/profile` | Add Bio button | Button | "Add Bio" | `setEditing(true)` |
| A-003 | `/my/profile` | Settings quick-link | Link | "Settings" | `to="/my/settings"` |
| A-004 | `/my/profile` | Security quick-link | Link | "Security" | `to="/my/settings"` |
| A-005 | `/my/profile` | ID Card quick-link | Link | "ID Card" | `to="/my/id-card"` |
| A-006 | `/my/profile` | Data Export quick-link | Link | "Export Data" | `to="/my/data-export"` |
| A-007 | `/my/profile` | Publish to Directory | Button | "Publish to Directory" | `publishMutation.mutate('memberOnly')` |
| A-008 | `/my/profile` | Hide from Directory | Button | "Hide from Directory" | `publishMutation.mutate('hidden')` |
| A-009 | `/my/profile` | Make public | Button (link variant) | "Make public (visible without login)" | `publishMutation.mutate('public')` |
| A-010 | `/my/profile` (edit) | Save Changes | Button (submit) | "Save Changes" | `handleSubmit(onSubmit)` -> `updatePersonMutation` |
| A-011 | `/my/profile` (edit) | Cancel (header) | Button | "Cancel" | `onCancel` -> `setEditing(false)` |
| A-012 | `/my/profile` (edit) | Cancel (footer) | Button | "Cancel" | `onCancel` -> `setEditing(false)` |
| A-013 | `/my/profile` (edit) | Form fields (10+) | Input/Textarea | firstName, lastName, middleName, specialization, licenseNumber, prcId, bio, phone, timezone, preferredLanguage, street1, street2, city, state, postalCode, country | `register(name)` via react-hook-form |
| A-014 | `/my/settings` | General tab | TabsTrigger | "General" | Tab switch |
| A-015 | `/my/settings` | Privacy tab | TabsTrigger | "Privacy" | Tab switch |
| A-016 | `/my/settings` | Security tab | TabsTrigger | "Security" | Tab switch |
| A-017 | `/my/settings` | Notifications tab | TabsTrigger | "Notifications" | Tab switch |
| A-018 | `/my/settings` | Edit Profile link | Link | "Edit Profile" | `to="/my/profile"` |
| A-019 | `/my/settings` | Delete Account button | Button | "Delete" / confirm dialog | `api.post('/api/persons/me/delete')` |
| A-020 | `/my/settings` | Cancel Deletion button | Button | "Cancel" | `api.post('/api/persons/me/cancel-delete')` |
| A-021 | `/my/settings` (privacy) | Privacy toggles (per-field) | Switch | credentialsVisible, duesStatusVisible, ceComplianceVisible, etc. | `api.patch('/api/persons/me/privacy', { orgId, [field]: value })` |
| A-022 | `/my/settings` (privacy) | Org selector | Select | org dropdown | `setSelectedOrgIndex(idx)` |
| A-023 | `/my/settings` (notifs) | Push/Email toggles per category | Switch | pushEnabled/emailEnabled per category | `api.patch('/api/persons/me/notification-preferences', { category, [field]: value })` |
| A-024 | `/my/data-export` | Request Data Export | Button | "Request Data Export" | `handleRequestExport()` -> `api.get('/api/persons/me/export')` |
| A-025 | `/my/data-export` | Download link (per export) | Anchor | "Download" | `href={e.downloadUrl}` (blob URL) |
| A-026 | `/my/id-card` | Download PDF | Button | "Download PDF" | **disabled** (no handler) |
| A-027 | `/my/notifications` | Category filter chips | Button (6) | All, Announcements, Payments, Events, Training, System | `setActiveCategory(cat)` |
| A-028 | `/my/notifications` | Mark all as read | Button | "Mark all as read" | `markAllRead()` -> `api.post('/api/notifs/read-all')` |
| A-029 | `/my/notifications` | Individual notification row | Clickable div | (notification row) | `onMarkRead(n.id)` -> `api.post('/api/notifs/${id}/read')` |
| A-030 | `/settings/account` | PersonalInfoForm | Form | Personal info fields | `updatePersonMutation` via `buildPatch` |
| A-031 | `/settings/account` | AddressForm | Form | Address fields | `updatePersonMutation` via `buildPatch` |
| A-032 | `/settings/account` | ContactInfoForm | Form | Contact fields | `updatePersonMutation` via `buildPatch` |
| A-033 | `/settings/account` | PreferencesForm | Form | Preferences fields | `updatePersonMutation` via `buildPatch` |
| A-034 | `/settings/account` | Photo upload | FileUpload | Avatar upload | `useFileUpload` -> storage upload |
| A-035 | `/settings/account` | Export My Data | Button | "Download My Data" | `handleExport()` -> `exportMyDataOptions` SDK query |
| A-036 | `/settings/account` | Request Account Deletion | Button | "Request Account Deletion" | `requestMyAccountDeletionMutation` |
| A-037 | `/settings/account` | Cancel Deletion Request | Button | "Cancel Deletion Request" | `cancelMyAccountDeletionMutation` |
| A-038 | `/settings/account` | Deletion confirm dialog | AlertDialog | "Yes, delete my account" / "Cancel" | `requestDeletion.mutate({})` |
| A-039 | `/settings/security` | ChangePasswordCard | Card (3rd-party) | Password change form | `@daveyplate/better-auth-ui` |
| A-040 | `/settings/security` | TwoFactorCard | Card (3rd-party) | 2FA toggle/setup | `@daveyplate/better-auth-ui` |
| A-041 | `/settings/security` | PasskeysCard | Card (3rd-party) | Passkey management | `@daveyplate/better-auth-ui` |
| A-042 | `/settings/security` | SessionsCard | Card (3rd-party) | Active sessions list | `@daveyplate/better-auth-ui` |

**Total actions discovered: 42**

---

## R2: Journey Completion Matrix

Traces each WF-NNN workflow from spec through the UI to verify all steps are completable.

### WF-010: View & Update Profile

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. View profile | Display personal info, photo, memberships, licenses | `/my/profile` shows avatar, name, specialization, bio, memberships, licenses, directory status | PASS |
| 2. Enter edit mode | Click edit | A-001 "Edit Profile" button -> `setEditing(true)` | PASS |
| 3. Edit fields | Name, specialization, license, bio, contact, address | A-013: 16 form fields via react-hook-form | PASS |
| 4. Save changes | Persist to API | A-010 -> `updatePersonMutation` -> `PUT /persons/{person}` | PASS |
| 5. Photo upload | Upload profile photo | A-034 (settings/account) via `useFileUpload`. **Not available on /my/profile edit form** | PARTIAL |
| 6. Privacy toggles | Directory visibility per field | A-021 privacy switches in `/my/settings` Privacy tab | PASS |
| 7. Directory publish | Publish/hide from directory | A-007, A-008, A-009 publish mutation in `/my/profile` | PASS |

**Verdict: PARTIAL** -- Photo upload only on `/settings/account`, not on `/my/profile` edit form.

### WF-011: Account Deletion

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. Request deletion | Click delete, confirm | A-019 (`/my/settings` danger zone) or A-036/A-038 (`/settings/account` AlertDialog) | PASS |
| 2. 30-day grace period | Show countdown, allow cancel | A-020 (`/my/settings`) or A-037 (`/settings/account`) with days remaining display | PASS |
| 3. Cancel deletion | Undo within grace period | A-020 / A-037 cancel mutation | PASS |
| 4. M2-R5: Blocked by payments | Prevent deletion if outstanding dues | Not enforced in frontend -- relies on API 409 response | PASS (API-gated) |

**Verdict: PASS**

### WF-012: Digital ID Card

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. View ID card | Show photo, name, license, org, status, QR | `/my/id-card` shows name initials, member number, org, status badge, QR placeholder | PARTIAL |
| 2. Org selector | Choose which org's card to view | **MISSING** -- no org selector; uses first membership | FAIL |
| 3. Download PDF | Download card as PDF | A-026 button exists but is **permanently disabled** | FAIL |
| 4. QR verification | Scannable QR code | Placeholder div ("QR Code" text), no actual QR generation | FAIL |
| 5. Share verification link | Share link to verify membership | **MISSING** -- no share button or link generation | FAIL |
| 6. Status badge colors | Active=green, Grace=amber, Lapsed=red | Implemented via STATUS_BADGE_COLORS mapping | PASS |

**Verdict: FAIL** -- 4 of 6 steps incomplete.

### WF-013: Notification Preferences

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. View preferences | Show per-category toggles per org | `/my/settings` Notifications tab shows categories with push/email toggles | PASS |
| 2. Toggle push per category | Enable/disable push per category | A-023 switch toggles | PASS |
| 3. Toggle email per category | Enable/disable email per category | A-023 switch toggles | PASS |
| 4. Per-org preferences | Different prefs per org | **NOT VERIFIED** -- no org selector visible in NotificationPreferencesSection | FAIL |
| 5. In-app always on (M2-R8) | Cannot disable in-app notifications | UI note says "In-app notifications are always on" | PASS |

**Verdict: PARTIAL** -- Missing per-org notification preferences selector.

### WF-014: Data Export

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. Request export | Click export button | A-024 (`/my/data-export`) or A-035 (`/settings/account`) | PASS |
| 2. Rate limit (24h) | One export per 24h | `/my/data-export` uses localStorage-based rate limit | PASS |
| 3. Async generation | Queue export, notify when ready | `/my/data-export` does synchronous GET and creates blob. **Not async per spec** | DEVIATION |
| 4. Download ZIP | 7-day TTL download | Downloads JSON blob immediately, not ZIP. No 7-day TTL | DEVIATION |
| 5. Export status tracking | Show processing/ready/expired | `/my/data-export` has status table but data is client-side only | DEVIATION |

**Verdict: PARTIAL** -- Export works but implementation deviates from spec (sync vs async, JSON vs ZIP).

### Privacy Settings (no WF-ID)

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. View privacy settings | Show per-field visibility toggles | `/my/settings` Privacy tab with org-scoped toggles | PASS |
| 2. Per-org privacy | Different privacy per org | Org selector dropdown present | PASS |
| 3. Toggle fields | credentialsVisible, duesStatusVisible, ceComplianceVisible | Switch components with API PATCH | PASS |

**Verdict: PASS**

### Change Password/Email (no WF-ID)

| Step | Spec Requirement | UI Implementation | Status |
|------|-----------------|-------------------|--------|
| 1. Change password | Password change form with OTP | `/settings/security` ChangePasswordCard (3rd-party) | PASS (delegated) |
| 2. Change email | Email change with OTP verification | **MISSING** -- no email change UI found | FAIL |
| 3. MFA toggle | Enable/disable 2FA | `/settings/security` TwoFactorCard | PASS (delegated) |
| 4. View sessions | List active sessions | `/settings/security` SessionsCard | PASS (delegated) |
| 5. Session revocation on password change (AC-M02-008) | Revoke all sessions after password change | Delegated to better-auth-ui -- **not verified** | UNKNOWN |

**Verdict: PARTIAL** -- Email change missing.

---

## R3: Element-to-Action Binding

Maps each interactive element to its API call.

| Element ID | UI Action | API Endpoint | HTTP Method | SDK Hook | Binding Type |
|------------|-----------|-------------|-------------|----------|--------------|
| A-010 | Save profile edits | `/persons/{person}` | PUT | `updatePersonMutation()` | SDK generated |
| A-007/008/009 | Directory publish/hide | `/association/member/directory/profiles` or `/{id}` | POST/PATCH | Raw `api.post`/`api.patch` | Hand-wired |
| A-019 | Delete account (settings) | `/api/persons/me/delete` | POST | Raw `api.post` | Hand-wired |
| A-020 | Cancel deletion (settings) | `/api/persons/me/cancel-delete` | POST | Raw `api.post` | Hand-wired |
| A-021 | Privacy toggle | `/api/persons/me/privacy` | PATCH | Raw `api.patch` | Hand-wired |
| A-023 | Notification pref toggle | `/api/persons/me/notification-preferences` | PATCH | Raw `api.patch` | Hand-wired |
| A-024 | Request data export | `/api/persons/me/export` | GET | Raw `api.get` | Hand-wired |
| A-028 | Mark all notifs read | `/api/notifs/read-all` | POST | Raw `api.post` | Hand-wired |
| A-029 | Mark single notif read | `/api/notifs/${id}/read` | POST | Raw `api.post` | Hand-wired |
| A-030-033 | Account settings forms | `/persons/{person}` | PUT | `updatePersonMutation()` via `buildPatch` | SDK generated |
| A-034 | Photo upload | `/storage/upload` | POST | `useFileUpload()` | SDK flow |
| A-035 | Export (account page) | (generated SDK) | GET | `exportMyDataOptions()` | SDK generated |
| A-036 | Request deletion (account) | (generated SDK) | POST | `requestMyAccountDeletionMutation()` | SDK generated |
| A-037 | Cancel deletion (account) | (generated SDK) | DELETE | `cancelMyAccountDeletionMutation()` | SDK generated |
| A-026 | Download PDF | **NONE** | -- | -- | **DEAD** |

**Observation:** Two parallel implementations exist for profile edit, data export, and account deletion (one in `/my/settings` hand-wired, one in `/settings/account` SDK-based). This creates maintenance risk and potential behavior drift.

---

## R4: Role Journey Completion

Can the `member` role complete all m02 workflows?

| Workflow | Required Permission | Member Role Has It? | Journey Completable? |
|----------|-------------------|--------------------|--------------------|
| WF-010: View & Update Profile | GA (all authenticated) | YES | YES (partial -- no photo upload on edit form) |
| WF-011: Account Deletion | GA (account owner) | YES | YES |
| WF-012: Digital ID Card | GA (all authenticated) | YES | NO -- PDF disabled, no QR, no org selector |
| WF-013: Notification Preferences | GA (all authenticated) | YES | PARTIAL -- no per-org selector |
| WF-014: Data Export | GA (all authenticated) | YES | YES (with deviations) |
| Privacy Settings | GA (all authenticated) | YES | YES |
| Security Settings | GA (all authenticated) | YES | PARTIAL -- no email change |

**All permission gates allow member role access. Failures are implementation gaps, not permission issues.**

---

## R5: Dead Interactions

### P0 -- Dead API Calls / Broken Handlers

| Finding ID | Element | Issue | Severity |
|------------|---------|-------|----------|
| J-M02-001 | A-026: Download PDF button | Button is permanently `disabled` with no handler. `GET /my/id-card/:orgId/pdf` endpoint specified in API_CONTRACTS but no frontend call exists. | P0 |
| J-M02-002 | A-019/A-020: Settings delete/cancel | Uses non-standard hand-wired endpoints (`/api/persons/me/delete`, `/api/persons/me/cancel-delete`) while `/settings/account` uses SDK-generated mutations. Unknown if hand-wired endpoints exist on backend. | P1 |
| J-M02-003 | A-024: Data Export (`/my/data-export`) | Calls `GET /api/persons/me/export` (hand-wired). Spec says `POST /my/data-export`. Endpoint mismatch -- may 404 if backend follows spec. | P0 |

### P1 -- Noop / Stub Interactions

| Finding ID | Element | Issue | Severity |
|------------|---------|-------|----------|
| J-M02-004 | QR Code placeholder | `/my/id-card` renders a static div with text "QR Code" instead of actual QR. No QR library imported. | P1 |
| J-M02-005 | Share Verification Link | Spec requires share button on ID card. Not implemented at all. | P1 |
| J-M02-006 | Org selector on ID card | Spec requires org selector for multi-org members. Not implemented -- uses first membership. | P1 |
| J-M02-007 | Email change | Spec lists email change with OTP in settings. No UI exists for this. | P1 |
| J-M02-008 | Per-org notification prefs | Spec says notification preferences are per-org. No org selector in NotificationPreferencesSection. | P1 |

### P2 -- UX Concerns

| Finding ID | Element | Issue | Severity |
|------------|---------|-------|----------|
| J-M02-009 | Duplicate implementations | Profile edit exists on both `/my/profile` (inline edit) and `/settings/account` (form cards). Data export on both `/my/data-export` and `/settings/account`. Account deletion on both `/my/settings` and `/settings/account`. | P2 |
| J-M02-010 | A-004: Security quick-link | Links to `/my/settings` but security is at `/settings/security`. User lands on wrong page. | P2 |
| J-M02-011 | Data export implementation | Client-side rate limiting via localStorage (bypassable). Synchronous JSON download vs spec's async ZIP with notification. | P2 |
| J-M02-012 | Profile edit: email disabled | Email field shown as disabled with note "managed through account settings" but no link to those settings provided. | P2 |
| J-M02-013 | ID card: no real photo | Uses initials avatar even when photo exists. Spec says photo on card. | P2 |

---

## R6: Navigation Integrity

| Source | Link Target | Resolves? | Notes |
|--------|------------|-----------|-------|
| `/my/profile` | `/my/settings` (A-003) | YES | Settings quick-link |
| `/my/profile` | `/my/settings` (A-004) | WRONG | Labeled as "Security" but links to `/my/settings` not `/settings/security` |
| `/my/profile` | `/my/id-card` (A-005) | YES | ID Card quick-link |
| `/my/profile` | `/my/data-export` (A-006) | YES | Export quick-link |
| `/my/settings` | `/my/profile` (A-018) | YES | Edit Profile link in General tab |
| `/my/profile` breadcrumb | `/dashboard` | YES (assumed) | Standard breadcrumb |
| `/my/data-export` breadcrumb | `/dashboard` | YES (assumed) | Standard breadcrumb |
| `/my/id-card` breadcrumb | `/dashboard` | YES (assumed) | Standard breadcrumb |
| `/my/notifications` breadcrumb | `/dashboard` | YES (assumed) | Standard breadcrumb |
| `/settings/account` | (no outbound links) | N/A | Self-contained page |
| `/settings/security` | (no outbound links) | N/A | Self-contained page |

**Navigation gap:** No cross-links between `/my/settings` and `/settings/account` or `/settings/security`. Two separate settings hierarchies (`/my/settings` and `/settings/*`) with overlapping functionality but no navigation bridge.

---

## Findings Summary

### Critical (P0) -- 3 findings

| ID | Summary |
|----|---------|
| J-M02-001 | **Download PDF button permanently disabled** on ID card. Endpoint exists in spec (`GET /my/id-card/:orgId/pdf`) but no frontend implementation. |
| J-M02-003 | **Data export endpoint mismatch.** Frontend calls `GET /api/persons/me/export`, spec defines `POST /my/data-export`. May 404 in production. |
| J-M02-010 | **Security quick-link goes to wrong page.** Profile page "Security" link goes to `/my/settings` instead of `/settings/security`. |

### High (P1) -- 6 findings

| ID | Summary |
|----|---------|
| J-M02-002 | Hand-wired deletion endpoints in `/my/settings` may not exist; `/settings/account` uses proper SDK mutations. |
| J-M02-004 | QR code on ID card is a static placeholder, not a real QR. |
| J-M02-005 | Share Verification Link missing from ID card (spec-required). |
| J-M02-006 | No org selector on ID card for multi-org members (spec-required). |
| J-M02-007 | Email change UI missing from security settings (spec-required). |
| J-M02-008 | Notification preferences lack per-org selector (spec-required). |

### Medium (P2) -- 5 findings

| ID | Summary |
|----|---------|
| J-M02-009 | Duplicate implementations for profile edit, data export, and account deletion across two route hierarchies. |
| J-M02-011 | Data export uses client-side localStorage rate limiting (bypassable) and synchronous JSON instead of spec's async ZIP. |
| J-M02-012 | Disabled email field on profile edit has no link to where email can actually be changed. |
| J-M02-013 | ID card uses initials avatar instead of actual photo. |
| Navigation | Two disconnected settings hierarchies (`/my/settings` vs `/settings/*`) with no cross-navigation. |

### Health Score

| Metric | Value |
|--------|-------|
| Workflows specified | 7 (WF-010 through WF-014 + Privacy + Security) |
| Workflows fully passing | 2 (WF-011 Account Deletion, Privacy Settings) |
| Workflows partial | 4 (WF-010, WF-013, WF-014, Security) |
| Workflows failing | 1 (WF-012 Digital ID Card) |
| Total actions registered | 42 |
| Dead/noop actions | 1 (A-026 disabled PDF button) |
| Endpoint mismatches | 1 (data export GET vs POST) |
| Navigation errors | 1 (security quick-link) |
| **Overall health** | **5/10** |

### Recommended Fix Order

1. **J-M02-010** (P0, quick fix) -- Fix security quick-link target from `/my/settings` to `/settings/security`
2. **J-M02-003** (P0) -- Align data export to use SDK-generated `POST /my/data-export` or verify backend has `GET /persons/me/export`
3. **J-M02-001** (P0) -- Implement PDF download on ID card or remove disabled button
4. **J-M02-006** (P1) -- Add org selector to ID card page
5. **J-M02-004** (P1) -- Integrate real QR code library (e.g., `qrcode.react`)
6. **J-M02-008** (P1) -- Add org selector to notification preferences
7. **J-M02-007** (P1) -- Add email change UI to security settings
8. **J-M02-009** (P2) -- Consolidate duplicate settings/profile/export implementations
