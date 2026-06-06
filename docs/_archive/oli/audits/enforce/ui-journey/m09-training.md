# UI Journey Audit: Training (M09)

> **Audited:** 2026-05-27
> **Module:** m09-training
> **Spec refs:** MODULE_SPEC.md, API_CONTRACTS.md, WORKFLOW_MAP.md (WF-058..WF-064), ROLE_PERMISSION_MATRIX.md 3.5
> **Apps:** memberry (member + officer), admin (platform ops)
> **Finding IDs:** J-M09-001 through J-M09-048

---

## Scope

Frontend surfaces:
- **Memberry member:** `/my/training`, `/org/$orgSlug/training/` (browse), `/org/$orgSlug/training/$trainingId` (detail + enroll)
- **Memberry officer:** `/org/$orgSlug/officer/training/` (dashboard), `/officer/training/new` (create), `/officer/training/$trainingId` (detail/edit/attendance tab), `/officer/training/$trainingId/attendance` (standalone attendance)
- **Admin:** `/training/` (cross-org course overview)
- **Features:** `features/training/components/` (training-form, training-list, training-card, completion-table)

---

## R1 — Action Registry

Every interactive element mapped to its handler, API call, and feedback mechanism.

### R1.1 Training Create Flow (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 1 | officer/training/new | Type select (5 enums) | Select | `set('type', val)` | Client-only | SelectValue updates | WF-058, M9-R1 |
| 2 | officer/training/new | Title input | Input (controlled) | `field('title')` | Client-only | Controlled state update | WF-058 |
| 3 | officer/training/new | Description textarea | Textarea (controlled) | `field('description')` | Client-only | Controlled state update | WF-058 |
| 4 | officer/training/new | Start date/time picker | DateTimePicker | `set('startDate', ...)` | Client-only | ISO string update | WF-058 |
| 5 | officer/training/new | End date/time picker | DateTimePicker | `set('endDate', ...)` | Client-only | ISO string update | WF-058 |
| 6 | officer/training/new | Location input | Input | `field('location')` | Client-only | Controlled state update | WF-058 |
| 7 | officer/training/new | CPE Credit Amount input | Input (number) | `field('creditAmount')` | Client-only | min=0, step=0.5 | WF-058, BR-15 |
| 8 | officer/training/new | Capacity input | Input (number) | `field('capacity')` | Client-only | min=1, placeholder "Unlimited" | WF-058 |
| 9 | officer/training/new | Registration Fee input | Input (number) | `field('registrationFee')` | Client-only | PHP currency | WF-062, M9-R2 |
| 10 | officer/training/new | "Save Draft" button | Button (outline) | `saveMutation.mutate('draft')` | POST `/org/:orgId/trainings` | Disabled while pending, text "Saving...", navigate to detail on success, toast.error on failure | WF-058 |
| 11 | officer/training/new | "Publish" button | Button | `saveMutation.mutate('published')` | POST `/org/:orgId/trainings` | Disabled while pending, text "Publishing...", navigate to detail on success, toast.error on failure | WF-058 |
| 12 | officer/training/new | Inline error display | Span | Conditional render | Client-only | "Failed to save. Try again." text on error | -- |

### R1.2 Training Dashboard (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 13 | officer/training | "Create Training" link | Link (styled as button) | Navigate | None | Navigate to `/officer/training/new` | WF-058 |
| 14 | officer/training | Stat cards (Published/Drafts/Enrollments/CPE Credits) | Display (4 cards) | useQuery x2 | GET `/org/:orgId/trainings?status=published&limit=1`, GET `?status=draft&limit=1` | Static display from pagination totalCount + computed sums | WF-063 |
| 15 | officer/training | Status tab bar (Upcoming/Past/Drafts) | Button group | `setActiveTab()` | GET `/org/:orgId/trainings?status=` (published/completed/draft) | List re-renders with filtered results | WF-058 |
| 16 | officer/training | Search input | Input | `setSearch()` | GET with `?q=` param | Immediate list filter (no debounce) | WF-058 |
| 17 | officer/training | Type filter select | Select | `setTypeFilter()` | GET with `?type=` param | List filter (seminar/workshop/convention/online_course/skills_training) | WF-058 |
| 18 | officer/training | Training card title link | Anchor (`<a>`) | Navigate | None | Navigate to `/officer/training/:id` | WF-058 |
| 19 | officer/training | Card "Actions" menu button | Button (ghost, MoreHorizontal icon) | `setMenuOpen(toggle)` | Client-only | Popover menu opens/closes | WF-058 |
| 20 | officer/training | Menu > "Edit" link | Anchor | Navigate | None | Navigate to `/officer/training/:id` | WF-058 |
| 21 | officer/training | Menu > "Cancel" button | Button (ghost, destructive) | `onCancel?.(training.id)` -> opens ConfirmDialog | None (triggers dialog) | Closes menu, opens confirm dialog | WF-058 |
| 22 | officer/training | Menu > "Duplicate" button | Button (ghost) | `onDuplicate?.(training)` | Client-only | Closes menu, callback fires | WF-058 |
| 23 | officer/training | Cancel confirm dialog | ConfirmDialog (destructive) | `cancelMutation.mutate(...)` | PUT `/org/:orgId/trainings/:id/cancel` | Dialog closes, query invalidation on success, toast.error on failure | WF-058, M9-R5 |
| 24 | officer/training | Empty state "Create one" link | Link | Navigate | None | Navigate to `/officer/training/new` | WF-058 |
| 25 | officer/training | Error state | Div (role=alert, aria-live=polite) | Conditional render | None | Red error text "Failed to load trainings." | -- |
| 26 | officer/training | Loading skeleton | Div grid (6 pulse cards) | Conditional render | None | Animated pulse placeholders | -- |

