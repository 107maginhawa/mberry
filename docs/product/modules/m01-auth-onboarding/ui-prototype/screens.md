<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint — Screens: Auth & Onboarding (M01)

---

## S01: Registration (`/register`)

**Purpose:** Self-registration for new users (WF-001).
**Primary Users:** Unauthenticated users (public).
**Related Workflow:** WF-001 (Self-Registration).
**App:** account (port 3002).

### ARIA Landmark Structure

```
<header role="banner">
  <img alt="Memberry logo" />
</header>
<main role="main" aria-label="Registration form">
  <form aria-label="Create account">
    <input aria-label="First name" aria-required="true" />
    <input aria-label="Email address" aria-required="true" />
    <input aria-label="Password" aria-required="true" aria-describedby="password-hint" />
    <input aria-label="Professional license number" aria-required="true" />
    <button type="submit">Create Account</button>
    <a href="/auth/sign-in">Already have an account? Sign in</a>
  </form>
</main>
<footer role="contentinfo">
  <p>Terms of Service | Privacy Policy</p>
</footer>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | firstName input |
| Validation error | First invalid field |
| Submit success | OTP verification screen auto-navigated |
| Unexpected error | Error alert region |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| firstName | Yes | `POST /register` → body.firstName | varchar(50), NOT NULL |
| lastName | No | `POST /register` → body.lastName | varchar(50) |
| email | Yes | `POST /register` → body.email | Unique globally, max 255 |
| password | Yes | `POST /register` → body.password | Min 8, 1 upper, 1 number (M1-R3) |
| licenseNumber | Yes | `POST /register` → body.licenseNumber | Validated against association regex (BR-23) |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Submit registration | POST /register | Public | Enter |
| Navigate to login | Link to /auth/sign-in | Public | Tab + Enter |
| Show/hide password | Toggle password visibility | Public | — |

### Role-Variant Matrix

| Element | Unauthenticated | Authenticated |
|---------|-----------------|---------------|
| Registration form | Visible | Hidden (redirect to /my/profile) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Centered card (max-w-md), logo top |
| Tablet (768-1024px) | Centered card (max-w-sm), same layout |
| Mobile (<768px) | Full-width card with px-4 padding |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on submit button, inputs disabled |
| Empty | Default form, all fields blank |
| Success | Navigate to /verify with email pre-filled |
| Validation Error | Inline per-field errors (red text below field), first error focused |
| Permission Error | N/A (public route) |
| Unexpected Error | Banner: "Registration failed. Please try again." with retry |
| Conflict/Duplicate | "An account with this email already exists. Sign in instead?" with link |
| Confirmation/Warning | N/A |
| Offline/Sync | Banner: "You appear to be offline. Please check your connection." Form disabled. |

### Validation Behavior

- Email: format + max 255. Validated client-side and server-side.
- Password: min 8, 1 uppercase, 1 number. Strength meter optional. Validated real-time on blur.
- License number: regex pattern per association (BR-23). Hint text shows expected format.
- All required fields: show "(required)" in label or asterisk with screen-reader text.

### Edge Cases

- User navigates back after OTP screen: pre-fill form from sessionStorage.
- Duplicate email: 409 from server, display conflict state.
- Invalid license format: show association-specific hint (e.g., "Expected format: PRC-12345").

---

## S02: OTP Verification (`/verify`)

**Purpose:** Verify email ownership via 6-digit code (WF-001, WF-002, WF-004).
**Primary Users:** Unauthenticated users (post-registration or claim).
**Related Workflow:** WF-001, WF-002.
**App:** account (port 3002).

### ARIA Landmark Structure

```
<header role="banner">
  <img alt="Memberry logo" />
</header>
<main role="main" aria-label="OTP verification">
  <h1>Check your email</h1>
  <p aria-live="polite">We sent a 6-digit code to {email}</p>
  <form aria-label="Enter verification code">
    <div role="group" aria-label="Verification code">
      <input aria-label="Digit 1" maxlength="1" inputmode="numeric" />
      <!-- ... 6 individual digit inputs -->
    </div>
    <button type="submit">Verify</button>
    <button type="button">Resend code</button>
  </form>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | First digit input |
