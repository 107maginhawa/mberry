<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Screens: Job Board (M15)

## Blueprint Purpose

This UI Blueprint provides comprehensive UI specification for the Job Board module.

Based on:
- Module Spec: docs/product/modules/m15-job-board/MODULE_SPEC.md
- Domain Glossary: docs/product/DOMAIN_GLOSSARY.md
- Role Permission Matrix: docs/product/ROLE_PERMISSION_MATRIX.md
- API Contracts: docs/product/modules/m15-job-board/API_CONTRACTS.md

**This blueprint is not the source of product truth.** Final implementation must follow the PRD, module spec, slice spec, test plan, and architecture.

---

## Screen: Job Board

**Purpose:** Browse, search, and filter job listings
**Route:** `/org/[id]/jobs`
**Primary Users/Roles:** Active members (browse, save, apply), Officers (post), Grace/Lapsed (read-only)
**Related Workflow:** WF-087 (Browse & Save Jobs), WF-091 (Job Alerts)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Job Board

### ARIA Landmark Structure

```
<header role="banner">              -- app header, breadcrumb
<nav role="navigation">             -- primary nav, org tabs
<main role="main">
  <section aria-label="Job search">           -- search bar
  <section aria-label="Job filters">          -- filter chips (type, specialty, location)
  <section aria-label="Job listings">         -- listing cards grid/list
    <article aria-label="{jobTitle} at {employer}">  -- each job card
  <aside role="complementary">                -- saved jobs link, job alerts CTA
<footer role="contentinfo">         -- pagination controls
```

### Focus Management

- **Initial focus on load:** Search bar input
- **Focus after bookmark action:** Remain on current card (toggle state)
- **Focus after filter change:** First result in filtered list
- **Focus after apply:** Application form first field (on detail screen)
- **Focus trap:** None (standard page)
- **Skip link:** "Skip to job listings"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Job title | Yes | data.title | Card heading |
| Organization/employer name | Yes | data.organizationName | Denormalized for display |
| Job type | Yes | data.type | Badge: full_time, part_time, contract, fellowship, internship |
| Location | Yes | data.location | City/region text |
| Specialty | No | data.specialty | Badge if present |
| Salary range | No | data.salary | Shown if provided |
| Posted date | Yes | data.postedAt | Relative time |
| Expires date | Yes | data.expiresAt | "Expires in X days" warning if < 7 days |
| Bookmark status | Yes | data.isBookmarked | Filled/outline bookmark icon |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Search | Text search across job listings | All authenticated | Ctrl+K (focus search) |
| Filter by type | Filter chips for job type enum | All authenticated | -- |
| Filter by specialty | Filter by medical specialty | All authenticated | -- |
| Filter by location | Filter by city/region | All authenticated | -- |
| Bookmark/unbookmark | Toggle job save | Active members only (M15-R1) | -- |
| View detail | Navigate to job detail page | All authenticated | Enter on card |
| Post a job | Navigate to create job form | Officers, verified employers | -- |
| Manage alerts | View/create job alert preferences | Active members | -- |
| Paginate | Next/previous page | All | -- |

### Role-Variant Matrix

| UI Element | Platform Admin | Officer (Secretary) | Active Member | Grace/Lapsed Member | External Employer |
|---|---|---|---|---|---|
| Job listing cards | visible | visible | visible | visible (read-only) | visible |
| Search & filters | visible | visible | visible | visible | visible |
| Bookmark button | visible | visible | visible | disabled + tooltip | hidden |
| "Post a Job" button | visible | visible | hidden | hidden | visible (own listings) |
| Job alerts link | visible | visible | visible | disabled | hidden |
| Pagination | visible | visible | visible | visible | visible |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Grid layout (2-3 columns), sidebar with filters |
| Tablet (768-1024px) | Two-column grid, filters in collapsible drawer |
| Mobile (<768px) | Single column list, filters in bottom sheet, sticky search bar |

### Layout Notes
- Search bar is prominent at top with placeholder "Search jobs by title, employer, or keyword..."
- Filter chips are horizontal scrollable on mobile
- Job cards show key info at a glance; click for full detail
- Expiring listings (<7 days) show orange "Expiring soon" badge
- Filled/closed listings not shown in default view

### States

- **Default:** Paginated job listing grid, active listings, newest first
- **Loading:** Skeleton job cards (6-8) matching card layout dimensions
- **Empty:** "No job listings available." Officers see "Post the first job listing" CTA. Members see "Check back soon for new opportunities."
- **Success:** After bookmark — brief icon animation, no toast (inline feedback). After alert creation — sonner toast "Job alert created"
- **Validation Error:** N/A (read-only listing view)
- **Permission Error:** Grace/Lapsed: bookmark button disabled, tooltip "Active membership required to save jobs" (M15-R1)
- **Unexpected Error:** "Unable to load job listings. Please try again." with retry button
- **Conflict/Duplicate Warning:** Bookmark already exists (CONFLICT-002): icon already filled, no action
- **Offline/Sync:** "You're offline. Showing cached listings." with stale data indicator

