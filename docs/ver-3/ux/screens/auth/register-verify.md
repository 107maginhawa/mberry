# Register — OTP Verification

- **Route:** `/register/verify`
- **Module:** M01 Auth & Onboarding
- **Access:** Public (unauthenticated; reachable only after completing `/register` form submission)
- **Desktop:** ✓ | **Mobile:** ✓ (primary surface)

## Purpose

Verify ownership of the email address provided during registration by entering a 6-digit one-time code sent to that address, completing account creation.

## Layout

### Desktop
Centered card on a minimal background, same visual container as `/register`. Large heading: "Enter verification code." Subtext below the heading: "We sent a 6-digit code to [email address]." Six individual digit input boxes arranged in a single horizontal row, center-aligned, with generous spacing between boxes. Countdown timer below the boxes. "Didn't receive a code? Resend" link below the timer. "Use a different email" link below that, returning the user to `/register`.

### Mobile
Full-width card. Digit boxes scale to fill the available width with equal spacing — each box is large enough to be tapped comfortably (min 48px × 56px). Auto-focus on the first digit box when the screen loads. Software keyboard opens automatically (numeric keypad preferred). Paste from clipboard (e.g., from email app or SMS) auto-fills all six boxes without requiring individual taps.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Heading | text | "Enter verification code." |
| Email confirmation | text | "We sent a 6-digit code to [email]." Email address displayed verbatim from registration. |
| Digit input boxes | 6× single-character inputs | Auto-advance focus to the next box after each digit is entered; Backspace moves focus to the previous box and clears it; auto-submit triggers when the 6th digit is entered |
| Countdown timer | text | Shows remaining validity: "Code expires in MM:SS"; updates every second; turns red below 60 seconds |
| Resend link | link | "Didn't receive a code? Resend" — triggers a new OTP and resets the timer; shows resend count: "(2 of 3 resends remaining)"; disabled after 3 resends |
| Use a different email | link | Returns user to `/register` with fields pre-filled except password; allows email correction |
| Loading indicator | spinner | Appears below digit boxes while verification request is in flight; boxes disabled |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading: Verifying | 6th digit entered | Digit boxes disabled; spinner appears below boxes; auto-submit fires |
| Loading: Resending | User clicks Resend | Resend link replaced by "Sending…" text; link re-enables after confirmation |
| Empty | Page first loads | Cursor in first digit box; timer running; all boxes empty |
| Error: Incorrect code | Wrong OTP submitted | All six boxes shake briefly, clear, and re-focus on the first box; inline error below boxes: "Incorrect code. [N] attempts remaining." (max 5 attempts) |
| Error: OTP expired | Timer reaches 0:00 | Timer shows "Code expired." in red; Resend link becomes prominent button; digit boxes remain editable so user can still try a recently arrived code |
| Error: OTP service unavailable | Backend cannot send OTP | Banner: "We are having trouble sending verification codes. Please try again in a few minutes." Retry button visible. |
| Error: Max attempts reached | 5 incorrect attempts | All boxes disabled; message: "Too many incorrect attempts. Request a new code." Resend link shown as button (if resends remain) |
| Error: Max resends reached | 3 resends used | Resend link hidden; message: "Maximum resend limit reached. Contact support if you did not receive a code." |
| Success | Correct OTP entered | Green checkmark animation on the digit boxes; brief pause (~500ms); auto-redirect to member dashboard. If org context was present at registration, membership application is submitted to that org. |

## Interactions

- Pasting a 6-digit string from clipboard auto-fills all boxes simultaneously and triggers auto-submit — no button tap required.
- Auto-submit fires immediately when the 6th digit is entered (no submit button on this screen).
- Backspace in an empty box moves focus left to the previous box and clears it.
- OTP codes expire after 15 minutes (M1-R1); the countdown timer reflects this.
- Each resend resets the 15-minute timer and invalidates the previous code.
- After 5 incorrect attempts the current OTP is invalidated; the user must request a new code to continue (M1-R1).
- Up to 3 resends are allowed per session (M1-R1); the resend count label updates after each use.
- If the user navigates back to `/register` via "Use a different email," the previously sent OTP is invalidated and a new one is sent after re-submission.
