---
# Module 1: Auth & Onboarding

## Overview
- **Purpose:** Provide secure access to the platform for all user types and guide new users (both members and officers) through first-time setup so they reach value as fast as possible.
- **Phase:** 1
- **Monetization tier:** Free
- **Dependencies:** None (foundation module)

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 1.1 | Self-registration with license validation | New member registers with name, email, password, and professional license number. License format is validated against a configurable regex pattern defined per association by the platform admin. Registration uses a 6-digit OTP sent to the provided email (not a click-link) so the user stays in-app on mobile. | Member | P0 |
| 1.2 | Email + password login | Standard credential-based login with session management, rate-limited to prevent brute force. Account locked after 5 consecutive failures with auto-unlock after 15-minute cooldown. | All users | P0 |
| 1.3 | Magic link login | Passwordless login via time-limited email link. Link expires after 15 minutes and can only be used once. | Member | P0 |
| 1.4 | Password reset | Self-service password reset. User enters email, receives a 6-digit OTP (same in-app pattern as registration). OTP expires after 15 minutes. Rate-limited to 3 requests per hour per email. | All users | P0 |
| 1.5 | Account claim flow (invitation) | When members are bulk-imported by an officer, they receive an email invitation with a unique token link. Flow: click link, land on claim page (pre-populated with name, license number, email from import), verify email via 6-digit OTP, set password, account activated. Claim links expire after 7 days and are resendable by officers. | Member (imported) | P0 |
| 1.6 | Smart onboarding wizard (org-type-aware) | After an officer's first login, a guided setup wizard tailored to their org type. **Chapter:** Import member list, set dues amount, configure fund allocation, connect payment gateway, send welcome/invite emails. **Society:** Create first training, set credit values, invite members. **National body:** Configure CPD requirements, set credit cycle period, connect chapters. Wizard supports save-and-resume at every step. Officer sees immediate value after the member import step (dashboard populates with roster count and action cards). Wizard is resumable from the last incomplete step. | Officer | P0 |
| 1.7 | Member onboarding wizard (optional, post-dashboard) | After a new member sees their dashboard for the first time, an optional wizard prompts them to complete their profile: upload photo, set specialization, configure privacy preferences. This wizard is NOT a gate -- members can dismiss it and return to it later from their profile settings. A subtle prompt ("Complete your profile -- 2 steps left") appears on the dashboard until completed or dismissed 3 times. | Member | P0 |
| 1.8 | Multi-factor authentication | Optional TOTP-based second factor. Configurable per association: platform admin or association admin can mandate MFA for all officers or leave it optional for members. MFA enrollment uses a standard authenticator app flow (QR code + backup codes). | All users | P0 |
| 1.9 | Invite system | Officers can send individual email invitations to prospective members. Invitation includes org name, a personalized message, and a registration link with the org pre-selected. Invitations are tracked (sent, opened, claimed) for officer visibility. | Officer | P0 |
| 1.10 | Session management | Sessions expire after 30 days of inactivity. Active sessions listed in security settings. Users can revoke individual sessions. Concurrent sessions allowed (desktop + mobile). | All users | P0 |

## User Journeys

### M-1: Member Self-Registration
**Actor:** Prospective member (healthcare professional)
**Trigger:** Visits memberry.com or an org public page and clicks "Register" or "Apply to Join"

**Steps:**
1. User lands on /register. If arriving from an org public page, the org is pre-selected.
2. User enters full name, email address, professional license number, and password.
3. System validates email format, password strength (min 8 chars, 1 uppercase, 1 number), and license number format against the association's configured regex.
4. System sends a 6-digit OTP to the provided email address. User stays on the /verify page.
5. User enters the OTP within 15 minutes. System verifies the code.
6. Account is created. If the user arrived from an org public page, a membership application is submitted to that org (pending officer approval). If self-service (no org context), the user is prompted to search for their association/chapter or request an invite.
7. User lands on their dashboard. The optional member onboarding wizard prompt appears.

**Success outcome:** Member has an active account. If org-linked, application is pending. Dashboard is visible.
**Error paths:**
- Duplicate email: "An account with this email already exists. Log in instead?"
- Duplicate license number: "This license number is already registered. Contact your chapter if you need help."
- Invalid license format: "License number must match the format [example]. Check your PRC card."
- OTP expired: "Code expired. Request a new one." (resend button, max 3 resends)
- OTP incorrect: "Incorrect code. You have [N] attempts remaining." (max 5 attempts before lockout)