### Validation Behavior
- Search: debounced (300ms), minimum 2 characters
- Filters: client-side, instant application

### Permission-Based UI Behavior
- Grace/Lapsed members (M15-R1): read-only access, cannot save or apply
- Officers: see "Post a Job" button
- External employers: see "Post a Job" for own listings only

### Edge Cases
- No listings match filters: "No jobs match your criteria. Try different filters." with "Clear filters" link
- Listing expired while viewing: card shows "Expired" badge, apply button disabled
- External employer listings in pendingReview: not shown to members, visible to admin

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.

---

## Screen: Job Detail

**Purpose:** View full job listing and apply
**Route:** `/org/[id]/jobs/[jobId]`
**Primary Users/Roles:** Active members (view + apply), Grace/Lapsed (view only)
**Related Workflow:** WF-087 (Browse & Save Jobs)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Job Detail

### ARIA Landmark Structure

```
<header role="banner">              -- app header, breadcrumb: Jobs > {Job Title}
<nav role="navigation">             -- primary nav, back to job board
<main role="main">
  <section aria-label="Job overview">         -- title, employer, type, location, salary
  <section aria-label="Job description">      -- full description, requirements
  <section aria-label="Employer information">  -- employer details
  <section aria-label="Application">          -- apply form or external link
  <aside role="complementary">                -- bookmark button, share, similar jobs
<footer role="contentinfo">         -- posted date, expiry date
```

### Focus Management

- **Initial focus on load:** Job title heading (h1)
- **Focus after apply submission:** Success message or error
- **Focus after bookmark:** Remain on bookmark button (toggle)
- **Focus trap:** None (standard page)
- **Skip link:** "Skip to job description"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Job title | Yes | data.title | Page heading |
| Organization name | Yes | data.organizationName | Employer section |
| Job type | Yes | data.type | Badge |
| Location | Yes | data.location | With map pin icon |
| Salary range | No | data.salary | Prominent display if provided |
| Specialty | No | data.specialty | Badge |
| Description | Yes | data.description | Full text, markdown rendered |
| Requirements | No | data.requirements | Bulleted list from JSONB array |
| Application URL | No | data.applicationUrl | External link (opens new tab) |
| Application email | No | data.applicationEmail | mailto link |
| Posted date | Yes | data.postedAt | Relative + absolute |
| Expiry date | Yes | data.expiresAt | "Expires in X days" or "Expired" |
| Bookmark status | Yes | data.isBookmarked | Toggle button |
| Application count | Officers only | data.applications | Number of applications received |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Apply (in-app) | Open application form | Active members only (M15-R1) | -- |
| Apply (external) | Open external URL | Active members only | -- |
| Bookmark | Toggle save | Active members only | -- |
| Back to board | Return to job listing | All | Alt+Left |
| Share | Copy link to clipboard | All | -- |

### Role-Variant Matrix

| UI Element | Officer | Active Member | Grace/Lapsed Member |
|---|---|---|---|
| Full job detail | visible | visible | visible |
| Apply button | hidden (sees application count) | visible | disabled + "Active membership required" |
| Bookmark button | visible | visible | disabled |
| Application count | visible | hidden | hidden |
| Edit listing link | visible (own listings) | hidden | hidden |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Two-column: description left, sidebar right (employer info, apply, bookmark) |
| Tablet (768-1024px) | Single column, apply section sticky at bottom |
| Mobile (<768px) | Stacked layout, sticky "Apply" button at bottom of viewport |

### Layout Notes
- Apply button is primary CTA, prominently placed
- If applicationUrl is set, "Apply" opens external link with confirmation
- Requirements displayed as checklist-style bulleted list
- Employer section shows organization name and any available details

### States

- **Default:** Full listing with all fields and apply form
- **Loading:** Skeleton layout matching content structure
- **Empty:** N/A (detail page always has data if it exists)
- **Success:** Application submitted — sonner toast "Application submitted successfully" + apply button changes to "Applied" (disabled)
- **Validation Error:** Application form: "Resume is required" (if required), cover letter max length, inline field errors
- **Permission Error:** "Active membership required to apply" — apply button disabled for Grace/Lapsed
- **Unexpected Error:** "Unable to load listing. Please try again." with retry
- **Conflict/Duplicate Warning:** Already applied — apply button shows "Applied" (disabled), no re-submission
- **Offline/Sync:** "You're offline. Application will be submitted when you reconnect."

### Validation Behavior
- Resume: required (file upload validation — type, size)
- Cover letter: optional, max length if provided
- Application form validates client-side before submission

### Permission-Based UI Behavior
- Grace/Lapsed: can view listing, cannot apply or bookmark
- Officers: see application count instead of apply button
- Expired listings: all apply actions disabled, "This listing has expired" banner

### Edge Cases
- Listing expired: "This listing has expired on {date}" banner, apply disabled
- External application URL: "You will be redirected to {domain}. Continue?" confirmation
- Listing in pendingReview (external employer): not visible to members

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.

