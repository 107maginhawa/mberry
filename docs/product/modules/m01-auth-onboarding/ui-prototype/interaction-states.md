<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Interaction States: Auth & Onboarding (M01)

---

## Module-Wide State Patterns

All screens in M01 follow these 9 interaction state patterns. Screen-specific overrides are documented in `screens.md`.

---

## 1. Loading

**Trigger:** Initial page load, form submission, API call in progress.

### Visual Pattern
- Skeleton placeholders for content areas (grey pulsing blocks matching layout).
- Spinner overlay on submit buttons (replaces button text).
- All form inputs: `disabled` attribute set, reduced opacity (0.6).
- No loading text (skeletons are self-explanatory).

### ARIA Behavior
- Submit button: `aria-busy="true"`, `aria-label="Submitting..."`.
- Content area: `aria-busy="true"` on `<main>`.
- Screen readers: announce "Loading" via `aria-live="polite"` region.

### Duration Rules
- Skeleton shown for > 200ms (no flash for fast loads).
- If loading > 5s: show "This is taking longer than expected..." text.
- If loading > 15s: show timeout error (transition to Unexpected Error state).

---

## 2. Empty

**Trigger:** Page loaded, no user input yet, no pre-filled data.

### Visual Pattern
- Forms: all inputs at default state (no borders highlighted, placeholder text visible).
- OTP: empty digit boxes with subtle border.
- Onboarding wizard: step forms blank (or pre-filled from API if resuming).

### ARIA Behavior
- Focus moves to first interactive element on page load.
- Required fields marked with `aria-required="true"`.
- No error messages present.

### Content Rules
- Registration: all fields blank.
- Login: email blank (unless returnUrl carries email param).
- Account Claim: pre-filled fields from invitation token (read-only fields).
- Onboarding Resume: "Welcome back! You left off at step {N}." banner.

---

## 3. Success

**Trigger:** API returns 2xx, operation completed.

### Visual Pattern
- **Registration:** Brief green checkmark, then navigate to /verify.
- **OTP Verification:** Green checkmark on inputs, then auto-navigate.
- **Login:** No visual (immediate redirect to returnUrl or /my/profile).
- **Password Reset:** "Password reset successfully. Redirecting..." with 3s countdown.
- **Account Claim:** Green banner "Welcome! Account created." then redirect.
- **Onboarding step:** Green checkmark on completed step in stepper, auto-advance.
- **Onboarding complete (step 5):** Celebration screen with "Setup complete!" and CTA.

### ARIA Behavior
- Success messages: `role="status"` with `aria-live="polite"`.
- Auto-navigation: announce "Navigating to {destination}" before redirect.

### Toast Usage
- Use `sonner` toast for non-navigation successes (e.g., "Invitation sent", "MFA enabled").
- Do NOT toast for navigation-based successes (registration, login).

---

## 4. Validation Error

**Trigger:** Client-side validation failure or 400 response from API.

### Visual Pattern
- **Inline errors:** Red text below each invalid field, red border on input.
- **Field-level:** Error icon (exclamation triangle) inside input, right-aligned.
- **Form-level:** Summary banner above form only if >3 field errors.
- **OTP:** "Invalid code" text below digit inputs, all 6 boxes get red border.
- **Password:** Strength meter turns red, specific requirement not met highlighted.

### ARIA Behavior
- Each error message: `<p id="{field}-error" role="alert">`.
- Invalid input: `aria-invalid="true"`, `aria-describedby="{field}-error"`.
- Focus: move to first invalid field on submit attempt.
- Error summary (if shown): `role="alert"`, focus moves there first.

### Error Message Patterns
| Field | Validation | Message |
|-------|-----------|---------|
| email | Empty | "Email is required." |
| email | Invalid format | "Please enter a valid email address." |
| password | Too short | "Password must be at least 8 characters." |
| password | Missing uppercase | "Password must include an uppercase letter." |
| password | Missing number | "Password must include a number." |
| firstName | Empty | "First name is required." |
| licenseNumber | Invalid format | "License number format: {expected}." |
| OTP code | Wrong code | "Invalid code. Please try again." |
| OTP code | Expired | "Code expired. Request a new one." |

---

## 5. Permission Error

