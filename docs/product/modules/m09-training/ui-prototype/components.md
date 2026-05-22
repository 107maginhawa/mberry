<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M09 Training -- Component Specifications

## Table of Contents
1. [TrainingCard](#trainingcard)
2. [TrainingForm](#trainingform)
3. [TrainingStatusBadge](#trainingstatusbadge)
4. [TrainingTypeBadge](#trainingtypebadge)
5. [EnrollmentRow](#enrollmentrow)
6. [AttendanceCheckbox](#attendancecheckbox)
7. [CreditAmountDisplay](#creditamountdisplay)
8. [CertificatePreview](#certificatepreview)
9. [TrainingAnalyticsSummary](#traininganalyticssummary)
10. [QrScannerModal](#qrscannermodal)

---

## TrainingCard

**Purpose:** Renders a single training as a card in list/grid views.
**Used in:** Training Dashboard, My Training

### TypeScript Props

```typescript
interface TrainingCardProps {
  training: {
    id: string;
    title: string;
    trainingType: "seminar" | "workshop" | "convention" | "onlineCourse" | "skillsTraining";
    status: "draft" | "published" | "cancelled" | "completed";
    startDate: string; // ISO 8601
    endDate: string;
    location: string | null;
    instructorName: string | null;
    enrollmentCount: number;
    capacity: number | null;
    creditBearing: boolean;
    creditAmount: number;
    organizationId: string;
  };
  enrollment?: {
    status: "enrolled" | "completed" | "cancelled" | "noShow";
    certificateId: string | null;
  };
  variant: "officer" | "member";
  onPublish?: (id: string) => void;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
  onEnrollmentCancel?: (id: string) => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Card (no specific WAI-ARIA pattern; uses semantic HTML)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/
- **Implementation:** `<article>` with `aria-label="{title}"`, status communicated via `aria-describedby` pointing to status badge

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter / Space | Navigate to training detail (on card link) |
| Tab | Move focus between card actions (publish, cancel, etc.) |

### Render Contract

- Displays: type badge, title, date range, location, enrollment count, credit badge
- Officer variant: shows action buttons (publish, cancel, complete) based on status
- Member variant: shows enrollment status, certificate download link
- Cancelled training: reduced opacity (0.6), strikethrough on title

### Events

| Event | Payload | When |
|-------|---------|------|
| onPublish | `(id: string)` | Officer clicks publish button |
| onCancel | `(id: string)` | Officer clicks cancel button |
| onComplete | `(id: string)` | Officer clicks complete button |
| onEnrollmentCancel | `(id: string)` | Member cancels enrollment |

### States

- Default: normal card
- Hover: subtle shadow elevation
- Mutating: action button shows spinner, card non-interactive
- Cancelled: dimmed appearance

---

## TrainingForm

**Purpose:** Form for creating or editing a training.
**Used in:** Create/Edit Training screen

### TypeScript Props

```typescript
interface TrainingFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<TrainingFormValues>;
  providers: AccreditedProvider[];
  onSubmit: (values: TrainingFormValues) => Promise<void>;
  onPublish?: (values: TrainingFormValues) => Promise<void>;
  isSubmitting: boolean;
}

interface TrainingFormValues {
  title: string;
  trainingType: "seminar" | "workshop" | "convention" | "onlineCourse" | "skillsTraining";
  description: string;
  instructorName: string;
  instructorId: string | null;
  location: string;
  startDate: string;
  endDate: string;
  capacity: number | null;
  registrationFee: number;
  currency: string;
  creditBearing: boolean;
  creditAmount: number;
  accreditedProviderId: string | null;
  isNonCreditBearing: boolean;
}

interface AccreditedProvider {
  id: string;
  name: string;
  accreditationNumber: string;
  status: "active" | "inactive" | "expired";
}
```

### WAI-ARIA Pattern

- **Pattern:** Form (landmark)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/
- **Implementation:** `<form aria-label="Training details">`, required fields use `aria-required="true"`, error fields use `aria-invalid="true"` + `aria-errormessage`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between form fields |
| Enter | Submit form (when on submit button) |
| Escape | Cancel and navigate back (with unsaved changes confirmation) |

### Render Contract

- Credit fields (creditAmount, accreditedProviderId, isNonCreditBearing) hidden until creditBearing=true
- Edit mode with status=published: only title, description, location, capacity editable
- Inline validation errors appear below each field on blur or submit
- registrationFee displayed as currency format (PHP by default)

### Events

| Event | Payload | When |
|-------|---------|------|
| onSubmit | `TrainingFormValues` | Save as Draft clicked |
| onPublish | `TrainingFormValues` | Save & Publish clicked |

### States

- Pristine: form with defaults or loaded values, no errors
- Dirty: unsaved changes indicator
- Validating: field-level validation on blur
- Submitting: all fields disabled, spinner on submit button
- Error: inline error messages, first error field focused

---

## TrainingStatusBadge

**Purpose:** Consistent status badge rendering for training lifecycle states.
**Used in:** TrainingCard, Training Dashboard table rows, Training Detail header

### TypeScript Props

```typescript
interface TrainingStatusBadgeProps {
  status: "draft" | "published" | "cancelled" | "completed";
  size?: "sm" | "md";
}
```

### WAI-ARIA Pattern

- **Pattern:** Status (implicit via semantic text)
- **Implementation:** `<span role="status" aria-label="Status: {status}">` with visually distinct colors

### Keyboard Spec

Not interactive -- no keyboard handling needed.

### Render Contract

| Status | Color | Icon |
|--------|-------|------|
| draft | gray/muted | pencil |
| published | green | check-circle |
| cancelled | red | x-circle |
| completed | blue | trophy |

### Events

None (presentational component).

### States

Single state -- renders based on `status` prop.

---

## TrainingTypeBadge

**Purpose:** Display training type as a colored badge.
**Used in:** TrainingCard, Training Detail

### TypeScript Props

```typescript
interface TrainingTypeBadgeProps {
  type: "seminar" | "workshop" | "convention" | "onlineCourse" | "skillsTraining";
}
```

### WAI-ARIA Pattern

- **Implementation:** `<span aria-label="Training type: {formatted label}">`

### Keyboard Spec

Not interactive.

### Render Contract

| Type | Label | Color |
|------|-------|-------|
| seminar | Seminar | indigo |
| workshop | Workshop | amber |
| convention | Convention | purple |
| onlineCourse | Online Course | cyan |
| skillsTraining | Skills Training | emerald |

### Events

None.

### States

Single state.

---

## EnrollmentRow

**Purpose:** Single enrollee row in attendance management.
**Used in:** Training Attendance screen

### TypeScript Props

```typescript
interface EnrollmentRowProps {
  enrollment: {
    id: string;
    personId: string;
    personName: string;
    status: "enrolled" | "completed" | "cancelled" | "noShow";
  };
  creditAmount: number;
  isAttended: boolean;
  isLocked: boolean;
  onToggleAttendance: (enrollmentId: string, attended: boolean) => void;
  onMarkNoShow: (enrollmentId: string) => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Row within table / list
- **Implementation:** `<tr>` in table context or `<li>` in list context, checkbox has `aria-label="Mark {name} as attended"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Space | Toggle attendance checkbox |
| Tab | Move to next interactive element |

### Render Contract

- Cancelled enrollments: greyed out, checkbox disabled
- Completed (already attended): green check, non-interactive
- NoShow: red X icon
- Locked (attendance already submitted): all controls disabled

### Events

| Event | Payload | When |
|-------|---------|------|
| onToggleAttendance | `(id, boolean)` | Checkbox toggled |
| onMarkNoShow | `(id)` | No-show button clicked |

### States

- Interactive: checkbox enabled
- Locked: checkbox disabled, read-only
- Cancelled: greyed out row

---

## AttendanceCheckbox

**Purpose:** Accessible checkbox for marking attendance.
**Used in:** EnrollmentRow

### TypeScript Props

```typescript
interface AttendanceCheckboxProps {
  enrollmentId: string;
  personName: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enrollmentId: string, checked: boolean) => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Checkbox
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
- **Implementation:** Native `<input type="checkbox">` with `aria-label="Mark {personName} as attended"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Space | Toggle checked state |

### Render Contract

- Unchecked: empty checkbox
- Checked: filled checkbox with checkmark
- Disabled: reduced opacity, cursor not-allowed

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `(enrollmentId, checked)` | State toggles |

---

## CreditAmountDisplay

**Purpose:** Display credit amount with consistent formatting.
**Used in:** TrainingCard, Certificate, Attendance screen

### TypeScript Props

```typescript
interface CreditAmountDisplayProps {
  credits: number;
  creditBearing: boolean;
  size?: "sm" | "md" | "lg";
}
```

### WAI-ARIA Pattern

- **Implementation:** `<span aria-label="{credits} CPD credits">`

### Render Contract

- creditBearing=false: hidden
- credits=0 + creditBearing=true: shows "0 credits" (non-credit-bearing training)
- credits > 0: shows "{n} CPD Credits" with icon

---

## CertificatePreview

**Purpose:** Rendered preview of a training certificate.
**Used in:** Certificate View screen

### TypeScript Props

```typescript
interface CertificatePreviewProps {
  certificate: {
    certificateNumber: string;
    memberName: string;
    trainingTitle: string;
    trainingDate: string;
    creditAmount: number;
    organizationName: string;
    qrCodeUrl: string;
  };
  onDownload: () => void;
  onShare?: () => void;
  isDownloading: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Document-like (no specific pattern)
- **Implementation:** `<article aria-label="Certificate for {trainingTitle}">`, QR code has `alt="Verification QR code for certificate {certificateNumber}"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between download and share buttons |
| Enter | Activate focused button |

### Render Contract

- A4-ratio container with certificate layout
- QR code in bottom-right corner
- Organization logo/name header
- Member name, training title, date, credits in body
- Certificate number as footer

---

## TrainingAnalyticsSummary

**Purpose:** Summary cards for training metrics on the officer dashboard.
**Used in:** Training Dashboard

### TypeScript Props

```typescript
interface TrainingAnalyticsSummaryProps {
  totalTrainings: number;
  activeTrainings: number;
  completionRate: number; // 0-100
  totalCreditsAwarded: number;
  totalEnrollments: number;
  isLoading: boolean;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<section aria-label="Training analytics">` with individual `<div role="group" aria-label="{metric name}">`

### Render Contract

- 4-5 metric cards: Total Trainings, Active, Completion Rate (%), Total Credits Awarded, Total Enrollments
- Loading: skeleton cards
- Numbers formatted with locale-aware separators

---

## QrScannerModal

**Purpose:** Camera-based QR scanner for attendance marking.
**Used in:** Training Attendance screen

### TypeScript Props

```typescript
interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  onError: (error: Error) => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Dialog (modal)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **Implementation:** `<dialog aria-label="QR Scanner" aria-modal="true">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Escape | Close modal |
| Tab | Trap focus within modal |

### Render Contract

- Camera viewfinder with scanning overlay
- "Point camera at member's QR code" instruction
- Manual entry fallback link
- Close button in top-right

### Events

| Event | Payload | When |
|-------|---------|------|
| onScan | `string` (member ID from QR) | QR code successfully read |
| onError | `Error` | Camera permission denied or scan failure |
| onClose | -- | Modal closed |

### States

- Requesting: "Allow camera access" prompt
- Scanning: Active camera feed with overlay
- Success: Brief green flash, then auto-close
- Error: "Camera unavailable. Use manual search instead."
