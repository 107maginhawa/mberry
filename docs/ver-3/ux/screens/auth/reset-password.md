# Reset Password

- **Route:** `/reset-password`
- **Module:** M01 Auth & Onboarding
- **Access:** Public (unauthenticated; arrived from `/forgot-password` flow)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allow a user to verify their identity via a 6-digit OTP and then set a new password, completing the password reset and logging them in immediately.

## Layout

### Desktop
Centered card (max-width 480px). Two sequential sections within one card. Section 1 — OTP verification: uses the same 6-digit digit-box component as `/register/verify`, with the heading "Enter the code we sent to [email]." Section 2 — New password: initially dimmed/disabled; becomes active after OTP is verified. Contains new password input with strength indicator, confirm password input, and a "Reset Password" primary button. A "Back to login" link at the bottom of the card.

### Mobile
Full-width card. OTP section renders first, takes full width. On mobile, the password fields appear below the OTP section and remain hidden (not just dimmed) until OTP is verified — they animate into view after verification to keep the focus clear. Sticky "Reset Password" button at the bottom of the viewport once the password section is visible.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| OTP section heading | text | "Enter the code we sent to [email]." Email address shown verbatim. |
| Digit input boxes | 6× single-character inputs | Identical behavior to `/register/verify`: auto-advance, auto-submit on 6th digit, paste support, Backspace navigation |
| Countdown timer | text | "Code expires in MM:SS"; turns red below 60 seconds |
| Resend link | link | Same resend behavior as `/register/verify`: up to 3 resends, shows count |
| OTP verified indicator | inline confirmation | Green checkmark and "Code verified" text replaces the OTP section heading after successful verification; OTP boxes become read-only |
| New password | input (type=password) | Show/hide toggle; real-time strength indicator (Weak/Medium/Strong) |
| Confirm password | input (type=password) | Show/hide toggle; validated to match new password on blur |
| Reset Password | button (primary) | Full-width; disabled until OTP is verified and both password fields are valid; shows spinner during submission |
| Back to login | link | Navigates to `/login` |
| Error banner | banner | Account-level errors that cannot be shown inline |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading: Verifying OTP | 6th digit entered | Digit boxes disabled; spinner below boxes |
| Loading: Resetting | User clicks "Reset Password" | Button spinner; password fields disabled |
| Empty | Page first loads | OTP section active; password section dimmed and non-interactive |
| OTP verified | Correct OTP entered | OTP section collapses with green checkmark animation; "Code verified" label persists; password fields become active and editable |
| Error: Incorrect OTP | Wrong code submitted | Same behavior as `/register/verify`: boxes shake, clear, re-focus first box; "Incorrect code. [N] attempts remaining." |
| Error: OTP expired | Timer reaches 0:00 | "Code expired." in red; Resend link becomes prominent |
| Error: Max OTP attempts | 5 incorrect OTP attempts | OTP boxes disabled; "Too many incorrect attempts. Request a new code." |
| Error: Password mismatch | Confirm password does not match new password on blur | Inline error below confirm field: "Passwords do not match." Reset button stays disabled. |
| Error: Weak password | Password fails strength requirements | Inline error below new password field: "Password must be at least 8 characters with 1 uppercase letter and 1 number." Strength indicator shows Weak. |
| Success | Valid OTP + valid new password submitted | "Password reset successfully." auto-redirect to dashboard (user is logged in with a new session; all prior sessions invalidated) |

## Interactions

- OTP entry behaves identically to `/register/verify`: auto-advance, Backspace focus, clipboard paste with auto-submit.
- Password section is visually dimmed and all inputs have `disabled` attribute until OTP verification succeeds; this prevents users from skipping verification.
- After OTP is verified, focus automatically moves to the new password field.
- Password strength indicator updates in real-time against M1-R3 rules: min 8 chars, 1 uppercase, 1 number, not in common-password list.
- Confirm password mismatch is checked on blur of the confirm field and again on form submission.
- On success, all existing sessions for this account are invalidated; the user is issued a new session and lands on their dashboard.
- The email is carried from `/forgot-password` in session state (not in the URL) and shown in the OTP section heading; if session state is lost (e.g., user opened a new tab), the screen shows the OTP entry without the email hint and still functions correctly.
- OTP expiry is 15 minutes from the time it was sent (M1-R1); each resend resets the timer and invalidates the previous code.