| Digit entered | Next digit input (auto-advance) |
| Backspace on empty | Previous digit input |
| Paste 6 digits | Last digit input, auto-submit |
| Verification success | Auto-navigate |
| Error | Error message, then first digit input |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| email | Display only | From navigation state | Passed from registration |
| code | Yes | `POST /verify-otp` → body.code | Exactly 6 digits |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Submit OTP | POST /verify-otp | Public | Enter |
| Resend code | Re-trigger OTP send | Public | Tab + Enter |
| Back to registration | Navigate back | Public | — |

### Role-Variant Matrix

| Element | Unauthenticated | Authenticated |
|---------|-----------------|---------------|
| OTP form | Visible | Hidden (redirect) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Centered card, 6 digit inputs in row |
| Tablet (768-1024px) | Same as desktop |
| Mobile (<768px) | Full-width, digit inputs slightly smaller (w-10 each) |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on verify button, inputs disabled |
| Empty | 6 empty digit boxes, email displayed above |
| Success | Session token received, navigate to dashboard or onboarding |
| Validation Error | "Invalid code. Please try again." (M1-R1: max 5 attempts, 15 min TTL) |
| Permission Error | N/A (public route) |
| Unexpected Error | "Verification failed. Please try again." with retry |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | After 3 failed attempts: "2 attempts remaining before lockout." |
| Offline/Sync | "You appear to be offline." Submit disabled. |

### Validation Behavior

- Code: exactly 6 numeric digits. Non-numeric input ignored.
- Max 5 attempts per OTP (M1-R1). Counter displayed after 3rd failure.
- OTP expires after 15 minutes (M1-R1). Timer countdown shown.

### Edge Cases

- Expired OTP: "Code expired. Request a new one." with resend button.
- Max attempts reached: "Too many attempts. Request a new code."
- Browser autofill of SMS code: should auto-populate and submit.

---

## S03: Login (`/auth/sign-in`)

**Purpose:** Authenticate existing users (WF-003).
**Primary Users:** All registered users.
**Related Workflow:** WF-003 (Login).
**App:** account (port 3002).

### ARIA Landmark Structure

```
<header role="banner">
  <img alt="Memberry logo" />
</header>
<main role="main" aria-label="Sign in">
  <form aria-label="Sign in form">
    <input aria-label="Email address" aria-required="true" type="email" />
    <input aria-label="Password" aria-required="true" type="password" />
    <button type="submit">Sign In</button>
    <button type="button">Send Magic Link</button>
    <a href="/forgot-password">Forgot password?</a>
    <a href="/register">Create an account</a>
  </form>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Email input |
| Validation error | First invalid field |
| MFA required | TOTP code input |
| Login success | Dashboard auto-navigated |
| Account locked | Lock message alert |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| email | Yes | `POST /auth/sign-in` → body.email | max 255 |
| password | Yes | `POST /auth/sign-in` → body.password | — |
| totpCode | Conditional | `POST /auth/sign-in` → body.totpCode | Only if MFA enabled |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Sign in | POST /auth/sign-in | Public | Enter |
| Send magic link | POST /magic-link | Public | — |
| Forgot password | Navigate to /forgot-password | Public | — |
| Create account | Navigate to /register | Public | — |

### Role-Variant Matrix

| Element | Unauthenticated | Authenticated |
|---------|-----------------|---------------|
| Login form | Visible | Hidden (redirect to dashboard) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Centered card (max-w-md) |
| Tablet (768-1024px) | Centered card (max-w-sm) |
| Mobile (<768px) | Full-width with px-4 padding |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on submit, inputs disabled |
| Empty | Default form with email/password fields |
| Success | Session created, redirect to returnUrl or /my/profile |
| Validation Error | "Incorrect email or password." (no enumeration) |
| Permission Error | N/A (public route) |
| Unexpected Error | "Sign in failed. Please try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | Locked account: "Account temporarily locked. Try again in 15 minutes." |
| Offline/Sync | "You appear to be offline." Submit disabled. |

### MFA Flow (Conditional)

When server returns MFA required:
1. Password fields hidden.
2. TOTP 6-digit code input shown.
3. "Enter the code from your authenticator app" instructional text.
4. Submit verifies TOTP.

### Edge Cases

- Remember me: Not implemented per spec (session-based auth, 24h TTL per BR-26).
- Magic link: Always returns success (no email enumeration per M1-R5).
- Redirect after login: Honor `returnUrl` query param if present and same-origin.

---

## S04: Forgot Password (`/forgot-password`)

**Purpose:** Initiate password reset flow (WF-004).
**Primary Users:** Unauthenticated users.
**Related Workflow:** WF-004.
**App:** account (port 3002).

### ARIA Landmark Structure

```
<main role="main" aria-label="Forgot password">
  <form aria-label="Request password reset">
    <input aria-label="Email address" aria-required="true" type="email" />
    <button type="submit">Send Reset Link</button>
    <a href="/auth/sign-in">Back to sign in</a>
  </form>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Email input |
