<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M10 Credit Tracking -- Component Specifications

## Table of Contents
1. [CycleProgressBar](#cycleprogressbar)
2. [CreditEntryTable](#creditentrytable)
3. [CreditEntryRow](#creditentryrow)
4. [ManualCreditForm](#manualcreditform)
5. [ComplianceStatusBadge](#compliancestatusbadge)
6. [CreditAdjustmentDialog](#creditadjustmentdialog)
7. [ComplianceMemberRow](#compliancememberrow)
8. [OrgCycleSelector](#orgcycleselector)
9. [TranscriptDownloadButton](#transcriptdownloadbutton)

---

## CycleProgressBar

**Purpose:** Visual progress indicator for credit compliance within a cycle.
**Used in:** My Credits, Org Credit Compliance (inline per member)

### TypeScript Props

```typescript
interface CycleProgressBarProps {
  earnedCredits: number;
  requiredCredits: number;
  carryoverCredits: number;
  cycleStart: string; // ISO 8601
  cycleEnd: string;
  size?: "sm" | "md" | "lg";
}
```

### WAI-ARIA Pattern

- **Pattern:** Progressbar
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/meter/
- **Implementation:** `<div role="progressbar" aria-valuenow="{earned + carryover}" aria-valuemin="0" aria-valuemax="{required}" aria-label="Credit progress: {earned + carryover} of {required} credits">`

### Keyboard Spec

Not interactive.

### Render Contract

- Progress fill: `(earnedCredits + carryoverCredits) / requiredCredits * 100`
- Color: green if >= 100%, amber if >= 50%, red if < 50%
- Carryover portion: distinct hatched pattern within the fill
- Text below: "{earned} earned + {carryover} carryover / {required} required"
- Cycle date range displayed above or below bar
- Overflow (> 100%): bar maxes at 100%, text shows actual total

### Events

None (presentational).

### States

- Zero: empty bar, red
- InProgress: partial fill
- Complete: full bar, green, checkmark icon
- Overflow: full bar, green, "+{excess} excess" label

---

## CreditEntryTable

**Purpose:** Tabular display of credit entries for a member.
**Used in:** My Credits screen

### TypeScript Props

```typescript
interface CreditEntryTableProps {
  entries: CreditEntry[];
  isLoading: boolean;
  onSort?: (field: string, direction: "asc" | "desc") => void;
  sortField?: string;
  sortDirection?: "asc" | "desc";
}

interface CreditEntry {
  id: string;
  activityName: string;
  activityDate: string;
  credits: number;
  source: "auto" | "manual";
  verificationStatus: "pending" | "verified" | "rejected";
  organizationName: string;
  trainingId?: string;
  createdAt: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** Table (sortable)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/table/
- **Implementation:** `<table aria-label="Credit entries">`, sortable column headers use `aria-sort`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between sortable column headers and interactive cells |
| Enter / Space | Toggle sort on focused column header |

### Render Contract

- Columns: Activity, Date, Credits, Source (badge), Status (badge), Org
- Auto entries link to the training detail
- Manual entries show "Self-reported" badge
- Rejected entries show strikethrough on credits
- Empty: "No credits yet." message

### Events

| Event | Payload | When |
|-------|---------|------|
| onSort | `(field, direction)` | Column header clicked |

---

## CreditEntryRow

**Purpose:** Single row in the credit entry table.
**Used in:** CreditEntryTable

### TypeScript Props

```typescript
interface CreditEntryRowProps {
  entry: CreditEntry;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<tr>` with cells using semantic content

### Render Contract

- Source badge: "Auto" (blue) for training-awarded, "Manual" (gray) for self-reported
- Status badge: "Verified" (green), "Pending" (amber), "Rejected" (red)
- Rejected entries: credits shown with strikethrough, not counted in totals
- Date formatted locale-aware

---

## ManualCreditForm

**Purpose:** Inline or dialog form for adding a self-reported credit entry.
**Used in:** My Credits screen

### TypeScript Props

```typescript
interface ManualCreditFormProps {
  onSubmit: (values: ManualCreditValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface ManualCreditValues {
  activityName: string;
  activityDate: string;
  credits: number;
  description?: string;
  documentUrl?: string; // optional supporting evidence
}
```

### WAI-ARIA Pattern

- **Pattern:** Form
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/
- **Implementation:** `<form aria-label="Add manual credit entry">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between form fields |
| Enter | Submit (on submit button) |
| Escape | Cancel and close form |

### Render Contract

- Fields: activityName (text), activityDate (date picker), credits (number), description (textarea), documentUrl (file upload or URL)
- Inline validation on blur
- Submit button: "Add Credit"
- Cancel button: "Cancel"

### Validation

| Field | Rule |
|-------|------|
| activityName | required, max 300 chars |
| activityDate | required, not future |
| credits | required, positive integer |
| description | optional, max 1000 chars |

### Events

| Event | Payload | When |
|-------|---------|------|
| onSubmit | `ManualCreditValues` | Form submitted with valid data |
| onCancel | -- | Cancel clicked or Escape |

### States

- Pristine: empty form
- Dirty: field values changed
- Validating: field-level validation
- Submitting: all disabled, spinner
- Error: inline errors

---

## ComplianceStatusBadge

**Purpose:** Visual badge for member compliance status.
**Used in:** My Credits, Org Credit Compliance table

### TypeScript Props

```typescript
interface ComplianceStatusBadgeProps {
  status: "compliant" | "at-risk" | "non-compliant";
  size?: "sm" | "md";
}
```

### WAI-ARIA Pattern

- **Implementation:** `<span role="status" aria-label="Compliance status: {status}">`

### Render Contract

| Status | Color | Icon | Condition |
|--------|-------|------|-----------|
| compliant | green | check-circle | earned + carryover >= required |
| at-risk | amber | alert-triangle | earned + carryover >= 50% of required AND cycle > 50% elapsed |
| non-compliant | red | x-circle | earned + carryover < 50% of required AND cycle > 50% elapsed, OR cycle ended and not met |

---

## CreditAdjustmentDialog

**Purpose:** Officer dialog for awarding or deducting credits with mandatory reason.
**Used in:** Org Credit Compliance screen

### TypeScript Props

```typescript
interface CreditAdjustmentDialogProps {
  open: boolean;
  memberName: string;
  memberId: string;
  currentCredits: number;
  onSubmit: (values: CreditAdjustmentValues) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

interface CreditAdjustmentValues {
  personId: string;
  credits: number; // positive for award, negative for deduct
  reason: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** Dialog (modal)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **Implementation:** `<dialog aria-label="Adjust credits for {memberName}" aria-modal="true">`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Escape | Close dialog |
| Tab | Trap focus within dialog |
| Enter | Submit (on submit button) |

### Render Contract

- Header: "Adjust Credits for {memberName}"
- Type toggle: Award / Deduct (radio group)
- Credits field: positive integer
- Reason field: textarea (required, min 10 chars)
- Preview: "New total: {currentCredits + adjustment}"
- Submit: "Award Credits" or "Deduct Credits" (varies by type)
- Cancel button

### Validation

| Field | Rule | Error |
|-------|------|-------|
| credits | required, positive integer | "Enter a credit amount" |
| reason | required, min 10 chars | "Reason required (min 10 characters)" |

### Events

| Event | Payload | When |
|-------|---------|------|
| onSubmit | `CreditAdjustmentValues` | Valid form submitted |
| onClose | -- | Cancel or Escape |

---

## ComplianceMemberRow

**Purpose:** Single member row in the officer compliance table.
**Used in:** Org Credit Compliance screen

### TypeScript Props

```typescript
interface ComplianceMemberRowProps {
  member: {
    personId: string;
    personName: string;
    earnedCredits: number;
    requiredCredits: number;
    carryoverCredits: number;
    complianceStatus: "compliant" | "at-risk" | "non-compliant";
    lastActivityDate: string | null;
  };
  onAdjust: (personId: string) => void;
}
```

### WAI-ARIA Pattern

- **Implementation:** `<tr>` with `aria-label="Credit compliance for {personName}"`

### Render Contract

- Name: linked to member profile
- Mini progress bar inline
- Compliance badge
- Last activity date (or "No activity" if null)
- Adjust button

---

## OrgCycleSelector

**Purpose:** Selector for switching between organizations and compliance cycles.
**Used in:** My Credits screen

### TypeScript Props

```typescript
interface OrgCycleSelectorProps {
  organizations: { id: string; name: string }[];
  selectedOrgId: string | null; // null = all orgs
  cycles: { id: string; label: string; startDate: string; endDate: string }[];
  selectedCycleId: string;
  onOrgChange: (orgId: string | null) => void;
  onCycleChange: (cycleId: string) => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Combobox / Select
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- **Implementation:** Two `<select>` elements with labels

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow Up/Down | Navigate options |
| Enter | Select option |

---

## TranscriptDownloadButton

**Purpose:** Button to download credit transcript in PDF or CSV format.
**Used in:** My Credits screen

### TypeScript Props

```typescript
interface TranscriptDownloadButtonProps {
  cycleId?: string;
  personId?: string; // admin override
  isDownloading: boolean;
  onDownload: (format: "pdf" | "csv") => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** Menu button (split button with format options)
- **Ref:** https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
- **Implementation:** `<button aria-haspopup="menu" aria-expanded="{open}">` with dropdown for format selection

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter / Space | Open format menu or trigger download |
| Arrow Down | Open menu |
| Escape | Close menu |

### Render Contract

- Primary button: "Download Transcript"
- Dropdown: "PDF" and "CSV" options
- Downloading state: spinner, "Generating..."
- Feature flag: `credit_transcript_export` -- hidden if flag is off

### Events

| Event | Payload | When |
|-------|---------|------|
| onDownload | `"pdf" \| "csv"` | Format selected |