---

### M-2: Claim Invitation Link
**Actor:** Member who was bulk-imported or individually added by an officer
**Trigger:** Receives claim email: "You have been added to [Org Name] on Memberry. Claim your account."

**Steps:**
1. Member clicks the claim link in the email. Lands on /accept-invite/[token].
2. Page shows pre-populated data from the import: name, license number, email (read-only).
3. Member enters a new password.
4. System sends a 6-digit OTP to the email on file. Member enters OTP on the same page.
5. Account is activated. Member is now linked to the org with the imported membership category.
6. Member lands on their dashboard with dues status, upcoming activities, and announcements visible.
7. Optional onboarding wizard prompt appears (complete profile, set privacy preferences).

**Success outcome:** Imported member has a working account with all imported data preserved. Full access to org features.
**Error paths:**
- Token expired (>7 days): "This invitation link has expired. Contact your chapter secretary to resend it." With a "Request New Link" button that notifies the org's secretary.
- Token already claimed: "This account has already been activated. Log in instead."
- Email mismatch (token tampered): "Invalid invitation. Contact your chapter for a new link."

---

### M-3: Login
**Actor:** Any registered user
**Trigger:** Navigates to /login or is redirected after session expiry

**Steps:**
1. User enters email and password on /login.
2. System validates credentials.
3. If MFA is enabled for this user, system prompts for TOTP code.
4. On success, session is created. User is redirected to their dashboard (or the page they were trying to access).
5. If the user has memberships in multiple orgs, the dashboard shows a combined view (not an org selector gate).

**Success outcome:** User is authenticated and on their dashboard.
**Error paths:**
- Invalid credentials: "Incorrect email or password." (no indication of which is wrong)
- Account locked (5 failures): "Account temporarily locked. Try again in 15 minutes, or reset your password."
- MFA code incorrect: "Invalid code. Please try again." (allows retry, does not lock after failures in MFA step)
- Account pending verification: "Please verify your email first. Check your inbox or request a new code."

---

### M-4: Password Reset
**Actor:** Any user who has forgotten their password
**Trigger:** Clicks "Forgot password?" on the login page

**Steps:**
1. User enters their email on /forgot-password.
2. System always responds with "If an account exists with this email, a verification code has been sent." (no account existence leak)
3. If account exists, a 6-digit OTP is sent to the email.
4. User enters OTP on /reset-password.
5. User enters and confirms a new password.
6. Password is updated. All existing sessions are invalidated. User is logged in with a new session.

**Success outcome:** Password changed. User is logged in.
**Error paths:**
- OTP expired (15 minutes): "Code expired. Request a new one."
- Rate limited (3 requests/hour): "Too many reset requests. Try again in [N] minutes."
- Weak password: "Password must be at least 8 characters with 1 uppercase letter and 1 number."

---

### M-5: Smart Onboarding Wizard (Officer -- New Org Setup)
**Actor:** Officer (typically Secretary or President) setting up a new organization
**Trigger:** First login after org is provisioned (by platform admin or self-service creation)

**Steps:**
1. Officer logs in and sees the onboarding wizard overlay. Wizard shows a progress stepper with all steps visible so the officer knows the full scope upfront.
2. **Step 1 -- Org Profile:** Enter org name, upload logo, set contact info, meeting schedule. Save and continue.
3. **Step 2 -- Import Members:** Download CSV template. Upload filled CSV. System validates rows independently (per M1-R10). Preview: valid rows, invalid rows with errors, already-linked members. Officer confirms import. Claim emails queued.
   - *Value moment:* After import, a summary card appears: "[N] members imported. Your roster is ready." Dashboard preview shows member count.
4. **Step 3 -- Configure Dues:** Set membership categories and dues rates per category. Set grace period. Configure fund allocation percentages (must total 100%).
5. **Step 4 -- Connect Payment Gateway:** Enter PayMongo or Stripe API keys. Run a test transaction (small amount, auto-refunded). If skipped, org can only record manual payments.
6. **Step 5 -- Send Welcome Emails:** Preview the welcome/claim email. Select recipients (all imported, or specific groups). Send.
7. Wizard complete. Officer lands on the full dashboard with smart action cards populated from imported data.

