# Module Specification: Auth & Onboarding (M01)

---
oli_version: "Phase B -- Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Provide secure access to the platform for all user types and guide new users through first-time setup so they reach value as fast as possible. Foundation module -- no dependencies.

### Users
- Member (healthcare professional)
- Officer (President, Secretary, Treasurer)
- Platform Administrator

### Related Modules
- M02 Member Profile (profile completion post-auth)
- M03 Platform Admin (admin authentication)
- M05 Membership (application submitted during registration)
- M13 Professional Feed (post-auth access)
- M15 Job Board (post-auth access)
- M17 Marketplace (post-auth access)

### In Scope
- Self-registration with license validation
- Email + password login, magic link login
- Password reset via OTP
- Account claim flow (bulk-imported members)
- Smart onboarding wizard (org-type-aware)
- Member onboarding wizard (optional, post-dashboard)
- MFA (TOTP-based, passkey)
- Invite system (officer-to-member)
- Session management (concurrent sessions, 24h token expiry)
- Bulk CSV import with member matching

### Out of Scope
- Profile editing (M02)
- Membership status computation (M05)
- Dues configuration in wizard (configured here, stored in M06)
- Platform admin provisioning (M03)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Member | A healthcare professional using the platform. One account, one login. Can belong to multiple organizations. |
| Officer | A member assigned an administrative role within an organization: President, Treasurer, or Secretary. |
| Platform Administrator | A Memberry employee or super-admin who manages the platform itself. |
| Organization | Operational unit within an association (e.g., chapter, society). Has org_type: chapter, society, national, clinic. |
| Association | Top-level tenant organization. Has its own locale, currency, credit cycle config. |
| OTP | One-time password, 6-digit code sent via email for verification. |
| License Number | Professional regulatory license identifier (e.g., PRC license). |
| Session | Active login session with device info and expiry. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Self-Registration | WF-001 | Member | Register with name, email, license, password + OTP | P0 |
| Account Claim | WF-002 | Imported Member | Claim pre-populated account via token link + OTP | P0 |
| Login | WF-003 | All users | Email/password or magic link authentication | P0 |
| Password Reset | WF-004 | All users | OTP-based password reset flow | P0 |
| Smart Onboarding | WF-005 | Officer | Org-type-aware setup wizard (profile, import, dues, gateway, invite) | P0 |
| Member Onboarding | WF-006 | Member | Optional profile completion wizard post-dashboard | P0 |
| MFA Enrollment | WF-007 | All users | TOTP setup via authenticator app | P0 |
| Invite Member | WF-008 | Officer | Send individual email invitation to prospective member | P0 |
| Bulk CSV Import | WF-009 | Officer | Upload, validate, preview, import members (cross-module with M05) | P0 |

## 4. Workflow Details

### Workflow: Self-Registration (WF-001)

Actor: Prospective member
Preconditions: None (public access)
Steps:
1. User lands on /register (org may be pre-selected from public page).
2. Enters full name, email, license number, password.
3. System validates email format, password strength (min 8 chars, 1 uppercase, 1 number), license format against association regex.
4. System sends 6-digit OTP to email. User stays on /verify page.
5. User enters OTP within 15 minutes.
6. Account created. If org-linked, membership application submitted to that org.
7. Dashboard visible. Optional member onboarding wizard prompt appears.

Alternate Flows:
- No org context: user prompted to search for association/chapter or request invite.

Exception Flows:
- Duplicate email: "An account with this email already exists. Log in instead?"
- Duplicate license number: "This license number is already registered."
- Invalid license format: inline error with expected format.
- OTP expired: resend button (max 3 resends).
- OTP incorrect: max 5 attempts before invalidation.

Postconditions:
- Member has active account.
- If org-linked, application is pending officer approval.

### Workflow: Account Claim (WF-002)

Actor: Imported member
Preconditions: Member bulk-imported by officer; claim email received
Steps:
1. Member clicks claim link (/accept-invite/[token]).
2. Page shows pre-populated data: name, license number, email (read-only).
3. Member enters new password.
4. System sends 6-digit OTP. Member enters OTP.
5. Account activated. Member linked to org with imported category.
6. Dashboard visible with dues status and activities.

Exception Flows:
- Token expired (>7 days): "Invitation expired. Contact chapter secretary."
- Token already claimed: "Account already active. Log in."
- Email mismatch (tampered): "Invalid invitation."

