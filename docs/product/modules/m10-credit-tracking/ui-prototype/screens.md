<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M10 Credit Tracking -- Screen Specifications

## Table of Contents
1. [My Credits](#screen-my-credits)
2. [Org Credit Compliance](#screen-org-credit-compliance)

---

## Screen: My Credits

**Route:** `/my/credits`
**Purpose:** Member views credit summary per compliance cycle, manages manual credit entries, downloads transcripts
**Workflow:** WF-065 (View Credit Summary), WF-066 (Add Manual Credit), WF-070 (Credit Transcript Export)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "My CPD Credits" |
| `main` | `<main>` | "Credit summary and entries" |
| `region` | `<section>` | "Cycle progress" |
| `complementary` | `<aside>` | "Credit actions" |

### Focus Management

- Page load: focus on `<h1>` "My CPD Credits"
- After adding manual credit: focus returns to credit entry list, toast "Credit entry added"
- After org selector change: focus stays on selector, data refetches
- Form open (manual credit): focus on first form field

### Fields Displayed

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| cycleStart | date | computed from registration + association config | Formatted |
| cycleEnd | date | computed | Formatted |
| requiredCredits | number | association credit config | Per-cycle requirement |
| earnedCredits | number | sum of credit entries | Auto + manual |
| carryoverCredits | number | excess from previous cycle | Per M10-R3 |
| remainingCredits | number | required - (earned + carryover) | Clamped to 0 |
| complianceStatus | enum | computed | compliant / at-risk / non-compliant |

**Credit Entry Table:**

| Field | Type | Source |
|-------|------|--------|
| activityName | string | creditEntry.activityName |
| activityDate | date | creditEntry.activityDate |
| credits | number | creditEntry.credits |
| source | enum | "auto" (from M09) or "manual" |
| verificationStatus | enum | pending / verified / rejected |
| organizationName | string | from credit entry context |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Add Manual Credit | `<button>` | `aria-label="Add manual credit entry"` | Always | Opens inline form |
| Download Transcript (PDF) | `<button>` | `aria-label="Download credit transcript as PDF"` | Always | `GET /credits/transcript?format=pdf` |
| Download Transcript (CSV) | `<button>` | `aria-label="Download credit transcript as CSV"` | Always | `GET /credits/transcript?format=csv` |
| Switch Org | `<select>` | `aria-label="Select organization for credit view"` | Multi-org member | Refetches with org filter |
| Switch Cycle | `<select>` | `aria-label="Select compliance cycle"` | Multiple cycles exist | Refetches with cycleId |

### Role-Variant Matrix

| Element | Member | Officer | Admin |
|---------|--------|---------|-------|
| Cycle progress | own data | own data | own data |
| Credit entries | own entries | own entries | own entries |
| Add Manual Credit | visible | visible | visible |
| Download Transcript | visible | visible | visible |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Cycle progress sidebar + credit entries table |
| 768-1023px | Cycle progress above, table below |
| < 768px | Stacked: progress bar, then card list (one entry per card) |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton progress bar + skeleton table rows | Initial fetch |
| Empty | Progress bar at 0% + "No credits yet. Complete a training or add manual credits." + CTA | 0 entries in cycle |
| Success | Populated progress bar + entry table | Has entries |
| Refreshing | Subtle spinner, data visible | Background refetch |
| Error | Alert "Unable to load credits. Please try again." + retry | API error |
| PermissionError | N/A (all members view own) | -- |
| ValidationError | Inline errors on manual credit form | Invalid form submission |
| Mutating | Add button spinner, "Adding credit..." | POST manual credit in flight |
| Downloading | Download button spinner, "Generating transcript..." | PDF/CSV generation |

### Validation (Manual Credit Form)

| Field | Rule | Error Message |
|-------|------|---------------|
| activityName | required, max 300 chars | "Activity name is required" |
| activityDate | required, not in future | "Activity date cannot be in the future" |
| credits | required, > 0, integer | "Credits must be a positive number" |
| description | optional, max 1000 chars | -- |

### Permissions

- Auth: GA -- all authenticated members view own credits
- Manual credit: all members can self-report
- Transcript download: own; admin/super can specify personId param

### Edge Cases

- Multi-org member: credits from all orgs aggregate into one cycle view, but org column shows source
- Carryover credits: displayed as separate line item above earned credits
- Cycle not yet started (new member): "Your compliance cycle begins on {date}"
- Mid-cycle association config change: M10-R4 -- changes apply next cycle, current cycle unchanged

---

## Screen: Org Credit Compliance

**Route:** `/org/[id]/officer/credits`
**Purpose:** Officer view of member compliance across the organization
**Workflow:** WF-068 (Org Credit Compliance)

### ARIA Landmarks

| Landmark | Element | Label |
|----------|---------|-------|
| `banner` | `<header>` | "Member Credit Compliance" |
| `main` | `<main>` | "Compliance table" |
| `navigation` | `<nav>` | "Compliance filters" |

### Focus Management

- Page load: focus on `<h1>`
- After filter change: focus stays on filter, table refetches
- Export: toast "Export started, download will begin shortly"

### Fields Displayed (Member Table)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| memberName | string | person.name | Linked to member profile |
| earnedCredits | number | sum of entries | Current cycle |
| requiredCredits | number | association config | Per-cycle |
| carryoverCredits | number | from previous cycle | -- |
| complianceStatus | badge | computed | compliant / at-risk / non-compliant |
| lastActivityDate | date | most recent credit entry | -- |

### Actions

| Action | Element | ARIA | Condition | API Call |
|--------|---------|------|-----------|----------|
| Filter by status | `<select>` | `aria-label="Filter by compliance status"` | Always | Query param filter |
| Search members | `<input type="search">` | `aria-label="Search members"` | Always | Debounced search |
| Export CSV | `<button>` | `aria-label="Export compliance report as CSV"` | Always | Generates client-side CSV |
| Adjust Credits | `<button>` per row | `aria-label="Adjust credits for {name}"` | Officer role | Opens adjustment dialog |
| View Member Detail | `<a>` on name | `aria-label="View credit details for {name}"` | Always | Expands inline or navigates |

### Role-Variant Matrix

| Element | Member | Officer | President | Admin | Super |
|---------|--------|---------|-----------|-------|-------|
| Compliance table | hidden | visible | visible | visible | visible |
| Export CSV | hidden | visible | visible | visible | visible |
| Adjust Credits | hidden | visible | visible | visible | visible |
| Non-officer redirect | PermissionError | -- | -- | -- | -- |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Full table with all columns |
| 768-1023px | Table with collapsed columns (hide lastActivity, carryover) |
| < 768px | Card list per member: name, progress bar, status badge |

### 9 Interaction States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton table rows (10) | Initial fetch |
| Empty | "No members found." (unlikely for active org) | 0 members |
| Success | Populated member table with compliance badges | Data loaded |
| Refreshing | Subtle spinner | Background refetch |
| Error | Alert "Unable to load compliance data." + retry | API error |
| PermissionError | Redirect to org dashboard with toast | Non-officer |
| FilteredEmpty | "No members match your filters." + clear filters link | Filters active, 0 results |
| Mutating | Adjustment dialog submit button with spinner | Credit adjustment in flight |
| Exporting | Export button spinner, "Generating CSV..." | Export in flight |

### Validation (Credit Adjustment Dialog)

| Field | Rule | Error Message |
|-------|------|---------------|
| credits | required, non-zero integer | "Credit amount is required" |
| reason | required, min 10 chars | "Please provide a reason (min 10 characters)" |
| type | required: "award" or "deduct" | -- |

### Permissions

- Auth: GA+HG -- officer, admin, super
- Credit adjustment: requires officer role + mandatory reason (M10-R2)

### Edge Cases

- Large org (500+ members): cursor-based pagination, no total count displayed
- Member with no credit activity: shows 0/required, status = at-risk or non-compliant
- Compliance calculation: cross-org aggregation means a member may be compliant overall but appear under-credited for this specific org
