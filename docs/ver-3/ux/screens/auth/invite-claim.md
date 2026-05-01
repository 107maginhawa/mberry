# Invite Claim

- **Route:** `/invite/[token]`
- **Module:** M01 Auth & Onboarding
- **Access:** Public (tokenized, no login required; one-time use per token)
- **Desktop:** ✓ | **Mobile:** ✓ (primary surface — most users arrive from a mobile email client)

## Purpose

Allow a member who was bulk-imported or individually added by an officer to claim their pre-created account, verify their email, and set a password in a single flow — without needing to register from scratch.

## Layout

### Desktop
Centered card (max-width 480px). Org logo (or initials placeholder if no logo) and "Welcome to [Org Name]" heading at the top of the card — communicates whose invitation this is before the user does anything. Below the heading: three read-only display fields showing the imported data (name, email, license number). Then a password input with strength indicator. A primary "Activate My Account" button. After clicking Activate, the OTP input appears inline within the same card (no page navigation). "Already activated? Log in" link at the bottom.

### Mobile
Full-width card. Read-only fields styled as labeled data rows (not text inputs) to make it clear they are not editable. Password field has a show/hide toggle and the strength indicator appears below it. After "Activate My Account" is tapped, the OTP input section slides into view below the button without a page transition. Keyboard opens automatically to the OTP boxes.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org logo | image | Org logo from import; falls back to initials in a colored circle if no logo uploaded |
| Welcome heading | text | "Welcome to [Org Name]" — org name sourced from the token |
| Name | read-only display | Member's full name from import data; clearly labeled; not editable |
| Email | read-only display | Email address from import data; clearly labeled; not editable |
| License number | read-only display | Professional license number from import data; clearly labeled; not editable |
| Password | input (type=password) | Show/hide toggle; real-time strength indicator (Weak/Medium/Strong) |
| Activate My Account | button (primary) | Validates password on click; if valid, sends OTP to the email on file and reveals the OTP input section inline |
| OTP section | inline form | Appears after "Activate My Account" is clicked; same 6-digit box component as `/register/verify`; heading: "Enter the code we sent to [email]"; includes countdown timer and Resend link |
| Already activated? Log in | link | Navigates to `/login` |
| Token error | full-page message | Replaces the card when the token is expired or already claimed (see States) |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading: Token validation | Page first loads | Skeleton card with shimmer while token is verified server-side |
| Loading: Activating | User clicks "Activate My Account" with valid password | Button shows spinner; password field disabled; OTP section not yet visible |
| Loading: Verifying OTP | 6th OTP digit entered | OTP boxes disabled; spinner below boxes |
| Empty | Token is valid and unclaimed | Default card: read-only fields populated, password field empty, OTP section hidden |
| Error: Weak password | Password fails M1-R3 on click | Inline error below password field before OTP is sent: "Password must be at least 8 characters with 1 uppercase letter and 1 number." OTP is not sent. |
| Error: Incorrect OTP | Wrong code entered | Boxes shake and clear; "Incorrect code. [N] attempts remaining." (max 5) |
| Error: OTP expired | Timer reaches 0:00 | "Code expired." Resend link becomes prominent. |
| Error: Token expired | Token is older than 7 days | Full-page message replaces card: "This invitation link has expired. Contact your chapter secretary to resend it." + "Request New Link" button that notifies the org's secretary. |
| Error: Token already claimed | Token has already been used | Full-page message: "This account has already been activated. Log in instead." with a link to `/login`. |
| Error: Token invalid/tampered | Token fails HMAC verification | Full-page message: "This invitation link is not valid. It may have been modified. Contact your chapter for a new invitation." |
| Success | Correct OTP entered after password set | "Welcome aboard!" message with green checkmark animation; auto-redirect to member dashboard. Member is now linked to the org with the imported membership category. Optional onboarding wizard prompt appears on dashboard. |

## Interactions

- "Activate My Account" first validates the password locally (strength check) before making any network request; if password is invalid, no OTP is sent and no request is made.
- Only after password validation passes does the system send the OTP and reveal the OTP section inline — the page does not navigate or reload.
- After the OTP section appears, "Activate My Account" button is replaced by the OTP component; the password field becomes read-only to prevent changes after the OTP is tied to this session.
- OTP behavior is identical to `/register/verify`: auto-advance between boxes, clipboard paste auto-fills and submits, Backspace moves focus left, auto-submit on 6th digit.
- Up to 3 OTP resends allowed (M1-R1); each resend resets the 15-minute timer.
- The "Request New Link" button on the expired-token screen sends a notification to the org's secretary — it does not immediately regenerate a token, as that requires officer action.
- Read-only fields (name, email, license number) use a visually distinct style (e.g., light gray background, no border) so it is immediately obvious they cannot be edited.
- Claim links expire after 7 days (M1-R2); officers can regenerate them from the roster for any unclaimed member.