**Success outcome:** Org is fully configured. Members are imported and receiving claim emails. Officer can start collecting dues.
**Error paths:**
- CSV import errors: Invalid rows shown with specific field errors. Officer can download error rows as CSV, fix, and re-upload.
- Gateway test fails: "Connection failed. Check your API keys." Officer can skip and configure later.
- Save-and-resume: At every step, progress is auto-saved. If the officer closes the browser and returns, the wizard resumes at the last incomplete step.
- Officer leaves wizard mid-way: A "Resume setup" banner appears on the dashboard until the wizard is completed or explicitly dismissed.

---

### CO-1: Officer Onboarding (Sets Up Org from Scratch)
**Actor:** Chapter President or designated founding officer
**Trigger:** Self-service signup from memberry.com "Get Started" button, or via an invite link from another officer, or provisioned by platform admin

**Steps:**
1. Officer creates an account (same as M-1 registration flow, but with org creation intent).
2. After account creation, officer is prompted: "Create your organization" or "Join an existing organization."
3. If creating new org: enters org name, selects org type (chapter/society/national), selects association.
4. Org is provisioned. Officer is assigned the President role by default.
5. Smart Onboarding Wizard (M-5) begins automatically.
6. Each wizard step saves independently. Officer can leave and return at any point.
7. After completing the member import step (Step 2), the dashboard immediately shows roster data and action cards, even if remaining steps are incomplete. This is the "first value moment."

**Success outcome:** New org is created, configured, and the officer has a populated dashboard within 15 minutes.
**Error paths:**
- Duplicate org name within association: "An organization with this name already exists in [Association]. Contact platform support if this is your chapter."
- Officer already belongs to the same org: "You are already a member of [Org]. Log in to access it."

## Business Rules

This module references the following global business rules:

| Rule | Relevance to this module |
|------|--------------------------|
| BR-22 | Automatic member matching on import -- wizard Step 2 matches existing accounts by email or license number |
| BR-24 | Invitation Expiry -- 7-day expiry for officer-generated invitation links; M1-R2 implements the module-specific detail |
| BR-25 | OTP registration flow -- 6-digit OTP, 10-minute expiry pattern used for registration and claim flows |
| BR-26 | Session Management -- concurrent session handling, 24-hour token expiry, device-linked sessions |

**Module-specific rules:**

| Code | Rule |
|------|------|
| M1-R1 | OTP codes are 6 digits, expire after 15 minutes, and can be resent up to 3 times per session. After 5 incorrect attempts, the OTP is invalidated and a new one must be requested. |
| M1-R2 | Claim invitation tokens expire after 7 days. Expired tokens can be regenerated by any officer of the org. |
| M1-R3 | Password requirements: minimum 8 characters, at least 1 uppercase letter, at least 1 number. Checked against a list of 10,000 common passwords. |
| M1-R4 | Account lockout after 5 consecutive failed login attempts. Auto-unlock after 15 minutes. Lockout events are logged in the immutable audit trail. |
| M1-R5 | Magic link tokens are single-use and expire after 15 minutes. |
| M1-R6 | Onboarding wizard progress is persisted per-org. Wizard can be resumed from the last incomplete step. Wizard state is not lost if the user logs out or closes the browser. |
| M1-R7 | MFA backup codes: 10 codes generated at enrollment, each single-use. If all codes are exhausted, user must contact platform support for account recovery. |
| M1-R8 | All auth events (login, registration, password reset, MFA enrollment) are recorded in an immutable audit trail. |
| M1-R9 | Org logo uploads are limited to SVG, JPEG, PNG, or WebP formats; profile photos are limited to JPEG, PNG, or WebP. Maximum file size is 5MB for photos and 2MB for SVG logos. SVG files are sanitized on upload to prevent XSS. |
| M1-R10 | CSV bulk import validates each row independently. A row-level error does not block valid rows from being imported. Invalid rows are listed with specific field-level error messages and can be downloaded as a corrected CSV. |
| M1-R11 | Imported members who already have an active platform account linked to the same org are counted separately in the import preview and are not re-imported or re-invited. |

## UX Specification

### Screen Inventory