### R1.3 Training Detail & Edit (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 27 | officer/training/$id | "Edit" button (PageHeader action) | Button (outline) | `setTab('edit')` | Client-only | Switches to edit tab | WF-058 |
| 28 | officer/training/$id | Tab: "Details" | Button | `setTab('details')` | Client-only | Shows detail view (description, sidebar with dates/location/enrollment) | WF-058 |
| 29 | officer/training/$id | Tab: "Attendance (N)" | Button | `setTab('attendance')` | Client-only | Shows CompletionTable component | WF-060 |
| 30 | officer/training/$id | Tab: "Edit" | Button | `setTab('edit')` | Client-only | Shows TrainingForm with initial data | WF-058 |
| 31 | officer/training/$id | Type badge | Span (display) | Static | None | Color-coded training type | -- |
| 32 | officer/training/$id | Status badge | Span (display) | Static | None | Color-coded status (draft/published/cancelled/pending_approval) | -- |
| 33 | officer/training/$id | CPE badge | Span (display, conditional) | Static | None | Shows if creditAmount > 0 | BR-15 |
| 34 | officer/training/$id | Loading skeleton | ListSkeleton | Conditional render | None | Header pulse + 4 row skeleton | -- |
| 35 | officer/training/$id | Error state | Div | Conditional render | None | "Failed to load training." in error color | -- |

### R1.4 Attendance & Completion (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 36 | officer/training/$id (attendance tab) | Select-all checkbox | Checkbox | `toggleAll()` | Client-only | Toggles all enrollment personIds in selection set | WF-060 |
| 37 | officer/training/$id (attendance tab) | Per-row checkbox | Checkbox | `toggleOne(personId)` | Client-only | Toggles individual enrollment in selection set | WF-060 |
| 38 | officer/training/$id (attendance tab) | "Mark Complete" button (per-row) | Button (outline, sm) | `markMutation.mutate(...)` | POST complete endpoint | Optimistic UI: completedAt set immediately, text "Marking..." while pending, rollback on error | WF-060, BR-13 |
| 39 | officer/training/$id (attendance tab) | "Mark All Complete" button (bulk bar) | Button | forEach `markMutation.mutate(...)` | POST complete per person | Optimistic UI per person, bulk bar shows selected count, "Marking..." text while pending | WF-060, BR-13, M9-R7 |
| 40 | officer/training/$id (attendance tab) | "Clear" selection button | Button (ghost, sm) | `setSelected(new Set())` | Client-only | Clears selection, hides bulk bar | -- |
| 41 | officer/training/$id (attendance tab) | Stats strip (Enrolled/Completed/Credits Awarded) | Display (3 cards) | Computed from enrollments | None | Static counts | WF-063 |
| 42 | officer/training/$id (attendance tab) | Enrollment status badge | Span (per row) | Static | None | enrolled (green) / waitlisted (yellow) / other (gray) | -- |
| 43 | officer/training/$id (attendance tab) | Completion indicator | Span/text (per row) | Static | None | CheckCircle + date if completed, "Pending" text otherwise | WF-060 |
| 44 | officer/training/$id (attendance tab) | Credits column | Text (per row) | Static | None | Shows "{creditAmount} CPE" if completed, "—" otherwise | BR-13 |
| 45 | officer/training/$id (attendance tab) | Empty state | TableCell colspan=6 | Conditional render | None | "No enrollments yet. Enrollment data will appear here once members sign up." | -- |
| 46 | officer/training/$id (attendance tab) | Loading state | TableCell colspan=6 | Conditional render | None | "Loading..." text | -- |

