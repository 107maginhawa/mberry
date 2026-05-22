# Forgot Password

- **Route:** `/forgot-password`
- **Module:** M01 Auth & Onboarding
- **Access:** Public (unauthenticated only)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Accept a user's email address and initiate a password reset by sending a 6-digit OTP to that address, without revealing whether the account exists.

## Layout

### Desktop
Centered card (max-width 400px) on a minimal background, matching the visual style of `/login`. "Reset your password" heading at the top of the card. Brief instructional subtext: "Enter your email and we'll send you a reset code." Single email input field, full-width primary "Send Reset Code" button below it, and a "Back to login" link at the bottom.

### Mobile
Full-width card. Same single-field layout. Touch target for the button is min 44px. "Back to login" link has generous tap area. Keyboard opens automatically to email input on page load. No content is hidden below the fold.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Heading | text | "Reset your password" |
| Instructional subtext | text | "Enter your email and we'll send you a reset code." |
| Email address | input (type=email) | Required; standard email format validation on submit |
| Send Reset Code | button (primary) | Full-width; shows spinner while request is in flight; disabled during loading |
| Back to login | link | Navigates to `/login` |
| Success message | inline confirmation | Replaces the form after submission (see States) |
| Rate limit error | banner | Shown above the form if rate limit is hit |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | User clicks "Send Reset Code" | Button shows spinner; email field and button disabled |
| Empty | Page first loads | Default form; button disabled until email field has content |
| Error: Invalid email format | Non-email string submitted | Inline error below email field: "Please enter a valid email address." Request is not sent. |
| Error: Rate limited | More than 3 reset requests within 1 hour for this email | Banner above form: "Too many reset requests. Try again in [N] minutes." Button disabled until the cooldown elapses. |
| Success | Any valid request submitted (account may or may not exist) | Form replaced with: "If an account exists with this email, a verification code has been sent. Check your inbox." User is not redirected automatically — they navigate to `/reset-password` when they have the code. A "Continue to reset" link appears to navigate there, with email pre-filled. |

## Interactions

- The success message is always shown regardless of whether the email has an account (M1 security requirement: no account existence leak).
- Rate limit is 3 requests per hour per email address; the error message includes the minutes remaining until the cooldown ends.
- After the success state is displayed, a "Continue to reset" link navigates to `/reset-password` with the email value carried over (not in URL, stored in session state) so the user does not need to retype it.
- "Back to login" is always visible and functional, including during the loading state (link, not a button, so it is not disabled).