---

## Screen: Create Job Posting

**Purpose:** Post a new job listing
**Route:** `/org/[id]/officer/jobs/new`
**Primary Users/Roles:** Officers (Secretary), verified External Employers
**Related Workflow:** WF-088 (Create Job Posting)
**PRD / Module Spec Reference:** MODULE_SPEC.md Section 9 — Create Job Posting

### ARIA Landmark Structure

```
<header role="banner">              -- app header, breadcrumb: Jobs > New Listing
<nav role="navigation">             -- primary nav
<main role="main">
  <form role="form" aria-label="Create job posting">
    <section aria-label="Job details">         -- title, description, type, location
    <section aria-label="Requirements">        -- specialty, requirements, salary
    <section aria-label="Application method">  -- URL or email
    <section aria-label="Listing settings">    -- expiry date
<footer role="contentinfo">         -- submit/draft buttons
```

### Focus Management

- **Initial focus on load:** Job title input field
- **Focus after submit:** Redirect to job detail page (success) or first error field (validation)
- **Focus after save draft:** Sonner toast, remain on form
- **Focus trap:** None (standard form page)
- **Skip link:** "Skip to job details form"

### Fields / Displayed Data

| Field / Data | Required? | Source (API field) | Notes |
|---|---|---|---|
| Title | Yes | title | varchar(255), text input |
| Description | Yes | description | Textarea, rich text |
| Job type | Yes | type | Select: full_time, part_time, contract, fellowship, internship |
| Location | Yes | location | Text input, varchar(500) |
| Specialty | No | specialty | Text input or select, varchar(255) |
| Salary range | No | salary | Text input, varchar(255), placeholder "e.g., PHP 50,000 - 80,000/month" |
| Requirements | No | requirements | Dynamic list (add/remove items) |
| Application URL | No | applicationUrl | URL input with validation |
| Application email | No | applicationEmail | Email input with validation |
| Expiry date | Yes | expiresAt | Date picker, default: 30 days from today |

### Actions

| Action | Description | Permission Notes | Keyboard Shortcut |
|---|---|---|---|
| Submit (publish) | Publish listing immediately (officers) or submit for review (employers) | Officers: immediate; Employers: pendingReview (M15-R2) | Ctrl+Enter |
| Save as draft | Save without publishing | Officers, employers | -- |
| Cancel | Discard and return to job board | All | Escape |
| Add requirement | Add item to requirements list | All | Enter in requirements input |
| Remove requirement | Remove item from requirements | All | Delete/Backspace on item |

### Role-Variant Matrix

| UI Element | Officer (Secretary) | Verified External Employer | All Other Roles |
|---|---|---|---|
| Entire form | visible + editable | visible + editable | hidden (redirect to jobs) |
| Submit button label | "Publish" | "Submit for Review" | -- |
| Status after submit | Published immediately | Enters pendingReview (M15-R2) | -- |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Desktop (>1024px) | Two-column form: main fields left, settings right |
| Tablet (768-1024px) | Single column form with full-width fields |
| Mobile (<768px) | Stacked form, sticky submit bar at bottom |

### Layout Notes
- Clear distinction between required and optional fields (asterisk on required)
- Application method: radio group — "Application URL" or "Application Email" (at least one required)
- Requirements: dynamic add/remove list with text inputs
- Expiry date: defaults to 30 days from today, with calendar picker

### States

- **Default:** Blank form with defaults (expiry = 30 days)
- **Loading:** Submit button spinner, fields disabled during submission
- **Empty:** Blank form (initial state)
- **Success:** Officer: sonner toast "Job posted successfully", redirect to detail. Employer: sonner toast "Job submitted for review", redirect to board.
- **Validation Error:** Inline field errors — "Title is required", "Please provide an application URL or email", "Invalid URL format"
- **Permission Error:** "Only officers and verified employers can post jobs" — redirect to job board
- **Unexpected Error:** "Failed to post job. Draft saved." with retry
- **Conflict/Duplicate Warning:** N/A
- **Offline/Sync:** "You're offline. Job saved as draft." with auto-submit on reconnect

### Validation Behavior
- Title: required, max 255 chars
- Description: required, no max (text)
- Type: required, enum selection
- Location: required, max 500 chars
- Application: at least one of URL or email required
- applicationUrl: valid URL format
- applicationEmail: valid email format
- expiresAt: must be future date, defaults to 30 days from now
- All validation client-side + server-side

### Permission-Based UI Behavior
- Officers: submit publishes immediately
- External employers: submit enters pendingReview (M15-R2), shown "Submitted for review" state
- Non-authorized users: redirected away

### Edge Cases
- Both applicationUrl and applicationEmail provided: both stored, UI shows both options to applicants
- Expiry date set to today: warning "This listing will expire today"
- External employer not yet verified: form inaccessible

### Prototype Notes
- This is blueprint behavior only.
- Final behavior must be validated against the slice spec before implementation.
- Mock data, fields, statuses, and API shapes are not source of truth.