| Route | Page Name | Description | Desktop | Mobile |
|-------|----------|-------------|---------|--------|
| /register | Registration | Account creation form with license validation | Yes | Yes (primary) |
| /login | Login | Email/password + magic link option | Yes | Yes (primary) |
| /forgot-password | Forgot Password | Email input to trigger OTP | Yes | Yes |
| /reset-password | Reset Password | OTP entry + new password form | Yes | Yes |
| /verify | OTP Verification | 6-digit code entry during registration | Yes | Yes (primary) |
| /onboarding/[step] | Onboarding Wizard | Multi-step org setup for officers | Yes (primary) | Yes (simplified) |
| /accept-invite/[token] | Claim Account | Pre-populated form for imported members | Yes | Yes (primary) |

### Screen Details

#### Registration (/register)
**Route:** /register or /register?org=[slug]
**Desktop layout:** Centered card (max-width 480px) on a minimal background. Platform logo at top. Form fields stacked vertically. "Already have an account? Log in" link below the form.
**Mobile layout:** Full-width card with generous touch targets (min 44px). Same field order. Keyboard-aware -- fields scroll into view when focused.
**Components:**
- Text input: Full name
- Text input: Email address (type=email)
- Text input: Professional license number (with format hint from association config, e.g., "7-digit number from your PRC card")
- Password input with show/hide toggle and strength indicator
- Checkbox: "I agree to the Privacy Policy and Terms of Service" (links open in new tab)
- Primary button: "Create Account"
- If org context: read-only org badge at top showing org name and logo
**States:**
- Loading: Button shows spinner, fields disabled
- Empty: Default form state
- Error: Inline field errors below each invalid field (red text, field border turns red). Duplicate email/license errors shown as a banner above the form.
- Success: Transition to /verify page with email confirmation message
**Interactions:**
- License number field shows the expected format as placeholder text, sourced from association config
- Password strength indicator updates in real-time (weak/medium/strong)
- Form submission disabled until all required fields are filled and privacy checkbox is checked

#### Login (/login)
**Route:** /login
**Desktop layout:** Centered card (max-width 400px). Platform logo. Email and password fields. "Forgot password?" link. "Magic link" alternative. "Don't have an account? Register" link.
**Mobile layout:** Full-width. Large touch targets. Biometric login prompt if available (future).
**Components:**
- Text input: Email address
- Password input with show/hide toggle
- Link: "Forgot password?"
- Primary button: "Log In"
- Divider: "or"
- Secondary button: "Send Magic Link" (uses the email already entered)
- Link: "Don't have an account? Register"
**States:**
- Loading: Button spinner
- Empty: Default
- Error: Banner at top: "Incorrect email or password." or "Account locked. Try again in [N] minutes."
- Success: Redirect to dashboard (or MFA prompt)
**Interactions:**
- If user enters email and clicks "Send Magic Link," the magic link is sent and a confirmation message replaces the form: "Check your email for a login link. It expires in 15 minutes."

#### OTP Verification (/verify)
**Route:** /verify
**Desktop layout:** Centered card. Large heading: "Enter verification code." Subtext: "We sent a 6-digit code to [email]." Six individual digit input boxes in a row.
**Mobile layout:** Full-width. Auto-focus on first digit. Auto-advance between digits. Supports paste from SMS/email.
**Components:**
- 6 individual digit inputs (auto-focus, auto-advance)
- Timer showing remaining time (e.g., "Code expires in 12:34")
- Link: "Didn't receive a code? Resend" (shows resend count: "2 of 3 resends remaining")
- Link: "Use a different email" (returns to registration)
**States:**
- Loading: Digits disabled, spinner below
- Empty: Cursor in first digit box
- Error: All boxes shake briefly, clear, re-focus on first. Error text: "Incorrect code. [N] attempts remaining."
- Expired: Timer shows "Code expired." Resend link is prominent.
- Success: Green check animation, auto-redirect to next step (dashboard or claim completion)
**Interactions:**
- Pasting a 6-digit code from clipboard auto-fills all boxes and submits
- Backspace moves focus to previous box
- Auto-submit when 6th digit is entered (no submit button needed)

