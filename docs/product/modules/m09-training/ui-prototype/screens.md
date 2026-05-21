<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M09 Training -- Screen Specifications

## Table of Contents
1. [Training Dashboard](#screen-training-dashboard)
2. [Create/Edit Training](#screen-create-edit-training)
3. [Training Attendance](#screen-training-attendance)
4. [My Training](#screen-my-training)
5. [Certificate View](#screen-certificate-view)

---

## Screen: Training Dashboard

**Route:** `/org/[id]/officer/training`
**Purpose:** Officer management of all trainings for the organization
**Workflow:** Create & Publish Training [INFERRED]

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Training Management" |
| `navigation` | `<nav>` | "Training filters" |
| `main` | `<main>` | "Training list" |
| `region` | `<section>` | "Analytics summary" |

### Focus Management

- Page load: focus moves to `<h1>` "Training Management"
- After creating a training: focus returns to training list, toast announces "Training created"
- After status change: focus stays on the affected training row, live region announces new status

### Fields Displayed

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| title | string | training.title | Max 300 chars |
| trainingType | enum badge | training.trainingType | seminar, workshop, convention, onlineCourse, skillsTraining |
| status | status badge | training.status | draft, published, cancelled, completed |
| startDate | datetime | training.startDate | Formatted locale-aware |
| endDate | datetime | training.endDate | Formatted locale-aware |
| enrollmentCount | number | training.enrollmentCount | "X / capacity" or "X enrolled" if no capacity |
| creditAmount | number | training.creditAmount | Shown only if creditBearing=true |
| instructorName | string | training.instructorName | Optional |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Create Training | `<button>` | `aria-label="Create new training"` | Officer role | navigates to `/org/[id]/officer/training/new` |
| View/Edit | `<a>` on row | `aria-label="Edit training: {title}"` | Always | navigates to edit screen |
| Publish | `<button>` | `aria-label="Publish training: {title}"` | status=draft | `PUT /org/:orgId/trainings/:id/publish` |
| Cancel | `<button>` | `aria-label="Cancel training: {title}"` | status=published | `PUT /org/:orgId/trainings/:id/cancel` |
| Complete | `<button>` | `aria-label="Complete training: {title}"` | status=published | `PUT /org/:orgId/trainings/:id/complete` |
| Filter by status | `<select>` | `aria-label="Filter by status"` | Always | client-side filter + refetch |
| Filter by type | `<select>` | `aria-label="Filter by training type"` | Always | client-side filter + refetch |
| Search | `<input type="search">` | `aria-label="Search trainings"` | Always | debounced query param |

### Role-Variant Matrix

| Element | Member | Officer | President | Admin | Super |
|---------|--------|---------|-----------|-------|-------|
| Training list (read) | -- | visible | visible | visible | visible |
| Create button | hidden | visible | visible | visible | visible |
| Publish/Cancel/Complete | hidden | visible | visible (2FA for cancel) | visible | visible |
| Analytics summary | hidden | visible | visible | visible | visible |
| Non-officer redirect | PermissionError | -- | -- | -- | -- |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px (lg) | Table with all columns, analytics sidebar |
| 768-1023px (md) | Table with collapsed columns (hide instructor, credit), analytics above |
| < 768px (sm) | Card stack, one training per card, analytics as expandable summary |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton rows (6), pulsing analytics cards | Initial fetch |
| Empty | Illustration + "No trainings yet. Create your first one." + CTA button | data.length === 0 |
| Success | Populated table + analytics | data.length > 0 |
| Refreshing | Subtle spinner in header, table remains visible | Background refetch |
| Error | Alert banner "Unable to load trainings. Please try again." + retry button | API error |
| PermissionError | Redirect to org dashboard with toast "You need officer access to manage trainings." | Non-officer |
| FilteredEmpty | Table with "No trainings match your filters." + clear filters link | Filters active, 0 results |
| Mutating | Disabled action button with spinner | Publish/Cancel/Complete in flight |
| Offline | Banner "You're offline. Showing cached data." | navigator.onLine === false |

### Validation

N/A (read-only list with action buttons).

### Permissions

- Auth: GA (all authenticated) for read
- Mutations: GA+HG -- officer, admin, super; president requires 2FA for cancel

### Edge Cases

- Training with null capacity displays "Unlimited" instead of "0 / null"
- Cancelled trainings are dimmed but remain visible in the list
- Completed trainings show a checkmark badge and lock all mutation actions

---

## Screen: Create/Edit Training

**Route:** `/org/[id]/officer/training/new` (create) | `/org/[id]/officer/training/[id]/edit` (edit)
**Purpose:** Create or modify a training event
**Workflow:** Create & Publish Training [INFERRED]

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Create Training" or "Edit Training: {title}" |
| `main` | `<main>` | "Training form" |
| `form` | `<form>` | "Training details" |

### Focus Management

- Page load (create): focus on first field (title)
- Page load (edit): focus on `<h1>`
- After save success: navigate to dashboard, toast "Training saved"
- After validation error: focus on first invalid field, aria-invalid=true

### Fields

| Field | Type | Required | Validation | Default | ARIA |
|-------|------|----------|------------|---------|------|
| title | text input | Yes | max 300 chars, non-empty | "" | `aria-required="true"` |
| trainingType | select | Yes | enum: seminar, workshop, convention, onlineCourse, skillsTraining | -- | `aria-required="true"` |
| description | rich text editor | No | -- | "" | `aria-label="Training description"` |
| instructorName | text input | No | max 200 chars | "" | -- |
| instructorId | person search/select | No | valid person UUID | null | `aria-label="Search for instructor"` |
| location | text input | No | max 500 chars | "" | -- |
| startDate | datetime picker | Yes | must be in the future | -- | `aria-required="true"` |
| endDate | datetime picker | Yes | must be after startDate | -- | `aria-required="true"` |
| capacity | number input | No | positive integer or empty | null | `aria-describedby="capacity-help"` |
| registrationFee | currency input | No | >= 0 | 0 | -- |
| currency | select | No | ISO 4217 | "PHP" | -- |
| creditBearing | checkbox | No | -- | false | `aria-controls="credit-fields"` |
| creditAmount | number input | Conditional | >= 0; > 0 if creditBearing=true | 0 | shown only if creditBearing=true |
| accreditedProviderId | select | No | valid provider UUID | null | shown only if creditBearing=true |
| isNonCreditBearing | checkbox | No | if true, creditAmount=0 allowed | false | visible only when creditBearing=true |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Save as Draft | `<button type="submit">` | `aria-label="Save training as draft"` | Always | `POST /org/:orgId/trainings` (create) or `PUT .../trainings/:id` (edit) |
| Save & Publish | `<button>` | `aria-label="Save and publish training"` | New or draft | POST then PUT .../publish |
| Cancel | `<a>` | `aria-label="Cancel and return to dashboard"` | Always | navigates back |
| Delete Draft | `<button>` | `aria-label="Delete draft training"` | Edit mode, status=draft | Confirmation dialog first |

### Role-Variant Matrix

| Element | Officer | President | Admin | Super |
|---------|---------|-----------|-------|-------|
| All form fields | editable | editable | editable | editable |
| Save & Publish | visible | visible | visible | visible |
| Delete Draft | visible | visible (2FA) | visible | visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Two-column: main fields left, credit/fee fields right |
| 768-1023px | Single column, credit fields in collapsible section |
| < 768px | Single column, stacked fields, full-width inputs |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton form (edit mode only) | Fetching existing training |
| Empty | Clean form with defaults (create mode) | New training |
| Success | Form pre-filled with saved values | Edit mode loaded |
| Refreshing | N/A | -- |
| ValidationError | Inline errors below fields, red borders, aria-invalid | Submit with invalid data |
| PermissionError | Redirect with toast "Officer access required" | Non-officer |
| Mutating | Disabled submit button with spinner, form fields disabled | Save in progress |
| ConfirmAction | Dialog: "Publish this training? Members will be notified." | Save & Publish clicked |
| Offline | Save button disabled, banner "You're offline" | navigator.onLine === false |

### Validation Rules

- title: required, max 300 chars
- trainingType: required, must be valid enum
- startDate: required, must be future
- endDate: required, must be after startDate
- creditAmount: must be > 0 if creditBearing=true and isNonCreditBearing=false (M09-005)
- registrationFee: >= 0 (bigint in centavos)
- capacity: positive integer or null

### Edge Cases

- Editing a published training: only title, description, location, capacity editable
- Credit-bearing toggle shows/hides credit fields with animation
- isNonCreditBearing checkbox only visible when creditBearing is checked (allows 0-credit trainings like orientations)

---

## Screen: Training Attendance

**Route:** `/org/[id]/officer/training/[id]/attendance`
**Purpose:** Mark attendance and trigger credit awards for completed training
**Workflow:** WF-060: Confirm Attendance & Award Credits

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Attendance: {training.title}" |
| `main` | `<main>` | "Enrollment attendance list" |
| `region` | `<section>` | "Attendance summary" |

### Focus Management

- Page load: focus on `<h1>` with training title
- After marking attendance: focus stays on current row, next row in tab order
- After bulk mark: live region announces "X of Y marked as attended"
- After credit award confirmation: focus on summary, toast "Credits awarded to X members"

### Fields Displayed

| Field | Source | Notes |
|-------|--------|-------|
| enrollee name | enrollment.personId -> person.name | Linked to person profile |
| enrollment status | enrollment.status | enrolled, completed, cancelled, noShow |
| attendance checkbox | local state | Checked = attended |
| credit amount | training.creditAmount | Shown per-row if creditBearing |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Mark Attended | `<input type="checkbox">` | `aria-label="Mark {name} as attended"` | status=enrolled | Local state |
| Mark No-Show | `<button>` | `aria-label="Mark {name} as no-show"` | status=enrolled | Local state |
| Bulk Mark All | `<button>` | `aria-label="Mark all as attended"` | Any enrolled | Sets all checkboxes |
| Confirm & Award | `<button>` | `aria-label="Confirm attendance and award credits"` | >= 1 marked | `POST /org/:orgId/trainings/:id/attendance` |
| Search enrollees | `<input type="search">` | `aria-label="Search enrollees"` | Always | Client-side filter |
| QR Scanner | `<button>` | `aria-label="Open QR scanner for attendance"` | Device has camera | Opens camera modal |

### Role-Variant Matrix

| Element | Member | Officer | President |
|---------|--------|---------|-----------|
| View attendance list | hidden | visible | visible |
| Mark attendance | hidden | enabled | enabled |
| Confirm & Award | hidden | enabled | enabled |
| QR Scanner | hidden | enabled | enabled |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Table with inline checkboxes, summary sidebar |
| 768-1023px | Table with summary above |
| < 768px | Card list per enrollee with swipe actions |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton table rows | Initial fetch |
| Empty | "No enrollments for this training." | 0 enrollments |
| Success (Active) | Enrollment list with checkboxes enabled | Training status=completed, attendance not yet confirmed |
| Success (Locked) | Enrollment list with checkboxes disabled, "Attendance already confirmed" | Attendance already submitted |
| Refreshing | Subtle spinner | Refetch |
| Error | Alert "Unable to load attendance list." + retry | API error |
| PermissionError | Redirect with toast | Non-officer |
| Confirming | Dialog: "Award {creditAmount} credits to {count} attendees?" with list preview | Confirm & Award clicked |
| Mutating | Disabled button with spinner, "Submitting attendance..." | POST in flight |

### Validation

- At least 1 enrollee must be marked attended before Confirm & Award
- Cannot mark attendance for cancelled enrollments
- Training must be in completed status

### Edge Cases

- Training not yet completed: attendance screen shows "Training must be completed before marking attendance" with disabled controls
- Member enrolled but cancelled before training: row shown as greyed out, non-interactive
- QR scanner failure: fallback to manual search
- Real-time attendance count updates as checkboxes toggle

---

## Screen: My Training

**Route:** `/my/training`
**Purpose:** Member view of personal training history and certificates
**Workflow:** WF-059: Training Enrollment, WF-061: Certificate Generation

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "My Training" |
| `navigation` | `<nav>` | "Training tabs" |
| `main` | `<main>` | "Training list" |
| `region` | `<section>` | "Credits summary" |

### Focus Management

- Page load: focus on `<h1>`
- Tab switch: focus on first item in new tab panel
- After enrollment: toast "Enrolled in {title}", focus on enrolled training card

### Fields Displayed

| Field | Source | Notes |
|-------|--------|-------|
| title | training.title | -- |
| trainingType | training.trainingType | Badge |
| startDate | training.startDate | Formatted |
| status | enrollment.status | enrolled, completed, noShow |
| creditAmount | training.creditAmount | Only if creditBearing |
| certificateLink | certificate.id | Only if enrollment.status=completed |
| organizationName | training.organizationId -> org.name | Which org hosted |

### Tabs

| Tab | Content | aria-controls |
|-----|---------|---------------|
| Upcoming | Trainings with startDate > now, status=enrolled | "panel-upcoming" |
| Completed | Trainings with enrollment.status=completed | "panel-completed" |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| View Training | `<a>` on card | `aria-label="View training: {title}"` | Always | Navigate to training detail |
| Cancel Enrollment | `<button>` | `aria-label="Cancel enrollment for {title}"` | Upcoming + enrolled | Confirmation dialog |
| Download Certificate | `<a>` | `aria-label="Download certificate for {title}"` | Completed + certificate exists | `GET /my/certificates/:id/pdf` |
| Download Transcript | `<button>` | `aria-label="Download training transcript"` | Always | `GET /credits/transcript?format=pdf` |

### Role-Variant Matrix

All authenticated members see the same view. No role differentiation on this screen.

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Grid of training cards (3 columns), credits summary sidebar |
| 768-1023px | Grid (2 columns), credits summary above |
| < 768px | Single column card stack |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton cards (6) + skeleton summary | Initial fetch |
| Empty | Illustration + "No training history yet." + "Browse available trainings" link | 0 enrollments |
| Success | Training cards with tab navigation | Has enrollments |
| Refreshing | Pull-to-refresh indicator (mobile) / subtle header spinner | Background refetch |
| Error | Alert "Unable to load your training history." + retry | API error |
| PermissionError | N/A (all members can view) | -- |
| Downloading | Certificate button shows spinner, "Generating..." | PDF download in flight |
| TabEmpty | "No upcoming trainings." or "No completed trainings." in respective tab | Tab has 0 items |
| Offline | Banner + cached data shown | navigator.onLine === false |

### Edge Cases

- Training from a different org than member's primary: show org name badge
- Certificate not yet generated (training completed but attendance not confirmed): "Certificate pending" label
- Multi-org member: training from all orgs aggregated

---

## Screen: Certificate View

**Route:** `/my/certificates/[id]`
**Purpose:** View and download individual training certificate
**Workflow:** WF-061: Certificate Generation

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Certificate" |
| `main` | `<main>` | "Certificate details" |

### Focus Management

- Page load: focus on `<h1>` "Certificate"
- After download: toast "Certificate downloaded"

### Fields Displayed

| Field | Source | Notes |
|-------|--------|-------|
| certificateNumber | certificate.certificateNumber | Displayed prominently |
| memberName | person.name | Full name |
| trainingTitle | training.title | -- |
| trainingDate | training.startDate | Formatted |
| creditAmount | training.creditAmount | "X CPD Credits" |
| orgName | org.name | Issuing organization |
| qrCode | Generated | Links to `/verify/certificate/:certificateNumber` |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Download PDF | `<a>` | `aria-label="Download certificate PDF"` | Always | `GET /my/certificates/:id/pdf` |
| Share | `<button>` | `aria-label="Share certificate"` | Web Share API available | navigator.share() |
| Verify | `<a>` | `aria-label="Verify this certificate"` | Always | Links to public verify page |

### Role-Variant Matrix

Owner sees full certificate. Non-owner gets 404.

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 768px | Certificate preview (A4 ratio) centered, actions below |
| < 768px | Scrollable certificate preview, sticky download button |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton certificate placeholder | Fetching certificate data |
| Empty | N/A (404 if not found) | -- |
| Success | Certificate preview with QR code | Data loaded |
| Refreshing | N/A | -- |
| Error | "Unable to load certificate." + retry | API error |
| PermissionError | 404 page (no information leak) | Not the owner |
| Downloading | Download button spinner | PDF generation |
| NotFound | "Certificate not found." | Invalid certificate ID |
| Offline | "Certificate preview unavailable offline." + cached metadata if available | navigator.onLine === false |

### Edge Cases

- QR code links to public verification page -- works without authentication
- Certificate PDF includes HMAC-signed QR per BR-18
- First download triggers CredentialGenerated event and DocumentAccessLog entry