### R1.5 Standalone Attendance Page (Officer)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 47 | officer/training/$id/attendance | Present counter | GlassCard (PageHeader action) | Computed | None | "{presentCount} / {total} present" with UserCheck icon | WF-060 |
| 48 | officer/training/$id/attendance | Per-enrollment checkbox | Checkbox | `checkInMutation.mutate(memberId)` | POST check-in endpoint | Disabled when already present or pending | WF-060, BR-17 |
| 49 | officer/training/$id/attendance | "Mark Present" button (per row) | Button (outline, sm) | `checkInMutation.mutate(memberId)` | POST check-in endpoint | Loader2 spinner while pending for that member, toast.success on success | WF-060, BR-17 |
| 50 | officer/training/$id/attendance | "Present" badge | Span (success color) | Static | None | UserCheck icon + "Present" text | WF-060 |
| 51 | officer/training/$id/attendance | Duplicate check-in handling | onError callback | BR-17 idempotent | None | toast.warning "Already checked in" if message contains "already", else toast.error | WF-060, M9-R7 |
| 52 | officer/training/$id/attendance | Empty state | EmptyState pattern | Conditional render | None | Users icon + "No enrollments yet" | -- |
| 53 | officer/training/$id/attendance | Error state | Div | Conditional render | None | "Failed to load enrollments." in error color | -- |
| 54 | officer/training/$id/attendance | Loading skeleton | ListSkeleton (5 rows) | Conditional render | None | Skeleton loader | -- |

### R1.6 Member Training Browse & Enroll

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 55 | org/$orgSlug/training | Training card link | Link (TanStack) | Navigate | None | Navigate to `/org/$orgSlug/training/$trainingId` | WF-059 |
| 56 | org/$orgSlug/training | CPE badge (per card) | Span (conditional) | Static | None | Shows if creditAmount > 0 | BR-15 |
| 57 | org/$orgSlug/training | Instructor display | Paragraph (conditional) | Static | None | "Instructor: {name}" if present | WF-058 |
| 58 | org/$orgSlug/training | Empty state | EmptyState pattern | Conditional render | None | BookOpen icon + "No training sessions available" | -- |
| 59 | org/$orgSlug/training | Loading skeleton | CardSkeleton (4 cards) | Conditional render | None | Skeleton cards grid | -- |
| 60 | org/$orgSlug/training/$id | "Enroll" button | Button (size=lg) | `enrollMutation.mutate()` | POST `/org/:orgId/trainings/:id/enroll` | Loader2 spinner while pending, disabled during mutation, toast.success on success, toast.error on failure | WF-059 |
| 61 | org/$orgSlug/training/$id | Enrolled state display | GlassCard | Conditional render | None | "You are enrolled in this training." text | WF-059 |
| 62 | org/$orgSlug/training/$id | Status badge | Span (PageHeader action) | Static | None | Green badge with status text | -- |
| 63 | org/$orgSlug/training/$id | Type badge | Span (PageHeader action) | Static | None | Muted badge with capitalized type | -- |
| 64 | org/$orgSlug/training/$id | Credit hours display | CountUp animation | Static | None | "{creditAmount} CPE" with primary color | BR-15 |
| 65 | org/$orgSlug/training/$id | Fee display (conditional) | Display | Static | None | "PHP {amount}" if fee > 0 | WF-062 |
| 66 | org/$orgSlug/training/$id | Provider display (conditional) | Display | Static | None | BookOpen icon + provider name | WF-064 |
| 67 | org/$orgSlug/training/$id | Loading skeleton | CardSkeleton x2 | Conditional render | None | Skeleton cards | -- |
| 68 | org/$orgSlug/training/$id | Error state | GlassCard | Conditional render | None | "Failed to load training details." | -- |

### R1.7 My Training (Member Dashboard)

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 69 | /my/training | Stat cards (Enrolled/Pending/CPE Credits/Completed) | StaggerGrid (4 cards) | Computed from items | None | CountUp animations, icons with colored backgrounds | WF-063 |
| 70 | /my/training | Training table | Table (6 columns) | useQuery | GET `/my/trainings` | Training title, type, date, credits badge, enrollment status badge, training status badge | WF-059 |
| 71 | /my/training | Enrollment status badge (per row) | Span | Static | None | Color-coded: enrolled/pending_approval/pending_payment/waitlisted/rejected/cancelled | -- |
| 72 | /my/training | Training status badge (per row) | Span | Static | None | Color-coded: draft/published/cancelled/pending_approval | -- |
| 73 | /my/training | CPE credit badge (per row, conditional) | Span | Static | None | Award icon + "{amount} CPE" if > 0, "—" otherwise | BR-15 |
| 74 | /my/training | Empty state | EmptyState pattern | Conditional render | None | BookOpen icon + "No training sessions yet" + "Browse available trainings..." description | -- |
| 75 | /my/training | Loading skeleton | CardSkeleton x3 | Conditional render | None | Three skeleton cards | -- |
| 76 | /my/training | "Available Trainings" section (network-wide) | StaggerGrid (up to 6 cards) | useQuery (searchTrainings status=published) | GET `/org/:orgId/trainings?status=published` | Cards with title, type, date, CPE badge; shown only when results exist | WF-059, M9-R6 |