| Submit success | Confirmation message |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| email | Yes | `POST /forgot-password` → body.email | max 255 |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Send reset link | POST /forgot-password | Public | Enter |
| Back to sign in | Navigate to /auth/sign-in | Public | — |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Centered card (max-w-sm) |
| Tablet (768-1024px) | Same |
| Mobile (<768px) | Full-width with px-4 |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on button |
| Empty | Email field blank |
| Success | "If an account exists, we sent a reset link." (no enumeration) |
| Validation Error | "Please enter a valid email address." |
| Permission Error | N/A |
| Unexpected Error | "Request failed. Please try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | Submit disabled, offline banner |

---

## S05: Reset Password (`/reset-password`)

**Purpose:** Set new password via token from email (WF-004).
**Primary Users:** Users with valid reset token.
**Related Workflow:** WF-004.
**App:** account (port 3002).

### ARIA Landmark Structure

```
<main role="main" aria-label="Reset password">
  <form aria-label="Set new password">
    <input aria-label="New password" aria-required="true" type="password" />
    <input aria-label="Confirm password" aria-required="true" type="password" />
    <button type="submit">Reset Password</button>
  </form>
</main>
```

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| token | Yes (hidden) | `POST /reset-password` → body.token | From URL query param |
| password | Yes | `POST /reset-password` → body.password | Min 8, 1 upper, 1 number |
| confirmPassword | Yes | Client-side only | Must match password |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner on submit |
| Empty | Two password fields |
| Success | "Password reset. Redirecting to sign in..." (auto-redirect 3s) |
| Validation Error | Inline: password strength, mismatch |
| Permission Error | "Invalid or expired reset link. Request a new one." |
| Unexpected Error | "Reset failed. Please try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | Submit disabled |

---

## S06: Account Claim (`/accept-invite`)

**Purpose:** Pre-imported members claim their accounts (WF-002).
**Primary Users:** Members imported via bulk roster.
**Related Workflow:** WF-002 (Account Claim).
**App:** account (port 3002).

### ARIA Landmark Structure

```
<main role="main" aria-label="Claim your account">
  <h1>Welcome to {orgName}</h1>
  <p>Your organization has set up an account for you.</p>
  <form aria-label="Set up your account">
    <input aria-label="First name" value="{prefilledFirstName}" aria-required="true" />
    <input aria-label="Email address" value="{prefilledEmail}" disabled aria-readonly="true" />
    <input aria-label="License number" value="{prefilledLicense}" disabled aria-readonly="true" />
    <input aria-label="Password" aria-required="true" type="password" />
    <button type="submit">Claim Account</button>
  </form>
</main>
```

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| token | Yes (hidden) | `POST /accept-invite` → body.token | From invitation URL |
| firstName | Editable | Pre-populated from invite | varchar(50) |
| email | Display only | Pre-populated from invite | Read-only |
| licenseNumber | Display only | Pre-populated from invite | Read-only |
| password | Yes | `POST /accept-invite` → body.password | Min 8, 1 upper, 1 number |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner, fields disabled |
| Empty | Pre-populated fields from invitation token |
| Success | Account claimed, redirect to /my/profile |
| Validation Error | Inline errors (password strength) |
| Permission Error | "This invitation link has expired. Contact your organization." |
| Unexpected Error | "Claim failed. Please try again." |
| Conflict/Duplicate | "An account already exists for this email. Sign in instead?" |
| Confirmation/Warning | N/A |
| Offline/Sync | Submit disabled, offline banner |

---

## S07: Onboarding Wizard (`/onboarding/[step]`)

