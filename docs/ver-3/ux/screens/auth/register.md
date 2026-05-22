# Register

- **Route:** `/register`
- **Module:** M01 Auth & Onboarding
- **Access:** Public (unauthenticated only)
- **Desktop:** ✓ | **Mobile:** ✓ (primary surface)

## Purpose

Allow a prospective member to create a platform account by providing their identity and professional license number, with optional org context pre-selected from an org public page.

## Layout

### Desktop
Centered card (max-width 480px) on a minimal background. Platform logo at the top of the card. If the user arrived from an org public page, a read-only org badge (org logo + org name) appears at the top of the card before the form fields. Form fields stacked vertically: full name, email, license number, password. Privacy checkbox and "Create Account" button at the bottom. "Already have an account? Log in" link below the button.

### Mobile
Full-width card, no horizontal margin. Same field order. Generous touch targets (min 44px). Keyboard-aware: each focused field scrolls into view above the software keyboard. Password strength indicator stays visible when password field is active. Org badge (if present) collapses to a single line with org logo and name to save vertical space.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org badge | read-only display | Shown only when `?org=[slug]` query param is present; displays org logo and name; not editable; communicates that account creation will link to this org |
| Full name | input (type=text) | Required; free text |
| Email address | input (type=email) | Required; validated for email format on blur |
| Professional license number | input (type=text) | Required; placeholder shows expected format sourced from association config (e.g., "7-digit number from your PRC card"); format validated against association regex on blur |
| Password | input (type=password) | Required; show/hide toggle; real-time strength indicator below field showing Weak / Medium / Strong |
| Privacy checkbox | checkbox | "I agree to the Privacy Policy and Terms of Service"; both links open in a new tab; form cannot be submitted until checked |
| Create Account | button (primary) | Full-width; disabled until all required fields are filled and privacy checkbox is checked; shows spinner while request is in flight |
| Already have an account? Log in | link | Navigates to `/login` |
| Error banner | banner | Appears above the form for account-level errors (duplicate email, duplicate license) |
| Field error | inline text | Appears below each invalid field in red; field border turns red |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | User clicks "Create Account" | Button shows spinner; all fields and checkbox disabled |
| Empty | Page first loads | Default form; no errors; button is disabled until all fields filled and checkbox checked |
| Error: Duplicate email | Submitted email already has an account | Banner above form: "An account with this email already exists. Log in instead?" with a login link |
| Error: Duplicate license number | Submitted license is already registered | Banner above form: "This license number is already registered. Contact your chapter if you need help." |
| Error: Invalid license format | License input does not match association regex | Inline error below license field: "License number must match the format [example]. Check your PRC card." |
| Error: Weak password | Password fails strength requirements | Inline error below password field: "Password must be at least 8 characters with 1 uppercase letter and 1 number." Strength indicator shows "Weak" in red. |
| Error: Network | Connection lost during submission | Toast notification: "Connection lost. Your data is saved. Try again when you are back online." Form data preserved. |
| Success | Valid form submitted | Transition to `/register/verify`; email confirmation message displayed at top of verify screen |

## Interactions

- License number field shows association-configured format as placeholder text (e.g., "7-digit number"); format hint updates if the org context slug maps to a specific association.
- Password strength indicator updates in real-time as the user types (no debounce needed); evaluated against: min 8 chars, 1 uppercase, 1 number, and a list of 10,000 common passwords (M1-R3).
- Form submission is blocked (button stays disabled) until: all four fields are non-empty, privacy checkbox is checked, and no field is in an error state.
- On success, the user is NOT logged in yet; they proceed to OTP verification at `/register/verify`.
- If org context is present (`?org=[slug]`), a membership application is queued to that org after email verification completes; the member does not need to reselect the org.
- If no org context, after dashboard load the member is prompted to search for their association or request an invite.