### R1.8 Admin Training Overview

| # | Screen | Element | Type | Handler | API Call | Feedback | Spec Ref |
|---|--------|---------|------|---------|----------|----------|----------|
| 77 | admin/training | Search input | Input | `setSearch()` | GET `/courses?q=` (debounced at 2 chars) | Filtered course list | WF-063 |
| 78 | admin/training | Course table | Table (7 columns) | useQuery | GET `/courses?limit=25&offset=` | Course, Organization, Provider, Status, Enrolled, Credits, Date | WF-063 |
| 79 | admin/training | Status badge (per row) | Span | Static | None | active (green) / completed (blue) / other (gray) | -- |
| 80 | admin/training | "Previous" pagination button | Button (outline, sm) | `setPage(p-1)` | GET with offset | Disabled on page 0 | -- |
| 81 | admin/training | "Next" pagination button | Button (outline, sm) | `setPage(p+1)` | GET with offset | Disabled when !hasMore | -- |
| 82 | admin/training | Page indicator | Span | Static | None | "Page {N}" text | -- |
| 83 | admin/training | Empty state (no courses) | TableCell colspan=7 | Conditional render | None | GraduationCap icon + "No courses found" + search hint | -- |
| 84 | admin/training | Loading state | TableCell colspan=7 | Conditional render | None | "Loading courses..." with pulse animation | -- |
| 85 | admin/training | Error state | Div (red border/bg) | Conditional render | None | Red banner with error message | -- |
| 86 | admin/training | Role gate | RequireRole wrapper | `allowed={['super','support','analyst']}` | Client-only | Blocks non-authorized users | ROLE_PERMISSION_MATRIX 3.5 |
| 87 | admin/training | Summary text | Paragraph | Conditional render | None | "Showing N-M courses" or "No courses" | -- |

---

## R2 — Journey Completion Registry

End-to-end user journeys traced through the UI.