Postconditions:
- Imported member has working account with all imported data preserved.

### Workflow: Login (WF-003)

Actor: Any registered user
Preconditions: Account exists
Steps:
1. User enters email and password on /auth/sign-in.
2. System validates credentials.
3. If MFA enabled, prompts for TOTP code.
4. Session created. Redirect to dashboard.
5. Multi-org members see combined dashboard view.

Exception Flows:
- Invalid credentials: "Incorrect email or password."
- Account locked (5 failures): locked 15 minutes, audit logged.
- MFA code incorrect: retry allowed.
- Account pending verification: prompt to verify email.

Postconditions:
- User authenticated with active session.

### Workflow: Smart Onboarding Wizard (WF-005)

Actor: Officer (first login after org provisioning)
Preconditions: Org provisioned, officer authenticated
Steps:
1. Wizard overlay with progress stepper.
2. Step 1 -- Org Profile: name, logo, contact, meeting schedule.
3. Step 2 -- Import Members: CSV template download, upload, validate, preview, confirm. Claim emails queued.
4. Step 3 -- Configure Dues: categories, rates, grace period, fund allocation (must total 100%).
5. Step 4 -- Connect Payment Gateway: PayMongo/Stripe API keys, test transaction.
6. Step 5 -- Send Welcome Emails: preview, select recipients, send.
7. Wizard complete. Dashboard with smart action cards.

Alternate Flows:
- Society: "Create first training, set credit values, invite members."
- National body: "Configure CPD requirements, set credit cycle, connect chapters."
- Save-and-resume at every step.

Exception Flows:
- CSV import errors: invalid rows shown with field errors.
- Gateway test fails: officer can skip, configure later.

Postconditions:
- Org fully configured. Members imported. Claim emails sent.

### Workflow: Forgot Password (WF-004)

Actor: Any user (unauthenticated)
Preconditions: Registered email exists
Steps:
1. Enter email on forgot password page.
2. System sends OTP to registered email.
3. User enters OTP.
4. User sets new password (min 8 chars).
5. Redirect to login.

Alternate Flows:
- Magic link option instead of OTP.

Exception Flows:
- Email not found → generic "If an account exists, a reset email has been sent" (prevents enumeration).
- OTP expired → "Code expired. Request a new one."

Postconditions:
- Password updated, all existing sessions invalidated.

### Workflow: Magic Link Login (WF-006)

Actor: Existing member
Preconditions: Account exists, email verified
Steps:
1. Enter email on login page.
2. Select "Send magic link."
3. System emails link (valid 15 minutes).
4. Click link → auto-authenticated.

Exception Flows:
- Link expired → "Link expired. Request a new one."
- Link already used → "Link already used. Request a new one." (single-use tokens)

Postconditions:
- Session created, redirected to dashboard.

### Workflow: Account Claim — Imported Member (WF-007)

Actor: Member imported via CSV who hasn't registered
Preconditions: Invitation token exists, not yet claimed
Steps:
1. Receive invitation email with claim link.
2. Click link.
3. Verify identity (license number + email must match import data).
4. Set password + optional MFA enrollment.
5. Profile pre-populated from import data.

Exception Flows:
- Token expired → "Invitation expired. Contact your chapter secretary."
- Already claimed → "Account already activated. Log in instead."

Postconditions:
- Account active, InvitationClaimed event emitted to M05.

### Workflow: Invite Member (WF-008)

Actor: Officer (President, Secretary)
Preconditions: Officer authenticated with 2FA, org exists
Steps:
1. Open member invite form.
2. Enter email, firstName, lastName, licenseNumber (optional).
3. System creates Person record + invitation token.
4. Invitation email sent with claim link.

Exception Flows:
- Email already registered → "Member already exists. Cannot re-invite."
- Invalid email format → validation error.

Postconditions:
- Invitation token created, email queued via M07.

### Workflow: Bulk CSV Import (WF-009)

Actor: Officer (President, Secretary)
Preconditions: Officer authenticated with 2FA, org exists
Steps:
1. Upload CSV file.
2. System validates format (required: firstName, lastName, email; optional: licenseNumber, specialization).
3. Preview: matched (existing members) vs new records shown.
4. Officer confirms import.
5. System creates Person records, generates invitation tokens, queues emails.

Exception Flows:
- Duplicate emails in CSV → skip duplicates with warning count.
- Invalid rows → reject with line numbers and error messages.
- File too large → "Maximum 500 members per import."