#### Forgot Password (/forgot-password)
**Route:** /forgot-password
**Desktop layout:** Centered card. "Reset your password" heading. Email input. Submit button.
**Mobile layout:** Full-width. Same structure.
**Components:**
- Text input: Email address
- Primary button: "Send Reset Code"
- Link: "Back to login"
**States:**
- Loading: Button spinner
- Empty: Default
- Success: "If an account exists with this email, a verification code has been sent." Transitions to /reset-password with email pre-filled.
- Rate limited: "Too many requests. Try again in [N] minutes."
**Interactions:**
- Always shows success message regardless of whether the email exists (security)

#### Reset Password (/reset-password)
**Route:** /reset-password
**Desktop layout:** Centered card. OTP input (same 6-digit component as /verify). Below: new password and confirm password fields.
**Mobile layout:** Full-width. OTP section first, password fields appear after OTP is verified.
**Components:**
- 6-digit OTP input (same component as /verify)
- Password input with strength indicator
- Confirm password input
- Primary button: "Reset Password"
**States:**
- Loading: Spinner
- Empty: OTP section active, password fields dimmed
- OTP verified: OTP section collapses with green check. Password fields become active.
- Error: OTP errors same as /verify. Password mismatch: "Passwords do not match."
- Success: "Password reset successfully." Auto-redirect to dashboard (logged in).

#### Onboarding Wizard (/onboarding/[step])
**Route:** /onboarding/profile, /onboarding/members, /onboarding/dues, /onboarding/gateway, /onboarding/invite
**Desktop layout:** Full page with a left sidebar showing the step progress (vertical stepper with step names and completion indicators). Main content area (max-width 720px) shows the current step form. "Save & Continue" button at bottom right. "Skip this step" link where applicable. "Save & Exit" link to leave and resume later.
**Mobile layout:** Horizontal stepper at top (condensed -- shows step numbers with current highlighted). Full-width form below. Sticky footer with "Continue" button.
**Components:**
- Step 1 (Profile): Org name, logo upload (drag-and-drop + click), contact fields, meeting schedule textarea
- Step 2 (Members): CSV template download button, file upload zone (drag-and-drop), validation preview table (green/red rows), confirm import button, summary card post-import
- Step 3 (Dues): Membership category table (add/edit rows), dues rate per category, grace period slider (0-365 days), fund allocation table (name + percentage, must sum to 100%)
- Step 4 (Gateway): Provider selection (PayMongo/Stripe), API key inputs, "Test Connection" button with status indicator
- Step 5 (Invite): Email preview, recipient selector (all imported / specific), "Send Invitations" button with delivery count
**States:**
- Loading: Skeleton of current step
- Empty: Step form with defaults
- Error: Inline field errors. CSV import errors shown in a dismissible table.
- Success: Step marked complete in stepper (green check). "Continue to next step" animation.
- Resumed: Banner at top: "Welcome back! You left off at step [N]."
**Interactions:**
- Progress auto-saves on every field blur (no explicit "save draft" needed)
- Step 2 (Members): After import completes, a summary card animates in showing member count and a preview of the dashboard action cards
- Step 3 (Dues): Fund allocation percentages show a live "remaining" counter (e.g., "15% unallocated") that turns green at exactly 0%
- Step 4 (Gateway): "Test Connection" shows a real-time status: connecting... success/failure
- Any step can be revisited by clicking it in the stepper

#### Claim Account (/accept-invite/[token])
**Route:** /accept-invite/[token]
**Desktop layout:** Centered card. "Welcome to [Org Name]" heading with org logo. Pre-populated read-only fields (name, email, license number). Password field. OTP section.
**Mobile layout:** Full-width. Same structure with generous spacing.
**Components:**
- Read-only display: Name, email, license number (from import data)
- Password input with strength indicator
- 6-digit OTP input (sent after password is set and "Activate" is clicked)
- Primary button: "Activate My Account"
**States:**
- Loading: Skeleton
- Empty: Default with pre-populated read-only fields
- Token expired: Full-page message: "This invitation has expired." with "Request New Link" button and org contact info.
- Token already claimed: "This account is already active. Log in instead." with login link.
- Error: Password validation errors inline. OTP errors same as /verify.
- Success: "Welcome aboard!" message with redirect to dashboard.
**Interactions:**
- Clicking "Activate My Account" first validates the password, then sends the OTP, then shows the OTP input inline (no page change)

### Empty States

