<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Interaction States: Member Profile & Settings (M02)

---

## Module-Wide State Patterns

All screens in M02 follow these 9 interaction state patterns. Screen-specific overrides are documented in `screens.md`.

---

## 1. Loading

**Trigger:** Initial data fetch via TanStack Query, form submission.

### Visual Pattern
- Profile overview: skeleton avatar (circle), skeleton text bars (name, license, specialization), skeleton cards (membership).
- Profile edit: skeleton form fields pre-populating from GET /my/profile.
- ID card: skeleton card shape (credit-card proportions).
- Settings: skeleton toggle grids, skeleton buttons.

### ARIA Behavior
- `aria-busy="true"` on `<main>`.
- Screen reader announcement: "Loading profile..." via `aria-live="polite"`.

### Duration Rules
- Skeleton after 200ms delay (debounce fast loads).
- > 5s: "This is taking longer than expected..."
- > 15s: transition to Unexpected Error.

---

## 2. Empty

**Trigger:** Data loaded successfully but content set is empty or minimal.

### Visual Pattern
- **Profile overview, zero memberships:** "You're not a member of any organization yet." + "Browse organizations" CTA button.
- **ID card, no orgs:** "Join an organization to get your digital ID card."
- **Notification preferences, single org:** No org selector shown, single matrix.
- **Privacy settings, single org:** No org grouping shown.
- **Data export, no previous exports:** Just the "Export My Data" button.

### ARIA Behavior
- Empty state messages: `role="status"`.
- CTA buttons properly labeled.

---

## 3. Success

**Trigger:** API returns 2xx after user action.

### Visual Pattern
- **Profile edit save:** sonner toast "Profile updated." Navigate back to /my/profile.
- **Privacy toggle:** sonner toast "Privacy settings saved."
- **Notification toggle:** sonner toast "Notification preferences updated."
- **Photo upload:** New photo appears in preview immediately (optimistic).
- **Data export request:** sonner toast "Export requested. We'll notify you when it's ready."
- **Export download:** Browser download initiated.
- **Deletion request:** sonner toast "Account deletion scheduled for {date}."
- **Deletion cancel:** sonner toast "Account deletion cancelled." Banner removed.

### ARIA Behavior
- sonner toasts: `role="status"`, auto-dismiss after 4s.
- Navigation-based successes: announce destination.

### Optimistic Updates
- Privacy/notification toggles: UI updates immediately, reverts on error.
- Photo upload: show new photo immediately, revert if upload fails.
- Profile edit: no optimistic update (navigate away on success).

---

## 4. Validation Error

**Trigger:** Client-side validation or 400 from API.

### Visual Pattern
- **Profile edit:** inline red text below invalid fields, red input border.
- **Email change:** "Please enter a valid email address."
- **Photo upload:** "File must be JPEG, PNG, or WebP and under 5MB." (M2-R9)
- **Years of practice:** "Must be a number 0 or greater."

### ARIA Behavior
- `aria-invalid="true"` on invalid inputs.
- Error message: `<p role="alert" id="{field}-error">`.
- Input: `aria-describedby="{field}-error"`.
- Focus: first invalid field.

### Error Messages

| Field | Validation | Message |
|-------|-----------|---------|
| firstName | Empty | "First name is required." |
| firstName | Too long | "First name must be 50 characters or fewer." |
| email | Invalid | "Please enter a valid email address." |
| yearsOfPractice | Negative | "Years of practice must be 0 or greater." |
| photo | Wrong format | "Photo must be JPEG, PNG, or WebP." |
| photo | Too large | "Photo must be under 5MB." |

---

## 5. Permission Error

**Trigger:** 401 (session expired) or 403 (insufficient access).

### Visual Pattern
- **401:** Redirect to /auth/sign-in with returnUrl=/my/profile (or current path).
- **403 (impersonation ended):** "Session ended. Returning to admin dashboard." with redirect.

### ARIA Behavior
- Announce "Session expired. Redirecting to sign in." before redirect.

### M02-Specific Rules
- All M02 routes require GA (global auth). No public M02 screens.
- Platform admin impersonating: if impersonation session expires, redirect to /admin.

---

## 6. Unexpected Error

**Trigger:** 500, network failure, timeout.

### Visual Pattern
- **Profile load fail:** Full-page: "Failed to load profile. Try again." + Retry button.
- **Profile save fail:** Banner: "Save failed. Your changes are preserved. Try again."
- **ID card fail:** "Failed to load ID card. Try again."
- **Settings save fail:** Per-section: "Failed to save. Try again."
- **Export fail:** "Export could not be completed. Try again."

### ARIA Behavior
- Error banners: `role="alert"`, `aria-live="assertive"`.
- Focus: retry button.

### Recovery
- Retry re-fetches or re-submits.
- Form data always preserved during error.
- After 3 retries: "Persistent error. Please try again later."

---

## 7. Conflict / Duplicate

**Trigger:** 409 or 429 response.

### Visual Pattern
- **Data export (already processing):** "An export is already in progress. Please wait for it to complete."
- **Data export (rate limited):** "You can request one export per 24 hours." (M2-R4)
- **Email change (already taken):** "This email is already associated with another account."

### ARIA Behavior
- Conflict messages: `role="alert"`.
- Rate limit messages: include when user can retry ("Try again after {time}").

---

## 8. Confirmation / Warning

**Trigger:** User about to perform significant or irreversible action.

### Visual Pattern
- **Account deletion:** Modal dialog with red border.
  - Title: "Delete your account?"
  - Body: "This will permanently delete your account, profile data, and memberships after a 30-day grace period. Financial records are retained anonymously for 7 years per regulation (BR-32)."
  - Password input for confirmation.
  - Buttons: "Cancel" (secondary) + "Permanently Delete" (destructive red).
- **Email change:** Inline warning: "Changing your email requires verification. A code will be sent to your new email." (M2-R1)
- **Password change:** Warning: "Changing your password will sign you out of all other devices." (M2-R2)

### ARIA Behavior
- Modals: focus trap, Escape to cancel.
- `role="alertdialog"`, `aria-label="Confirm account deletion"`.
- Destructive button: `aria-label="Permanently delete account"`.

### M02 Confirmation Matrix

| Action | Confirmation Type | Destructive |
|--------|------------------|-------------|
| Account deletion | Modal + password | Yes |
| Email change | Inline warning | No |
| Password change | Inline warning | No (but session impact) |
| Remove photo | Inline "Remove?" confirmation | Soft |
| Cancel deletion | No confirmation needed | No |

---

## 9. Offline / Sync

**Trigger:** `navigator.onLine === false` or network error on fetch.

### Visual Pattern
- **Banner:** Amber fixed bar: "You appear to be offline."
- **Profile overview:** Show cached data if TanStack Query cache has it. Badge: "Showing cached data."
- **Profile edit:** Save button disabled. "Can't save while offline."
- **ID card:** Show cached card (no QR code — verification requires network). Badge: "Offline — QR verification unavailable."
- **Settings:** All save buttons disabled.

### ARIA Behavior
- Banner: `role="status"`, `aria-live="polite"`.
- Disabled buttons: `aria-disabled="true"`, tooltip "Requires internet connection."
- When back online: "Back online." banner (3s), buttons re-enabled.

### Data Strategy
- TanStack Query `staleTime`: profile data cached for 5 min.
- Offline reads: served from query cache.
- Offline writes: blocked (no offline queue for M02).
- ID card PDF: not available offline.