### J-M09-001: Officer creates and publishes a training session

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | officer/training | Click "Create Training" | Link (#13) | Navigate to `/officer/training/new` | WF-058 |
| 2 | officer/training/new | Select training type | Select (#1) | Type enum set | WF-058, M9-R1 |
| 3 | officer/training/new | Fill title | Input (#2) | Title set | WF-058 |
| 4 | officer/training/new | Fill description | Textarea (#3) | Description set | WF-058 |
| 5 | officer/training/new | Set start date/time | DateTimePicker (#4) | Start date set | WF-058 |
| 6 | officer/training/new | Set location | Input (#6) | Location set | WF-058 |
| 7 | officer/training/new | Set credit amount | Input (#7) | Credit value set | WF-058, BR-15 |
| 8 | officer/training/new | Click "Publish" | Button (#11) | POST creates training, navigate to detail | WF-058 |
| **VERDICT** | **PASS with gaps** | Journey completes. Publish calls saveMutation with 'published' status but does NOT call separate PUT .../publish endpoint. Status is passed in the create body, not as a separate publish action. See J-M09-020. ||

### J-M09-002: Officer saves training as draft then publishes later

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | officer/training/new | Fill form + click "Save Draft" | Button (#10) | POST creates draft, navigate to detail | WF-058 |
| 2 | officer/training/$id | Click "Edit" button | Button (#27) | Switch to edit tab | WF-058 |
| 3 | officer/training/$id (edit tab) | Modify fields if needed | TrainingForm | Client state update | WF-058 |
| 4 | officer/training/$id (edit tab) | Click "Publish" | Button (#11 in embedded form) | PUT updates training | WF-058 |
| **VERDICT** | **FAIL** | No separate "Publish" action on the detail page. TrainingForm always calls create or update — never calls `PUT .../publish`. A draft training cannot be published from the detail view unless the form's saveMutation is invoked with 'published', but the form does NOT set status in the update payload. See J-M09-021. ||

### J-M09-003: Member browses and enrolls in a training

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | org/$orgSlug/training | View published trainings | StaggerGrid | Cards display with title/type/date/credits | WF-059 |
| 2 | org/$orgSlug/training | Click training card | Link (#55) | Navigate to training detail | WF-059 |
| 3 | org/$orgSlug/training/$id | Review details (dates, credits, fee, provider) | Display elements | All info visible | WF-059 |
| 4 | org/$orgSlug/training/$id | Click "Enroll" | Button (#60) | POST enroll, toast success, enrolled state shown | WF-059 |
| **VERDICT** | **PASS** | Full enrollment journey works end-to-end. ||

### J-M09-004: Officer marks attendance and awards credits

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | officer/training/$id | Click "Attendance" tab | Button (#29) | CompletionTable renders | WF-060 |
| 2 | officer/training/$id (attendance) | Review enrollment list | Table | Enrolled members with status | WF-060 |
| 3 | officer/training/$id (attendance) | Click "Mark Complete" for member | Button (#38) | POST complete, optimistic UI, credits column updates | WF-060, BR-13 |
| **VERDICT** | **PASS** | Attendance marking and credit award works via CompletionTable. ||

### J-M09-005: Officer bulk-marks attendance

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | officer/training/$id (attendance) | Check select-all | Checkbox (#36) | All enrollments selected | WF-060 |
| 2 | officer/training/$id (attendance) | Click "Mark All Complete" | Button (#39) | Per-person mutations fire, optimistic UI | WF-060 |
| **VERDICT** | **PASS with note** | Works but fires N individual mutations (one per person). No bulk API endpoint used. Performance concern for large enrollments. ||

### J-M09-006: Officer uses standalone attendance page for check-in

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | officer/training/$id/attendance | View enrollment list | List | Members with checkbox + "Mark Present" button | WF-060 |
| 2 | officer/training/$id/attendance | Click "Mark Present" | Button (#49) | POST check-in, toast success, badge changes to "Present" | WF-060, BR-17 |
| 3 | officer/training/$id/attendance | Attempt duplicate check-in | Button (#49) | toast.warning "Already checked in" (BR-17 idempotent) | M9-R7 |
| **VERDICT** | **PASS** | Check-in with duplicate handling works correctly. ||

### J-M09-007: Member views training history and credits

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | /my/training | View stat cards | StaggerGrid (#69) | Enrolled/Pending/CPE Credits/Completed counts | WF-063 |
| 2 | /my/training | Review training table | Table (#70) | Title, type, date, credits, enrollment status, training status | WF-059 |
| **VERDICT** | **PASS** | Dashboard shows comprehensive training history. ||

### J-M09-008: Officer cancels a training

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | officer/training | Open card actions menu | Button (#19) | Menu opens | WF-058 |
| 2 | officer/training | Click "Cancel" | Button (#21) | ConfirmDialog opens | WF-058 |
| 3 | officer/training | Confirm cancellation | ConfirmDialog (#23) | PUT cancel, query invalidation | WF-058, M9-R5 |
| **VERDICT** | **PASS** | Cancellation with confirmation dialog works. ||

### J-M09-009: Admin views cross-org training overview

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | admin/training | View course table | Table (#78) | All courses across orgs | WF-063 |
| 2 | admin/training | Search courses | Input (#77) | Filtered results | WF-063 |
| 3 | admin/training | Paginate | Buttons (#80, #81) | Next/previous pages | -- |
| **VERDICT** | **PASS** | Admin read-only overview functional. ||

### J-M09-010: Member discovers network-wide trainings

| Step | Screen | Action | Element | Result | Spec Ref |
|------|--------|--------|---------|--------|----------|
| 1 | /my/training | Scroll to "Available Trainings" | Section (#76) | Network-wide published trainings shown (up to 6) | WF-059, M9-R6 |
| **VERDICT** | **PASS with gap** | Cards shown but NOT clickable. No `Link` or `onClick` on available training cards. Member cannot navigate to enroll from here. See J-M09-022. ||

---

## R3 — Dead Interaction Registry

Elements that exist in code but lead nowhere or have no effect.

| ID | Screen | Element | Issue | Severity | Spec Ref |
|----|--------|---------|-------|----------|----------|
| J-M09-020 | officer/training/new | "Publish" button | Calls `saveMutation.mutate('published')` but the mutation ignores the `status` parameter — payload sent to POST does not include status field. Training always created as whatever the API default is (likely draft). The 'published' string parameter to `mutate()` is received by `mutationFn` as `status` but never used in the payload object. | **P1-BLOCKER** | WF-058 |
| J-M09-021 | officer/training/$id (edit tab) | TrainingForm "Publish" button | Same issue as J-M09-020 — in edit mode calls `updateMut.mutateAsync()` with same payload that omits status. Cannot publish from edit tab. No separate publish endpoint called. | **P1-BLOCKER** | WF-058 |
| J-M09-022 | /my/training | Available Trainings cards | Cards render training info but are NOT wrapped in `<Link>`. No `onClick`, no navigation. Member sees trainings but cannot click through to detail/enroll. Dead display. | **P2-HIGH** | WF-059 |
| J-M09-023 | officer/training card | "Duplicate" menu action | Calls `onDuplicate?.(training)` but the parent `TrainingList` component never passes an `onDuplicate` prop to `TrainingCard`. Callback is always `undefined`. Button renders but does nothing. | **P2-HIGH** | -- |
| J-M09-024 | officer/training | TrainingCard title link | Uses raw `<a href=...>` instead of TanStack Router `<Link>`. Causes full page reload on navigation instead of SPA transition. | **P3-LOW** | -- |
| J-M09-025 | officer/training card | "Edit" menu link | Same as J-M09-024 — raw `<a>` tag causing full reload. | **P3-LOW** | -- |

---

## R4 — Missing Interaction Registry

Interactions required by spec but not implemented in UI.

| ID | Spec Requirement | Expected Screen | Expected Element | Status | Severity | Spec Ref |
|----|-----------------|-----------------|------------------|--------|----------|----------|
| J-M09-026 | Publish draft training | officer/training/$id | "Publish" button (conditional, status=draft) | **MISSING** — No dedicated publish action on detail page. Form save does not set status. | **P1-BLOCKER** | WF-058, API: PUT `/trainings/:id/publish` |
| J-M09-027 | Complete training | officer/training/$id | "Mark Complete" button (conditional, status=published) | **MISSING** — No UI to mark a training as completed. API endpoint exists: PUT `/trainings/:id/complete`. | **P1-BLOCKER** | WF-058, API: PUT `/trainings/:id/complete` |
| J-M09-028 | Certificate view/download | /my/certificates/$id | Certificate preview + PDF download button | **MISSING** — No `/my/certificates` route exists in the codebase. Spec requires certificate preview with member name, training title, date, credits, QR code, and PDF download. | **P1-BLOCKER** | WF-061, BR-20, M9-R4 |
| J-M09-029 | Public certificate verification | /verify/certificate/:number | Verification page with certificate details | **MISSING** — No public verification route. Spec requires public endpoint showing certificate validity. | **P2-HIGH** | WF-061, API: GET `/verify/certificate/:number` |
| J-M09-030 | QR scanner for attendance | officer/training/$id/attendance | "Open QR scanner" button | **MISSING** — Spec requires camera-based QR scan for large venue check-in. Only manual checkbox check-in exists. | **P2-HIGH** | WF-060, BR-17 |
| J-M09-031 | Accredited Provider CRUD | officer/training/providers | Provider list + create/update/delete | **MISSING** — No UI for managing accredited providers. API endpoints exist (GET/POST/PUT/DELETE `/org/:orgId/training/providers`). | **P2-HIGH** | WF-064, ROLE_PERMISSION_MATRIX 3.5 |
| J-M09-032 | Training visibility toggle | officer/training/new (form) | Network/Internal visibility selector | **MISSING** — Spec requires defaulting to network-wide with internal override. TrainingForm has no visibility field. | **P2-HIGH** | WF-058, M9-R6 |
| J-M09-033 | Non-credit-bearing flag | officer/training/new (form) | `isNonCreditBearing` toggle | **MISSING** — Spec allows creditValue=0 when flag is true (orientations/workshops). Form has no such toggle. | **P2-HIGH** | BR-15 |
| J-M09-034 | Instructor name/id field | officer/training/new (form) | Instructor input | **MISSING** — Spec requires instructor name/id. Not in TrainingForm. Shown in browse cards (`t.instructor`) but never set. | **P2-HIGH** | WF-058 |
| J-M09-035 | Paid training enrollment flow | org/$orgSlug/training/$id | Payment redirect for paid trainings | **MISSING** — Fee is displayed but enrollment button does not redirect to M06 payment flow when fee > 0. | **P2-HIGH** | WF-062, M9-R2 |
| J-M09-036 | Course CRUD management | officer/training/courses | Course list + create/edit | **MISSING** — API has GET/POST `/org/:orgId/courses`. No UI exists. | **P2-HIGH** | API_CONTRACTS 2.7 |
| J-M09-037 | Training analytics dashboard | officer/training (analytics) | Completion rates, revenue reporting | **MISSING** — Stat cards show basic counts but no dedicated analytics view per spec. | **P3-LOW** | WF-063 |
| J-M09-038 | Filter by status in spec (officer) | officer/training | Status dropdown filter | **PARTIAL** — Tab bar provides status filtering but spec also lists a `<select>` filter. Tab bar is arguably sufficient. | **P3-LOW** | WF-058 |
| J-M09-039 | Enrollment cancellation (member) | org/$orgSlug/training/$id | "Cancel Enrollment" button | **MISSING** — Member can enroll but cannot cancel enrollment. Enrolled state shows static text only. | **P2-HIGH** | WF-059 |
| J-M09-040 | Certificate link from My Training | /my/training | Certificate download link per completed training | **MISSING** — Table shows training status but no link to download certificate for completed trainings. | **P2-HIGH** | WF-061 |

---

## R5 — State Coverage Registry

UI states per screen compared to spec requirements.

| Screen | Loading | Empty | Error | Success | Validation Error | Permission Error | Mutating | Confirm Action | Offline |
|--------|---------|-------|-------|---------|------------------|------------------|----------|---------------|---------|
| officer/training (dashboard) | Skeleton grid | "No trainings found. Create one" | role=alert with error text | Training cards grid | N/A | N/A | N/A | Cancel confirm dialog | **MISSING** |
| officer/training/new | N/A (no data load) | Clean form | Inline "Failed to save" text | Navigate to detail | **MISSING** (no Zod/inline validation) | **MISSING** (no role check in form) | Disabled buttons + "Saving.../Publishing..." text | **MISSING** (no publish confirmation dialog) | **MISSING** |
| officer/training/$id | Skeleton (header + rows) | N/A | "Failed to load training." | Detail/edit/attendance tabs | N/A | N/A | N/A | N/A | **MISSING** |
| officer/training/$id/attendance | ListSkeleton (5 rows) | EmptyState "No enrollments yet" | "Failed to load enrollments." | Enrollment list with checkboxes | N/A | N/A | Spinner per check-in button | N/A | **MISSING** |
| org/$orgSlug/training (browse) | CardSkeleton x4 | EmptyState "No training sessions available" | N/A (**MISSING**) | Training cards grid | N/A | N/A | N/A | N/A | **MISSING** |
| org/$orgSlug/training/$id (detail) | CardSkeleton x2 | N/A | "Failed to load training details." GlassCard | Details + Enroll button | N/A | N/A | Enroll button disabled + Loader2 spinner | N/A | **MISSING** |
| /my/training | CardSkeleton x3 | EmptyState "No training sessions yet" | Collapsed into empty state (`error || items.length === 0`) | Stats + table + available trainings | N/A | N/A | N/A | N/A | **MISSING** |
| admin/training | "Loading courses..." pulse cell | "No courses found" + icon | Red bordered error banner | Course table with pagination | N/A | RequireRole gate blocks | N/A | N/A | **MISSING** |

### State findings:

| ID | Screen | Missing State | Severity | Notes |
|----|--------|--------------|----------|-------|
| J-M09-041 | officer/training/new | ValidationError | **P2-HIGH** | No Zod schema or inline validation. Title and startDate are required (disabled button only) but no field-level error messages. Spec requires "Inline errors below fields, red borders, aria-invalid" |
| J-M09-042 | officer/training/new | ConfirmAction (publish) | **P2-HIGH** | Spec requires confirmation dialog: "Publish this training? Members will be notified." Currently publishes without confirmation. |
| J-M09-043 | officer/training/new | PermissionError | **P3-LOW** | No route-level role check. Non-officers can access the form URL directly. |
| J-M09-044 | org/$orgSlug/training | Error state | **P3-LOW** | Browse page does not handle query error. If API fails, page shows nothing (no error state). |
| J-M09-045 | /my/training | Error vs Empty conflation | **P3-LOW** | `error || items.length === 0` shows empty state for BOTH error and empty. Error should show error message, not "No training sessions yet". |
| J-M09-046 | All screens | Offline state | **P3-LOW** | No offline detection on any training screen. Spec requires "Save button disabled, banner 'You're offline'" |

---

## R6 — Spec-to-Code Traceability

| Spec Artifact | Ref | Implemented | Finding ID |
|---------------|-----|-------------|------------|
| WF-058: Create & Publish Training | MODULE_SPEC 4 | **PARTIAL** — Create works, publish mechanism broken (status not sent in payload) | J-M09-020, J-M09-021, J-M09-026 |
| WF-059: Manage Enrollments | MODULE_SPEC 4 | **PARTIAL** — Enroll works, no cancel enrollment, no paid flow | J-M09-035, J-M09-039 |
| WF-060: Confirm Attendance & Award Credits | MODULE_SPEC 4 | **PASS** — Two attendance UIs (CompletionTable + standalone). Check-in and completion both work. | -- |
| WF-061: Certificate Generation | MODULE_SPEC 4 | **MISSING** — No certificate view, download, or verification UI | J-M09-028, J-M09-029, J-M09-040 |
| WF-062: Paid Training | MODULE_SPEC 4 | **MISSING** — Fee displayed but no M06 payment integration | J-M09-035 |
| WF-063: Training Analytics | MODULE_SPEC 4 | **PARTIAL** — Basic stat cards exist, no dedicated analytics | J-M09-037 |
| WF-064: Manage Accredited Providers | MODULE_SPEC 4 | **MISSING** — No provider management UI | J-M09-031 |
| BR-13: Auto-credit on attendance | MODULE_SPEC 5 | **PASS** — CompletionTable fires complete mutation per member | -- |
| BR-15: Training credit-bearing vs events | MODULE_SPEC 5 | **PARTIAL** — No isNonCreditBearing toggle | J-M09-033 |
| BR-17: Officer-only check-in | MODULE_SPEC 5 | **PASS** — Attendance pages are under officer routes | -- |
| BR-20: Certificate with HMAC-signed QR | MODULE_SPEC 5 | **MISSING** — No certificate UI | J-M09-028 |
| M9-R1: 5 platform-defined types | MODULE_SPEC 5 | **PASS** — Select has 5 enum values matching spec | -- |
| M9-R2: Paid training requires payment | MODULE_SPEC 5 | **MISSING** — No payment gate on enrollment | J-M09-035 |
| M9-R4: HMAC-signed QR | MODULE_SPEC 5 | **MISSING** — No certificate UI | J-M09-028 |
| M9-R5: Cancellation refund | MODULE_SPEC 5 | **PARTIAL** — Cancel action exists but no visible refund feedback | J-M09-023 (cancel works, refund is backend-only) |
| M9-R6: Network-wide visibility default | MODULE_SPEC 5 | **MISSING** — No visibility control in form | J-M09-032 |
| M9-R7: Idempotent credits | MODULE_SPEC 5 | **PASS** — Duplicate check-in shows warning toast | -- |
| API: PUT `/trainings/:id/publish` | API_CONTRACTS 2.1 | **NOT CALLED** — Endpoint exists in API contracts but no UI calls it | J-M09-026 |
| API: PUT `/trainings/:id/complete` | API_CONTRACTS 2.1 | **NOT CALLED** — Endpoint exists in API contracts but no UI calls it | J-M09-027 |
| API: GET `/my/certificates/:id/pdf` | API_CONTRACTS 2.5 | **NOT CALLED** — No certificate UI | J-M09-028 |
| API: GET `/verify/certificate/:number` | API_CONTRACTS 2.5 | **NOT CALLED** — No verification UI | J-M09-029 |
| API: CRUD `/training/providers` | API_CONTRACTS 2.6 | **NOT CALLED** — No provider UI | J-M09-031 |
| API: CRUD `/courses` | API_CONTRACTS 2.7 | **PARTIAL** — Admin uses `searchCourses` for read. No create/update UI. | J-M09-036 |
| ROLE_PERMISSION_MATRIX 3.5 | Matrix | **PARTIAL** — Officer routes exist under `/officer/`, admin route has RequireRole. But officer routes lack explicit role gate components. | J-M09-043 |

---

## Summary

### Severity Counts

| Severity | Count | Finding IDs |
|----------|-------|-------------|
| P1-BLOCKER | 3 | J-M09-020, J-M09-021 (publish broken), J-M09-026 (no publish action), J-M09-027 (no complete action), J-M09-028 (no certificates) |
| P2-HIGH | 12 | J-M09-022, J-M09-023, J-M09-029, J-M09-030, J-M09-031, J-M09-032, J-M09-033, J-M09-034, J-M09-035, J-M09-036, J-M09-039, J-M09-040, J-M09-041, J-M09-042 |
| P3-LOW | 7 | J-M09-024, J-M09-025, J-M09-037, J-M09-038, J-M09-043, J-M09-044, J-M09-045, J-M09-046 |

### Critical Path Blockers

1. **Publish is broken** (J-M09-020/021/026): `saveMutation` receives a `status` parameter but the `mutationFn` payload never includes it. The `status` param from `mutate('draft')` or `mutate('published')` is the argument to `mutationFn` but the constructed `payload` object does not set `status`. No code path calls the `PUT .../publish` endpoint. All trainings are created/updated without explicit status.

2. **Cannot complete a training** (J-M09-027): The entire completion lifecycle is missing from UI. API has `PUT /trainings/:id/complete` but no button or action triggers it. Without completing a training, the post-completion lock (M9-R3) cannot be enforced.

3. **Certificate system entirely absent** (J-M09-028/029/040): No routes, no components, no links to certificates. This is a P0 workflow (WF-061) with zero frontend coverage.

### Architecture Notes

- Two parallel attendance UIs exist: `CompletionTable` (embedded in officer detail tabs) and standalone `/attendance` page. Different APIs: CompletionTable uses `completeCustomTrainingMutation`, standalone uses `checkInCustomTrainingMutation`. Potentially confusing for officers.
- Available trainings on `/my/training` are display-only — cards cannot be clicked. Member must separately navigate to `/org/$orgSlug/training` to browse and enroll.
- Training form uses controlled state (`useState`) instead of `react-hook-form`, unlike other module forms. No Zod validation schema.