Postconditions:
- New members created with PENDING status, invitation emails queued, import log downloadable.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M1-R1 | IF OTP entered THEN validate: 6 digits, expires 15 min, max 3 resends, max 5 incorrect attempts | Registration, Claim, Reset | Invalidate OTP after 5 wrong attempts; require new OTP |
| M1-R2 | IF claim token age > 7 days THEN token is expired | Account Claim | Show expiry message; allow officer to regenerate |
| M1-R3 | IF password does not meet requirements THEN reject | All password flows | Min 8 chars, 1 uppercase, 1 number; checked against 10,000 common passwords |
| M1-R4 | IF login failures >= 5 consecutive THEN lock account 15 minutes | Login | Lockout event logged in audit trail |
| M1-R5 | IF magic link used once OR age > 15 min THEN invalidate | Magic Link Login | Single-use, time-limited |
| M1-R6 | IF officer leaves wizard THEN persist progress per-org | Onboarding Wizard | Resume from last incomplete step on return |
| M1-R7 | IF all MFA backup codes exhausted THEN require platform support | MFA | 10 single-use codes generated at enrollment |
| M1-R8 | IF auth event occurs THEN log to immutable audit trail | All auth flows | Login, registration, password reset, MFA enrollment |
| M1-R9 | IF file uploaded as logo THEN validate format and size | Org Profile (wizard) | SVG/JPEG/PNG/WebP; max 5MB photo, 2MB SVG; sanitize SVG |
| M1-R10 | IF CSV row invalid THEN skip row, do not block valid rows | Bulk Import | Independent row validation; invalid rows downloadable |
| M1-R11 | IF imported member already linked to org THEN do not re-import | Bulk Import | Counted separately in preview |
| BR-22 | IF importing member THEN match by email (exact, case-insensitive) OR license number (normalized). IF email matches Person A but license matches Person B THEN flag for human resolution | Bulk Import | Auto-link existing accounts; conflict flagged |
| BR-23 | IF license number entered THEN validate format per association regex (strip spaces, dashes, leading zeros; case-insensitive) | Registration, Import | Format enforcement per association |
| BR-24 | IF invitation token age > expiry window THEN reject and surface "expired" message; officer may regenerate | Invite Member (WF-008) | Default expiry 7 days; coverage: `handlers/invite/invite.test.ts`, `tests/contract/auth-verification.hurl`, `tests/e2e/auth.spec.ts` |
| BR-25 | IF OTP generated THEN 6-digit, 10-minute expiry pattern | Registration, Claim | Standard OTP pattern |
| BR-26 | IF session created THEN concurrent sessions allowed, 24-hour token expiry | Session Management | Device-linked sessions |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Self-register | user (unauthenticated) | -- | Public access |
| Login | All authenticated | -- | GA (global auth) |
| Send invite | president, secretary, officer | member, user | GA+HG |
| Import roster | president (2FA), secretary (2FA), super, admin | All others | GA+HG |
| Manage onboarding wizard | Officers with org access | member | Org-scoped |

## 7. Data Requirements

### Entity: Person

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID primary key | Auto-generated |
| firstName | Yes | First name | varchar(50) NOT NULL |
| lastName | No | Last name | varchar(50) |
| email | Yes | Email address | Unique globally, verified via OTP |
| passwordHash | Yes | Hashed password | Min 8 chars, 1 upper, 1 number |
| licenseNumber | Yes | Professional license | Validated against association regex per BR-23 |
| mfaEnabled | No | MFA toggle | Boolean, default false |
| emailVerifiedAt | No | Verification timestamp | Set on OTP verification |

### Entity: Session

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID | Auto-generated |
| personId | Yes | Person FK | References person |
| tokenHash | Yes | Session token hash | -- |
| deviceInfo | No | Device/browser | -- |
| expiresAt | Yes | Session expiry | 24h from creation per BR-26 |
| revokedAt | No | Revocation time | Set on explicit revoke |

### Entity: InvitationToken

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID | Auto-generated |
| organizationId | Yes | Org FK | References organization |
| tokenHash | Yes | Unique token hash | Unique constraint |
| type | Yes | claim or invite | Enum: claim, invite |
| expiresAt | Yes | 7 days from creation | Per M1-R2 |
| claimedAt | No | Claim timestamp | Set on claim |

