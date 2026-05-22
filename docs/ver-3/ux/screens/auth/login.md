# Login

- **Route:** `/login`
- **Module:** M01 Auth & Onboarding
- **Access:** Public (redirects to dashboard if already authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allow any registered user to authenticate with email/password or receive a passwordless magic link, then land on their dashboard.

## Layout

### Desktop
Centered card (max-width 400px) on a minimal background. Platform logo at top of card. Email input, password input, and "Forgot password?" link stacked vertically. Primary "Log In" button full-width. A text divider ("or") separates the password form from the "Send Magic Link" secondary button. "Don't have an account? Register" link sits below all actions.

### Mobile
Full-width card with no horizontal margin. All touch targets minimum 44px height. Same vertical field order as desktop. Biometric login prompt surfaced if device supports it (future). Keyboard-aware scroll: fields scroll into view when the software keyboard opens. "Send Magic Link" and register link remain visible below the fold; no content is cut off.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Email address | input (type=email) | Standard email input; pre-filled if user was redirected from forgot-password flow |
| Password | input (type=password) | Show/hide toggle on the right side of the field |
| Forgot password? | link | Navigates to `/forgot-password`; positioned directly below password field |
| Log In | button (primary) | Submits credentials; disabled while request is in flight |
| Divider | visual separator | "or" text between credential form and magic link option |
| Send Magic Link | button (secondary) | Uses the email already entered in the email field; sends magic link and replaces the form with confirmation message |
| Don't have an account? Register | link | Navigates to `/register` |
| Error banner | banner | Appears above email field for credential or lockout errors |
| MFA code prompt | inline form | Appears in place of the login button after successful credential check if MFA is enabled; 6-digit TOTP input |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | User clicks "Log In" or "Send Magic Link" | Button shows spinner; all fields and links disabled |
| Empty | Page first loads | Default form; no errors; Log In button is enabled as soon as fields have content |
| Error: Invalid credentials | Wrong email or password submitted | Banner above email field: "Incorrect email or password." No indication of which field is wrong. |
| Error: Account locked | 5 consecutive failed login attempts | Banner: "Account temporarily locked. Try again in [N] minutes, or reset your password." Reset password link in banner. |
| Error: Account pending verification | Unverified account attempts login | Banner: "Please verify your email first. Check your inbox or request a new code." |
| MFA prompt | Credentials valid, MFA enabled for this user | Password section collapses; 6-digit TOTP input appears with label "Enter your authenticator code." Incorrect code shows inline: "Invalid code. Please try again." MFA step does not lock after failures. |
| Magic link sent | User clicks "Send Magic Link" | Form replaced with message: "Check your email for a login link. It expires in 15 minutes." No back/retry shown until 15 minutes elapse. |
| Success | Valid credentials (+ MFA if applicable) | Redirect to dashboard or the originally requested URL if the user was redirected to login mid-session |

## Interactions

- "Send Magic Link" uses the email already typed into the email field; if the email field is empty when clicked, focus moves to the email field with inline hint "Enter your email first."
- Magic link tokens are single-use and expire after 15 minutes (M1-R5).
- Account auto-unlocks after 15-minute lockout cooldown (M1-R4); no officer action required.
- Session created on success lasts 30 days of inactivity; concurrent sessions (desktop + mobile) are allowed.
- If user arrives via redirect (e.g., session expired during onboarding wizard), a banner above the form states: "Your session expired. Log in to continue where you left off." Wizard state is preserved.