**Trigger:** 401 (unauthenticated) or 403 (insufficient role).

### Visual Pattern
- **401 (unauthenticated):** Redirect to /auth/sign-in with returnUrl preserved.
- **403 (insufficient role):** Full-page message: "You don't have access to this page."
- **Onboarding (non-officer):** Redirect to /my/profile.

### ARIA Behavior
- 401 redirect: announce "Session expired. Redirecting to sign in."
- 403 page: `role="alert"`, focus on message. Link: "Go to dashboard."

### M01-Specific Rules
- Public routes (/register, /auth/sign-in, /verify, /forgot-password, /reset-password, /accept-invite): never show permission errors.
- Onboarding wizard: only accessible to officers with active org access.
- MFA enrollment: requires active session.

---

## 6. Unexpected Error

**Trigger:** 500 response, network failure, timeout.

### Visual Pattern
- **Banner:** Red alert bar at top of form area.
- **Message:** "Something went wrong. Please try again."
- **Retry button:** Primary action to retry last operation.
- **Form data:** PRESERVED. Inputs retain their values.

### ARIA Behavior
- Banner: `role="alert"`, `aria-live="assertive"`.
- Focus moves to retry button.

### Recovery
- Retry button re-submits last API call with same payload.
- After 3 retries: "Persistent error. Please try again later or contact support."
- Contact support link: opens mailto or support page.

### Data Preservation
- All form inputs retain values during error state.
- Onboarding wizard: step data saved to API before error occurred (PUT /onboarding/step).
- Registration: form data held in React state (not cleared).

---

## 7. Conflict / Duplicate

**Trigger:** 409 response from API.

### Visual Pattern
- **Registration (duplicate email):** Inline message on email field: "An account with this email already exists." + "Sign in instead?" link.
- **Account Claim (already claimed):** Full message: "This invitation has already been claimed. Sign in to access your account."

### ARIA Behavior
- Conflict message: `role="alert"`.
- Link to resolution action: focusable, `aria-label="Sign in with existing account"`.

### Resolution Actions
| Conflict | Action |
|----------|--------|
| Duplicate email | Link to /auth/sign-in with email pre-filled |
| Already claimed invite | Link to /auth/sign-in |
| License number conflict | "Contact your organization administrator." |

---

## 8. Confirmation / Warning

**Trigger:** User about to perform significant or irreversible action.

### Visual Pattern
- **MFA enrollment:** "Save your backup codes before continuing." warning box (yellow).
- **Onboarding Skip All:** "Are you sure? You can return to setup anytime." inline warning.
- **OTP attempts:** After 3 failures: "2 attempts remaining before lockout." amber text.
- **Account lock approaching:** "1 attempt remaining before account lock." red text.

### ARIA Behavior
- Warning messages: `role="alert"`.
- Confirmation dialogs: focus trap inside dialog, Escape to cancel.
- Countdown text: `aria-live="polite"` for screen reader updates.

### M01-Specific Confirmations
| Action | Confirmation | Destructive |
|--------|-------------|-------------|
| Skip onboarding step | Inline warning text | No |
| Save & Exit onboarding | None (data saved) | No |
| Enable MFA | Backup code display | No |
| Bulk import | Row count + "Proceed?" | No (additive) |

---

## 9. Offline / Sync

**Trigger:** `navigator.onLine === false` or fetch fails with TypeError (network error).

### Visual Pattern
- **Banner:** Amber bar fixed at top: "You appear to be offline. Some features may be unavailable."
- **Submit buttons:** Disabled with `aria-disabled="true"`.
- **Forms:** Inputs remain interactive (user can type), but submission blocked.
- **Onboarding wizard:** "Save failed. Your data is preserved. Will sync when back online."

### ARIA Behavior
- Offline banner: `role="status"`, `aria-live="polite"`.
- When back online: banner changes to "Back online." then fades (3s).
- Submit buttons re-enabled automatically.

### Data Preservation
- Form state maintained in React state / sessionStorage.
- Onboarding wizard: attempted saves queued locally (basic queue, not full offline-first).
- No IndexedDB or service worker offline support (not in M01 scope).

### Detection
- `window.addEventListener('online', ...)` / `window.addEventListener('offline', ...)`
- Also detect on fetch failure (TypeError without response).