### Entity: OnboardingState

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID | Auto-generated |
| organizationId | Yes | Org FK | One per org |
| currentStep | Yes | Current wizard step | Integer 1-5 |
| stepsCompleted | Yes | Completed steps | JSONB array |
| completedAt | No | Wizard completion time | -- |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Person | Session, NotificationPreference, PrivacySetting | Address, ContactInfo | One Person per email globally. PII centralized. |
| InvitationToken | -- | -- | Token unique. Single-use. 7-day expiry. |
| OnboardingState | -- | -- | One per org. Steps sequential. |

Rules:
- External modules reference Person by ID only.
- All writes go through the aggregate root.

## 8. State Transitions

### Session Lifecycle
```txt
Created --> Active --> Expired (24h inactivity per BR-26)
Created --> Active --> Revoked (user/admin action)
```

### Invitation Token Lifecycle
```txt
Pending --> Claimed
Pending --> Expired (7 days)
Pending --> Revoked (officer action)
```

### Onboarding Wizard
```txt
Started --> InProgress --> Completed
Started --> InProgress --> Resumed (save and return)
```

Rules:
- Sessions can be revoked individually or all-at-once.
- Expired tokens can be regenerated by any org officer.

## 9. UI/UX Requirements

### Screen: Registration (/register)
Purpose: Account creation
Users: Prospective member
Components: Full name input, email input (type=email), license number input (format hint from association), password input with show/hide toggle and strength indicator, privacy policy checkbox, "Create Account" button
States:
- Loading: button spinner, fields disabled
- Empty: default form
- ValidationError: inline field errors, red borders
- Success: transition to /verify
- UnexpectedError: "Something went wrong. Please try again." toast
- PermissionError: N/A (public)

### Screen: OTP Verification (/verify)
Purpose: Email verification
Users: All during registration/claim/reset
Components: 6 individual digit inputs (auto-focus, auto-advance), countdown timer, resend link (shows remaining resends)
States:
- Empty: cursor in first box
- ValidationError: boxes shake, re-focus, show attempts remaining
- Expired: "Code expired" with resend link
- Success: green check, auto-redirect
- UnexpectedError: retry prompt

### Screen: Login (/auth/sign-in)
Purpose: Authentication
Users: All users
Components: Email input, password input, "Sign In" button, magic link option, forgot password link
States:
- Empty: default form
- Loading: spinner
- ValidationError: "Incorrect email or password"
- Locked: "Account temporarily locked. Try again in 15 minutes."
- MFARequired: TOTP code input
- UnexpectedError: retry prompt

### Screen: Onboarding Wizard (/onboarding/[step])
Purpose: Org setup for officers
Users: Officers
Components: 5-step progress stepper (sidebar desktop, horizontal mobile), step-specific forms (profile, import, dues, gateway, invite), Save & Continue / Skip / Save & Exit buttons
States:
- Loading: skeleton
- Resumed: "Welcome back! You left off at step [N]."
- ValidationError: inline errors per step
- Success: step marked complete with green check
- UnexpectedError: data preserved, retry prompt

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /register | Create account | name, email, license, password | personId, sessionToken | 409 duplicate email/license |
| POST /verify-otp | Verify OTP code | email, code | verified: true | 400 invalid/expired code |
| POST /auth/sign-in | Authenticate | email, password | sessionToken | 401 invalid creds, 423 locked |
| POST /magic-link | Send magic link | email | sent: true | 429 rate limited |
| POST /accept-invite | Claim account | token, password, otpCode | personId, sessionToken | 410 expired token |
| POST /forgot-password | Initiate reset | email | sent: true (always) | 429 rate limited |
| POST /reset-password | Complete reset | email, otpCode, newPassword | sessionToken | 400 invalid OTP |
| GET /onboarding/state | Get wizard progress | orgId | currentStep, stepsCompleted | 404 no state |
| PUT /onboarding/step | Save wizard step | orgId, step, data | saved: true | 400 validation |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| PersonCreated | Registration or claim completed | personId, email, firstName, lastName, licenseNumber | M02, M05 |
| SessionCreated | Login success | personId, deviceInfo, sessionId | Audit |
| InvitationClaimed | Imported member claims account | tokenId, personId, orgId | M05 |
| OnboardingCompleted | Officer finishes wizard | orgId, officerId | M04, M05, M06 |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipApproved | M05 | Grant org access | Dashboard updated with org content |
| OrganizationCreated | M03 | Initialize onboarding state | Wizard ready for first officer login |

