<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Components: Auth & Onboarding (M01)

---

## C01: RegistrationForm

**WAI-ARIA Pattern:** form (no special pattern needed)
**Used In:** S01 Registration

### TypeScript Props Interface

```typescript
interface RegistrationFormProps {
  /** Pre-filled email from invitation link (optional) */
  defaultEmail?: string;
  /** Called on successful registration with the email for OTP verification */
  onSuccess: (email: string) => void;
  /** Called when user navigates to login */
  onNavigateLogin: () => void;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between form fields and buttons |
| Enter | Submit form when button focused or inside form |
| Escape | No special behavior |

### Render Contract

- Renders: firstName, lastName, email, password, licenseNumber inputs + submit button
- Password field includes show/hide toggle button
- License number shows format hint below input
- Submit button shows spinner when loading
- Error messages rendered as `<p role="alert">` below each field
- Link to /auth/sign-in at bottom

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onSuccess | 200 from POST /register | `email: string` |
| onNavigateLogin | Click "Sign in" link | — |
| onError | Non-validation server error | `Error` |

### States

| State | Visual |
|-------|--------|
| Default | Empty form, submit enabled |
| Loading | Inputs disabled, spinner on submit |
| Disabled | N/A (always interactive) |
| Error | Red border on invalid fields, error text below |
| Success | Brief success message, then navigate |

---

## C02: OtpInput

**WAI-ARIA Pattern:** group (role="group" with label)
**Used In:** S02 OTP Verification, S03 Login (MFA), S08 MFA Enrollment

### TypeScript Props Interface

```typescript
interface OtpInputProps {
  /** Number of digits (default: 6) */
  length?: number;
  /** Called when all digits entered */
  onComplete: (code: string) => void;
  /** Whether inputs are disabled */
  disabled?: boolean;
  /** Error message to display below */
  error?: string;
  /** Accessible label for the group */
  label?: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| 0-9 | Enter digit, auto-advance to next input |
| Backspace | Clear current digit, move to previous input |
| ArrowLeft | Move focus to previous input |
| ArrowRight | Move focus to next input |
| Ctrl/Cmd+V | Paste full code, distribute across inputs |
| Tab | Move focus out of group |

### Render Contract

- Renders N individual `<input>` elements inside a `<div role="group">`
- Each input: `inputmode="numeric"`, `maxlength="1"`, `autocomplete="one-time-code"` on first
- Auto-submit when all digits filled (calls onComplete)
- Error text below as `<p role="alert">`
- Inputs show red border when error prop set

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onComplete | All digits entered | `code: string` (e.g., "482901") |
| onChange | Any digit changed | — (internal state) |

### States

| State | Visual |
|-------|--------|
| Default | Empty bordered boxes, focused first |
| Loading | N/A (parent handles) |
| Disabled | Grey background, not interactive |
| Error | Red borders, error text below |
| Success | N/A (parent navigates away) |

---

## C03: PasswordInput

**WAI-ARIA Pattern:** none (standard input with toggle)
**Used In:** S01 Registration, S03 Login, S05 Reset Password, S06 Account Claim

### TypeScript Props Interface

```typescript
interface PasswordInputProps {
  /** Input field name */
  name: string;
  /** Accessible label */
  label: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Validation error message */
  error?: string;
  /** Show strength meter (registration/reset only) */
  showStrength?: boolean;
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Standard focus behavior |
| Enter | Activates show/hide toggle if focused on it |

### Render Contract

- Input with `type="password"` (toggleable to "text")
- Eye icon button: `aria-label="Show password"` / `aria-label="Hide password"`
- Strength meter (optional): 4-segment bar (weak/fair/good/strong)
- Hint text: `aria-describedby` pointing to requirements text
- Error text as `<p role="alert">`

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onChange | User types | `value: string` |
| onBlur | Field loses focus | — |

### States

| State | Visual |
|-------|--------|
| Default | Masked input, eye icon visible |
| Revealed | Plaintext, eye-slash icon |
| Error | Red border, error text below |
| Strength: weak | Red bar segment |
| Strength: fair | Orange, 2 segments |
| Strength: good | Yellow, 3 segments |
| Strength: strong | Green, 4 segments |

---

## C04: LoginForm

**WAI-ARIA Pattern:** form
**Used In:** S03 Login

### TypeScript Props Interface

```typescript
interface LoginFormProps {
  /** Pre-filled email (from redirect or claim) */
  defaultEmail?: string;
  /** Return URL after successful login */
  returnUrl?: string;
  /** Called on successful authentication */
  onSuccess: (session: { personId: string; sessionToken: string }) => void;
  /** Called when MFA is required */
  onMfaRequired: () => void;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Move between fields and actions |
| Enter | Submit form |

### Render Contract

- Email input + PasswordInput component
- "Sign In" primary button
- "Send Magic Link" secondary button (uses email value)
- "Forgot password?" link
- "Create an account" link
- MFA state: replaces password with OtpInput
- Lock state: all inputs disabled, lock message shown

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onSuccess | 200 with session | `{ personId, sessionToken }` |
| onMfaRequired | Server returns MFA challenge | — |
| onLocked | 429 / account locked | `{ retryAfter: number }` |

### States

| State | Visual |
|-------|--------|
| Default | Email + password fields |
| Loading | Spinner, disabled inputs |
| MFA | TOTP OtpInput replaces password |
| Locked | Banner: "Account locked. Try again in {N} min." |
| Error | "Incorrect email or password." |

---

## C05: OnboardingStepper

**WAI-ARIA Pattern:** none (custom stepper with ordered list)
**Used In:** S07 Onboarding Wizard

### TypeScript Props Interface

```typescript
interface OnboardingStepperProps {
  /** Total number of steps */
  totalSteps: number;
  /** Current step index (0-based) */
  currentStep: number;
  /** Steps that have been completed */
  completedSteps: number[];
  /** Whether the stepper is in sidebar mode (desktop) or horizontal (tablet/mobile) */
  orientation: 'vertical' | 'horizontal' | 'compact';
  /** Step labels */
  labels: string[];
  /** Called when a completed step is clicked to navigate back */
  onStepClick?: (stepIndex: number) => void;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Focus moves through clickable completed steps |
| Enter / Space | Navigate to clicked completed step |
| ArrowUp/Down | Move between steps (vertical mode) |
| ArrowLeft/Right | Move between steps (horizontal mode) |

### Render Contract

- Vertical sidebar (desktop): `<ol>` with step items, connector lines between
- Horizontal (tablet): `<ol>` horizontal with dot connectors
- Compact (mobile): "Step {N} of {total}" text
- Completed steps: green checkmark icon, clickable
- Current step: blue highlight, `aria-current="step"`
- Future steps: grey, not interactive

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onStepClick | Click completed step | `stepIndex: number` |

### States

| State | Visual |
|-------|--------|
| Default | Steps with current highlighted |
| Loading | Skeleton placeholders |
| All complete | All green checks |
| Single step | No navigation, just progress text |

---

## C06: BulkImportUpload

**WAI-ARIA Pattern:** none (file upload)
**Used In:** S07 Onboarding Wizard (Step 2)

### TypeScript Props Interface

```typescript
interface BulkImportUploadProps {
  /** Organization ID for the import */
  organizationId: string;
  /** Called with import results */
  onImportComplete: (result: { total: number; imported: number; errors: ImportError[] }) => void;
  /** Maximum rows allowed (default: 1000 per M1-R6) */
  maxRows?: number;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}
```

### Keyboard Interaction

| Key | Behavior |
|-----|----------|
| Tab | Focus file input / drop zone |
| Enter / Space | Open file picker |
| Escape | Cancel file selection dialog |

### Render Contract

- Drag-and-drop zone with file icon
- "Drag CSV here or click to browse" text
- Template download link: "Download CSV template"
- Progress bar during upload
- Results summary: "{N} imported, {M} errors"
- Error table: row number, field, error message

### Events / Callbacks

| Event | Trigger | Payload |
|-------|---------|---------|
| onImportComplete | POST /invitations/bulk-import returns | `{ total, imported, errors }` |
| onError | Upload fails | `Error` |

### States

| State | Visual |
|-------|--------|
| Default | Drop zone with dashed border |
| Dragging | Blue highlight border |
| Uploading | Progress bar, filename shown |
| Success | Green banner: "{N} members imported" |
| Partial | Amber banner: "{N} imported, {M} errors" + error table |
| Error | Red banner: "Import failed" |

---

## C07: MagicLinkButton

**WAI-ARIA Pattern:** none (button)
**Used In:** S03 Login

### TypeScript Props Interface

```typescript
interface MagicLinkButtonProps {
  /** Email to send magic link to */
  email: string;
  /** Whether button is disabled (no email entered) */
  disabled?: boolean;
}
```

### Render Contract

- Secondary button: "Send Magic Link"
- After click: "Check your email for the link" (no email enumeration)
- Disabled when email field empty

### States

| State | Visual |
|-------|--------|
| Default | Secondary button style |
| Disabled | Greyed out (no email) |
| Loading | Spinner |
| Sent | "Check your email" text replaces button for 5s |

---

## C08: InvitationForm

**WAI-ARIA Pattern:** none (form with dynamic list)
**Used In:** S07 Onboarding Wizard (Step 5)

### TypeScript Props Interface

```typescript
interface InvitationFormProps {
  /** Organization ID */
  organizationId: string;
  /** Called when invitations sent */
  onSent: (count: number) => void;
}
```

### Render Contract

- Dynamic email input list (add/remove rows)
- Role selector per invitation (officer position)
- "Send Invitations" button
- Sent confirmation: sonner toast "{N} invitations sent"

### States

| State | Visual |
|-------|--------|
| Default | 1 email row + "Add another" button |
| Loading | Spinner on send button |
| Error | Per-row validation (invalid email) |
| Success | sonner toast, inputs cleared |