**Purpose:** Guided org setup for officers after provisioning (WF-005).
**Primary Users:** Officers with org access.
**Related Workflow:** WF-005 (Smart Onboarding Wizard).
**App:** memberry (port 3004).

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Application navigation">...</nav>
</header>
<main role="main" aria-label="Onboarding wizard">
  <nav aria-label="Wizard progress">
    <ol role="list">
      <li aria-current="step">Step 1: Organization Profile</li>
      <li>Step 2: Import Members</li>
      <li>Step 3: Configure Dues</li>
      <li>Step 4: Payment Gateway</li>
      <li>Step 5: Invite Officers</li>
    </ol>
  </nav>
  <section aria-label="Step {N} content">
    <!-- Step-specific form -->
  </section>
  <footer role="contentinfo" aria-label="Wizard actions">
    <button>Save & Exit</button>
    <button>Skip</button>
    <button>Save & Continue</button>
  </footer>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | First form field of current step |
| Step transition | First field of new step |
| Resume | "Welcome back" banner, then first field of last step |
| Validation error | First invalid field |
| Step completed | Next step automatically |

### Fields / Displayed Data (per step)

**Step 1: Organization Profile**

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| name | Yes | `PUT /onboarding/step` → body.data | Pre-filled from provisioning |
| description | No | Same | Max 2000 chars |
| logoUrl | No | Same | Upload via /storage |
| contactEmail | No | Same | Standard email validation |

**Step 2: Import Members**

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| csvFile | No | `POST /invitations/bulk-import` | Max 1000 rows per M1-R6 |

**Step 3: Configure Dues**

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| duesAmount | No | Step data | Numeric |
| duesCurrency | No | Step data | Default: PHP |
| billingCycle | No | Step data | annual/semi-annual/quarterly |

**Step 4: Payment Gateway**

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| stripeConnect | No | Step data | Stripe Connect onboarding link |

**Step 5: Invite Officers**

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| inviteEmails | No | `POST /invitations` | Array of emails |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Save & Continue | PUT /onboarding/step, advance | Officer | Enter |
| Skip | Advance without saving | Officer | — |
| Save & Exit | PUT /onboarding/step, exit | Officer | — |
| Back | Return to previous step | Officer | — |

### Role-Variant Matrix

| Element | Officer | Member | Unauthenticated |
|---------|---------|--------|-----------------|
| Wizard UI | Visible | Redirect to /my/profile | Redirect to /auth/sign-in |
| Import step | Visible (president/secretary) | Hidden | Hidden |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Sidebar stepper (left) + form content (right) |
| Tablet (768-1024px) | Horizontal stepper (top) + form below |
| Mobile (<768px) | Compact stepper (step N of 5) + form below, bottom action bar |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton stepper + skeleton form fields |
| Empty | Default form per step |
| Success | Step marked complete (green check), auto-advance. Final step: confetti + "Setup complete!" |
| Validation Error | Inline errors per step field |
| Permission Error | Redirect to member dashboard |
| Unexpected Error | "Data preserved. Please try again." with retry |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | "Welcome back! You left off at step {N}." on resume |
| Offline/Sync | "Save failed. Data preserved locally. Will sync when online." |

### Edge Cases

- Officer leaves mid-wizard: state saved via GET /onboarding/state on return.
- CSV with >1000 rows: error at step 2, "Maximum 1,000 members per import."
- All steps skipped: wizard marked complete (all steps optional per spec).

---

## S08: MFA Enrollment (`/settings/mfa`)

**Purpose:** Enroll in TOTP-based MFA.
**Primary Users:** All authenticated users.
**Related Workflow:** WF-003 (Login security).
**App:** account (port 3002).

### ARIA Landmark Structure

```
<main role="main" aria-label="MFA enrollment">
  <section aria-label="Setup authenticator">
    <img alt="QR code for authenticator app" />
    <p>Manual key: {secret}</p>
    <form aria-label="Verify authenticator">
      <input aria-label="Verification code" aria-required="true" />
      <button type="submit">Verify & Enable</button>
    </form>
  </section>
</main>
```

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| qrCodeUrl | Display | `POST /auth/mfa/enroll` → data.qrCodeUrl | QR code image |
| secret | Display | `POST /auth/mfa/enroll` → data.secret | Manual entry backup |
| code | Yes | `POST /auth/mfa/verify` → body.code | 6-digit TOTP |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Spinner while QR generates |
| Empty | QR code displayed, code input blank |
| Success | sonner toast: "MFA enabled successfully." |
| Validation Error | "Invalid code. Please try again." |
| Permission Error | Redirect to /auth/sign-in |
| Unexpected Error | "Enrollment failed. Please try again." |
| Conflict/Duplicate | "MFA is already enabled." |
| Confirmation/Warning | "Save your backup codes before continuing." |
| Offline/Sync | "MFA enrollment requires an internet connection." |