## 11. Acceptance Criteria

### AC-M01-001: OTP Delivery
Given a new member registers with a valid email and license number,
When the system sends a 6-digit OTP,
Then the OTP must arrive within 30 seconds, expire after 15 minutes, and be usable exactly once.

### AC-M01-002: CSV Import Preview
Given an officer imports a CSV with 500 rows where 30 rows have errors,
When the validation preview is displayed,
Then 470 valid rows shown as importable, 30 invalid rows listed with field-level errors, already-linked members counted separately.

### AC-M01-003: Wizard Resume
Given an officer completes Step 2 of the onboarding wizard and closes the browser,
When the officer logs back in,
Then the wizard resumes at Step 3 with Steps 1-2 marked complete and all data intact.

### AC-M01-004: Claim Token Expiry
Given an imported member clicks a claim link older than 7 days,
When the page loads,
Then the page shows "This invitation has expired" with a "Request New Link" button.

### AC-M01-005: Account Lockout
Given 5 consecutive failed login attempts,
When the 6th attempt is made,
Then the account is locked for 15 minutes and the lockout event is audit-logged.

### AC-M01-006: Member Matching on Import
Given a CSV row has an email matching Person A but a license matching Person B,
When import validation runs,
Then the row is flagged for human resolution and no auto-linking occurs (per BR-22).

### AC-M01-007: Login Route
Given a user navigates to /auth/sign-in,
When the page loads,
Then the login form is displayed (not /login).

## 12. Test Expectations

Required tests:
- OTP generation, validation, expiry, and resend limits
- Account lockout after 5 failures and auto-unlock after 15 minutes
- Claim token lifecycle: create, claim, expire, regenerate
- Onboarding wizard state persistence across sessions
- CSV import: valid rows, invalid rows, duplicates, cross-org matching (BR-22)
- Magic link single-use and expiry
- MFA enrollment, verification, and backup code usage
- SVG sanitization removes script elements
- Password strength validation against common password list
- License number normalization and format validation (BR-23)
- Concurrent session handling (BR-26)

## 13. Edge Cases

- Member registers with email matching an imported-but-unclaimed record: link accounts.
- Claim token used after account already claimed: show "already active" message.
- Officer leaves wizard at Step 2, members partially imported: imported members persist, wizard resumes at Step 3.
- Two officers import overlapping CSVs simultaneously: cross-org matching handles duplicates (BR-22).
- OTP service unavailable: show retry message, form data preserved.
- Session expired during wizard: redirect to login, wizard state preserved.
- License regex not configured for association: registration blocked with admin notification.
- CSV row email matches Person A, license matches Person B: flagged for human resolution, no auto-link (BR-22).
- Name mismatch on single-field match (e.g., "Maria Cruz" vs "Jose Santos"): flagged for manual review (BR-22).

## 14. Dependencies

### Internal Dependencies
- M02 Member Profile: profile data created here, managed there
- M03 Platform Admin: org provisioning triggers wizard availability
- M05 Membership: application submitted during registration if org-linked

### External Dependencies
- Email service (OTP delivery, claim emails, magic links)
- Better-Auth (session management, authentication, email OTP, passkey, TOTP)
- TOTP authenticator apps (MFA)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate email | Block registration | "An account with this email already exists. Log in instead?" |
| Duplicate license | Block registration | "This license number is already registered." |
| OTP expired | Invalidate code | "Code expired. Request a new one." |
| Account locked | Block login 15 min | "Account temporarily locked. Try again in 15 minutes." |
| Gateway test fails | Allow skip | "Connection failed. Check API keys." |
| CSV wrong format | Block upload | "Please upload a .csv file." |
| Network error during registration | Preserve form data | "Connection lost. Your data is saved. Try again." |
| Invalid license format | Block registration | "License must match format [pattern]." |

## 16. Performance Expectations

- Expected data volume: Up to 500 members per CSV import
- Expected concurrent users: 500+ during convention registration
- Acceptable response times: OTP delivery < 30 seconds; API p95 < 500ms
- Caching requirements: Onboarding state cached per-org; session validation cached

## 17. Observability Hooks