| Screen | Empty State | Message | Action |
|--------|------------|---------|--------|
| Onboarding Step 2 (Members) | No CSV uploaded yet | "Import your member list to get started. Download our CSV template to see the required format." | "Download Template" button + "Upload CSV" button |
| Onboarding Step 3 (Dues) | No categories defined | "Set up membership categories so members know their dues amount." | "Add First Category" button with a pre-filled example row (e.g., "Regular -- PHP 1,500/year") |
| Onboarding Step 4 (Gateway) | No gateway connected | "Connect a payment gateway to accept online dues payments. You can skip this step and record payments manually." | "Connect PayMongo" and "Connect Stripe" buttons + "Skip for now" link |
| Onboarding Step 5 (Invite) | No members to invite | "Import members first (Step 2) before sending welcome emails." | "Go to Step 2" link |

### Error States

| Scenario | UI Treatment |
|----------|-------------|
| Network error during registration | Toast notification: "Connection lost. Your data is saved. Try again when you are back online." Form data preserved. |
| OTP service unavailable | Banner: "We are having trouble sending verification codes. Please try again in a few minutes." Retry button visible. |
| CSV upload fails (file too large) | Inline error below upload zone: "File exceeds 10MB limit. Try splitting into smaller files." |
| CSV upload fails (wrong format) | Inline error: "Please upload a .csv file. Download our template for the correct format." |
| Gateway test transaction fails | Step 4 shows: "Connection test failed. Error: [gateway error message]. Double-check your API keys and try again." No blocking -- "Skip" remains available. |
| Session expired during wizard | On next page load: redirect to /login with message "Your session expired. Log in to continue where you left off." Wizard state preserved. |
| Claim token invalid/tampered | Full-page error: "This invitation link is not valid. It may have been modified. Contact your chapter for a new invitation." |

## Acceptance Criteria Patterns

**Given** a new member registers with a valid email and license number,
**When** the system sends a 6-digit OTP to their email,
**Then** the OTP must arrive within 30 seconds, expire after 15 minutes, and be usable exactly once.

**Given** an officer imports a CSV with 500 rows where 30 rows have errors,
**When** the validation preview is displayed,
**Then** 470 valid rows are shown as importable, 30 invalid rows are listed with specific field-level error messages, and already-linked members are counted separately.

**Given** an officer completes Step 2 (member import) of the onboarding wizard and closes the browser,
**When** the officer logs back in and navigates to /onboarding,
**Then** the wizard resumes at Step 3 with Steps 1 and 2 marked as complete and all previously saved data intact.

**Given** an imported member clicks a claim link that is older than 7 days,
**When** the /accept-invite page loads,
**Then** the page shows "This invitation has expired" with a "Request New Link" button that notifies the org secretary.

**Given** a user enters incorrect login credentials 5 times consecutively,
**When** they attempt a 6th login,
**Then** the account is locked for 15 minutes, the user sees a lockout message with a password reset option, and the lockout event is recorded in the audit trail.

**Given** an officer is halfway through the onboarding wizard and the member import step is complete,
**When** the officer navigates to the dashboard,
**Then** the dashboard shows the imported member count, collection rate (0%), and smart action cards with "Send dues reminder" and "Resume setup" options.

## Data Entities

| Entity | Description | Key Fields | Relationships |
|--------|-------------|------------|---------------|
| Member | A platform user (healthcare professional or admin) | id, email, password_hash, full_name, license_number, phone, photo_url, mfa_enabled, mfa_secret, email_verified_at, created_at, updated_at | Has many MemberOrganizations, has many Sessions, has many AuditLogs |
| Session | Active login session | id, member_id, token_hash, device_info, ip_address, created_at, expires_at, revoked_at | Belongs to Member |
| InvitationToken | Claim/invite token for imported members | id, member_id, org_id, token_hash, type (claim/invite), expires_at, claimed_at, created_by | Belongs to Member, belongs to Organization |
| OTPCode | Verification code for email/password flows | id, member_id, code_hash, purpose (registration/reset/claim), attempts, expires_at, verified_at | Belongs to Member |
| OnboardingState | Wizard progress per org | id, org_id, current_step, steps_completed (jsonb), started_at, completed_at | Belongs to Organization |
| AuditLog | Immutable action log | id, actor_id, actor_role, action_type, entity_type, entity_id, before_state, after_state, ip_address, created_at | References Member (actor) |
