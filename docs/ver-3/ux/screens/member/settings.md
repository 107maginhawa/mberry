# Member Settings

- **Route:** `/my/settings`
- **Module:** M02 Member Profile & Settings
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member manage account security, privacy controls, notification preferences, and account deletion from a single self-service screen.

## Layout

### Desktop
Single-column, max-width 600px, centered. A vertical tab navigation on the left with four tabs: General, Privacy, Security, and Notifications. The active tab's content fills the right area. Each section is a card-style grouping with a heading and its relevant fields or toggles below. The "Danger Zone" (account deletion) lives at the bottom of the General tab, visually separated by a red border/divider.

### Mobile
Full-width. Tabs collapse into a segmented control or a scrollable pill row at the top. Sections within each tab are rendered as accordion-style collapsible rows to conserve vertical space. "Danger Zone" is the last accordion section on the General tab. Bottom nav is visible with the Profile tab active (Settings is a sub-route of the profile area).

## Components

| Component | Type | Description |
|-----------|------|-------------|
| General tab — Edit Profile link | link | Quick navigation to `/my/profile/edit` for name, photo, and professional detail changes. |
| Privacy tab — Email visibility toggle | toggle | On = email visible in org directory to fellow members. Off = hidden. Helper text: "Officers can always see your email regardless of this setting." |
| Privacy tab — Phone visibility toggle | toggle | Same pattern as email toggle. Default: off. |
| Privacy tab — Photo visibility toggle | toggle | Default: on. |
| Privacy tab — Address visibility toggle | toggle | Default: off. |
| Privacy info box | info | "Your name and license number are always visible to officers and in verification checks." Shown at bottom of Privacy tab. |
| Security tab — Change Password form | form | Three fields: current password, new password (with strength meter showing weak/medium/strong in real time), confirm new password. "Update Password" button. Changing password invalidates all other sessions (M2-R2). |
| Security tab — Change Email form | form | New email input. "Send Verification Code" button. OTP input field appears inline after code is sent (6-digit, same component as /verify). Old email remains active until new email is OTP-verified (M2-R1). |
| Security tab — MFA section | form | Toggle to enable/disable TOTP. Enable flow: inline 3-step wizard (scan QR code for authenticator app, enter code to verify, save 10 backup codes). Disable flow: requires current password + TOTP code. |
| Security tab — Active Sessions list | list | Each session row: device icon, device name/browser, IP location (city/country), last active timestamp, "Revoke" button. "Revoke All Other Sessions" button at the bottom. |
| Notifications tab — Preferences matrix | grid | Rows: Dues reminders, Event updates, Training updates, Announcements, Membership status changes, System alerts. Columns: In-app (always on, locked — no toggle shown per M7-R7), Push (toggle), Email (toggle). High-priority rows (dues overdue, security) show "Always on" in the Push column with no toggle (M2-R12). |
| Notifications tab — Weekly digest toggle | toggle | Opt-in. When enabled, shows delivery day selector (default Monday). |
| Notifications tab — Transactional email row | info | "Receipts, password reset, and status change emails are always sent and cannot be disabled." Shown as a read-only note. |
| Danger Zone — Delete Account | button | Destructive, outlined in red. Opens a confirmation dialog. |
| Account deletion dialog | modal | Explains: 30-day grace period, PII anonymization after 30 days, 7-year retention of payment records (anonymized), credit records retained for regulatory compliance, all orgs notified. Requires typing "DELETE" to confirm (or entering password on mobile). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Tab loads | Toggle rows disabled with skeleton animation. |
| Privacy toggle saving | Member flips a toggle | Toggle animates immediately (optimistic update). Brief spinner; confirmed by server within 300ms. Changes take effect in directory within 1 minute (M2-R3). |
| Privacy toggle error | Network error on save | Toggle reverts to previous state. Toast: "Could not save your preference. Check your connection." |
| Password update success | Valid current password + strong new password | Toast: "Password updated." All other sessions are invalidated. Member remains logged in on current session. |
| Password error | Current password incorrect | Inline error below current password field: "Current password is incorrect." |
| Email change — code sent | Member enters new email and clicks "Send Verification Code" | OTP input field appears inline. Confirmation text: "Enter the code sent to [new email]." |
| Email change — verified | Member enters correct OTP | Toast: "Email updated." Old email receives a security notification. |
| MFA enable — step 1 | Member enables MFA toggle | QR code for authenticator app displayed inline. Secret key shown as text fallback. |
| MFA enable — confirmed | Member enters valid TOTP code | 10 backup codes displayed. "Save these somewhere safe" notice. "Done" button closes the inline wizard. |
| Session revoke | Member taps "Revoke" on a session | Session removed from list instantly (optimistic). If revoking the current session, member is logged out. |
| Account deletion blocked | Member has pending payments or is sole officer | Dialog body shows reason: "You have an outstanding payment of [amount] to [Org]." or "You are the only [role] of [Org]. Transfer your role first." Confirm button is disabled. |
| Deletion initiated | Member confirms with "DELETE" | Account marked for deletion. Persistent banner appears on every screen: "Your account is scheduled for deletion on [date]. Cancel deletion?" |

## Interactions

- All privacy toggles save immediately on change with no submit button required; optimistic UI update before server confirmation.
- Password strength meter updates in real time as the member types (weak/medium/strong).
- MFA enable flow is fully inline — no page navigation required; 3 sequential steps render within the Security section.
- Backup codes are displayed in a copyable list with a "Copy All" button and a "Download as text file" option.
- "Revoke All Other Sessions" shows a confirmation dialog: "This will end all other active sessions. You will remain logged in on this device."
- Account deletion dialog requires typing the exact string "DELETE" (case-sensitive) on desktop, or entering the member's current password on mobile for easier input.
- A "Cancel Deletion" link inside the deletion grace-period banner restores full account access, removes the banner, and sends a notification to all org officers that the member cancelled their deletion request.