Structured log events:

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| auth.registration | INFO | Account created | personId, method, timestamp | No |
| auth.login | INFO | Login success | personId, deviceInfo, method | No |
| auth.login.failed | WARN | Login failure | email_hash, attempts, ip | No |
| auth.lockout | WARN | Account locked | personId, ip, attempts | No |
| auth.otp.sent | INFO | OTP dispatched | personId, purpose | No |
| auth.claim | INFO | Invitation claimed | tokenId, personId, orgId | No |
| onboarding.step.completed | INFO | Wizard step done | orgId, step, officerId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| auth_registrations_total | counter | method | Registration count |
| auth_login_duration_seconds | histogram | method, status | Login response time |
| auth_lockouts_total | counter | -- | Account lockout count |
| onboarding_completion_rate | gauge | org_type | Wizard completion % |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| auth_magic_link_enabled | release | true | Gates magic link login | -- |
| auth_mfa_mandatory_officers | ops | false | Force MFA for all officers | -- |
| onboarding_wizard_v2 | release | false | New wizard flow | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M01-S1 | Email + Password Registration | Registration form + OTP verification | None | P0 |
| M01-S2 | Login + Session Management | Login, session create/revoke | M01-S1 | P0 |
| M01-S3 | Password Reset | OTP-based password reset flow | M01-S1 | P0 |
| M01-S4 | Account Claim | Imported member claim flow | M01-S1 | P0 |
| M01-S5 | Magic Link Login | Passwordless login | M01-S2 | P0 |
| M01-S6 | Onboarding Wizard | 5-step org setup wizard | M01-S2 | P0 |
| M01-S7 | MFA Enrollment | TOTP setup and verification | M01-S2 | P0 |
| M01-S8 | Invite System | Officer invitations with tracking | M01-S2, M01-S4 | P0 |

## 20. AI Instructions

When implementing this module:
1. **Better-Auth integration**: Auth is handled by Better-Auth (not a separate module). Use its email OTP, passkey, TOTP, admin, bearer, and magic link plugins. See `services/api-ts/src/core/auth.ts` for config.
2. **Auth route**: Login route is `/auth/sign-in`, NOT `/login`. Respect this convention.
3. **No /api prefix**: Backend routes are registered without `/api` prefix (Vite proxy strips it).
4. **Vertical slices**: Do not implement the entire module at once. Convert workflows into vertical slice specs. Implement one slice at a time.
5. **Spec-first**: Define TypeSpec first, generate OpenAPI + types, then implement handlers.
6. **Handler pattern**: Router -> Validators -> Handlers -> Repositories. See `services/api-ts/src/handlers/person/` for reference.
7. **Session management**: Better-Auth manages sessions natively. Concurrent sessions allowed per BR-26.
8. Keep terminology consistent with the Domain Glossary.
9. Use acceptance criteria as test basis.
10. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | Aligned with DOMAIN_GLOSSARY.md |
| 3. Workflows | COMPLETE | Aligned with WORKFLOW_MAP.md WF-001 through WF-009 |
| 4. Workflow Details | COMPLETE | All workflows WF-001 through WF-009 fully detailed |
| 5. Business Rules | COMPLETE | 15 rules including cross-refs to BR-22, BR-23, BR-25, BR-26 |
| 6. Permissions | COMPLETE | Aligned with ROLE_PERMISSION_MATRIX.md |
| 7. Data Requirements | COMPLETE | -- |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL.md |
| 8. State Transitions | COMPLETE | -- |
| 9. UI/UX Requirements | COMPLETE | Added error/permission states per template |
| 10. API Expectations | COMPLETE | -- |
| 10b. Domain Events | COMPLETE | From DOMAIN_MODEL.md |
| 11. Acceptance Criteria | COMPLETE | 7 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | -- |
| 13. Edge Cases | COMPLETE | -- |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | -- |
| 16. Performance Expectations | COMPLETE | -- |
| 17. Observability Hooks | COMPLETE | -- |
| 18. Feature Flags | COMPLETE | -- |
| 19. Vertical Slice Plan | COMPLETE | -- |
| 20. AI Instructions | COMPLETE | Enhanced with Better-Auth specifics |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M02**: Depends on PersonCreated event. If Person entity schema changes, M02 data requirements must update.
- **M03**: Consumes admin authentication from this module. MFA mandatory rule (M3-R7) relies on M01 MFA implementation.
- **M05**: Depends on InvitationClaimed and PersonCreated events. Membership application flow triggered during registration.
- **M04**: Depends on OnboardingCompleted event. Wizard completion triggers org management handoff.
- **Audit**: All auth events logged. Changes to session lifecycle affect audit trail completeness.
