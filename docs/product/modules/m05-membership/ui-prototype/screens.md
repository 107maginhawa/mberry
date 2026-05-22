<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Screens: Membership (M05)

> Tech: React 19, TanStack Router, TanStack Query, Radix UI (shadcn), Tailwind CSS, sonner toasts
> Apps: memberry (3004) for officer/member screens, account (3002) for profile-linked views

---

## Screen 1: Member Roster

**Route:** `/org/[organizationId]/officer/roster`
**Purpose:** Full member list with search, filter, bulk actions
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Member Roster" |
| Search | `search` | "Search members" |
| Filters | `region` | "Filter members" |
| Data table | `table` | "Organization members" |
| Bulk actions | `toolbar` | "Bulk actions" |
| Pagination | `navigation` | "Roster pagination" |

### Focus Management

- Page load: focus on search input
- After filter change: focus returns to first table row
- After bulk action completes: focus on sonner toast, then returns to table
- After CSV export: focus on download confirmation

### Fields

| Field | Type | Source | Display | Sortable | Filterable |
|-------|------|--------|---------|----------|------------|
| person.firstName + person.lastName | text | GET /org/:id/members | Full name link | Yes (name) | Via search |
| person.email | email | GET /org/:id/members | Hidden on mobile | No | Via search |
| person.licenseNumber | text | GET /org/:id/members/:id | Visible to officers | No | Via search |
| tierName | text | GET /org/:id/members | Badge | No | Yes (tierId) |
| computedStatus | enum | GET /org/:id/members | Status badge (color-coded) | No | Yes (status) |
| duesExpiryDate | date | GET /org/:id/members | Formatted date | Yes | No |
| joinedAt | date-time | GET /org/:id/members | Relative date | Yes (default desc) | No |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Search members | Input debounced 300ms | GET /org/:id/members?search= | All officers | Table updates |
| Filter by status | Select change | GET /org/:id/members?status= | All officers | Table updates |
| Filter by tier | Select change | GET /org/:id/members?tierId= | All officers | Table updates |
| Sort column | Column header click | GET /org/:id/members?sort= | All officers | Table re-renders |
| View member detail | Row click | Navigate to member detail | All officers | Page transition |
| Export CSV | Toolbar button | Client-side export | All officers | Download starts |
| Bulk send reminder | Toolbar button (selection) | POST /org/:id/communications | Officers | sonner: "Reminders sent to N members" |
| Bulk change category | Toolbar button (selection) | PATCH /org/:id/members (batch) | President, Secretary (2FA) | sonner: "N members updated" |
| Import members | Toolbar button | Navigate to /org/:id/officer/roster/import | President, Secretary (2FA) | Page transition |

### Role-Variant Matrix

| Element | President | Secretary | Treasurer | Officer | Staff | Member |
|---------|-----------|-----------|-----------|---------|-------|--------|
| View roster | Full | Full | Read | Full | Full | -- (redirect to directory) |
| Bulk actions toolbar | Visible | Visible | Hidden | Hidden | Hidden | Hidden |
| Import button | Visible | Visible | Hidden | Hidden | Hidden | Hidden |
| Email column | Visible | Visible | Visible | Visible | Visible | Hidden |
| License column | Visible | Visible | Hidden | Visible | Hidden | Hidden |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Full data table, sidebar filters | All columns visible |
| 768-1023px (md) | Table with horizontal scroll | Email and license hidden, filters collapse to dropdown |
| < 768px (sm) | Card list | Name + status badge + tier per card, tap to expand |

### Interaction States

1. **Loading:** Skeleton table (10 rows, 6 columns). Search/filter inputs disabled with `aria-busy="true"`.
2. **Empty:** Illustration + "No members yet. Import your roster or invite members." + CTA buttons for Import and Invite.
3. **Success:** Populated table with pagination. Status badges: green (Active), yellow (Grace), orange (Lapsed), red (Suspended), gray (Removed/Expired).
4. **Validation Error:** N/A for read screen.
5. **Permission Error:** Member role: redirect to `/org/[id]/members` (directory). User role: 403 page with "You don't have access to the member roster."
6. **Unexpected Error:** "Something went wrong loading the roster." + Retry button. Error logged.
7. **Conflict/Duplicate:** N/A for read screen.
8. **Confirmation/Warning:** Bulk action: "Apply change to N selected members?" confirm dialog.
9. **Offline/Sync:** "You're offline. Roster data may be stale." banner. Read-only mode with cached data.

### Validation Rules

- Search: min 2 characters before triggering query
- Status filter: enum values only (active, gracePeriod, lapsed, suspended, removed, pendingPayment)
- Tier filter: valid UUID from GET /org/:id/membership-categories

### Edge Cases

- Zero-member org: empty state with import CTA
- 1000+ members: paginated (50 per page), cursor-based
- Member with multiple statuses across orgs: shows status for current org only (BR-21)
- Life member: status always "Active", expiry shows "Lifetime"

---

## Screen 2: Bulk CSV Import

**Route:** `/org/[organizationId]/officer/roster/import`
**Purpose:** Multi-step import wizard
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Import Members" |
| Stepper | `navigation` | "Import progress" |
| Step content | `region` | "Step N: [Step Name]" |
| Upload zone | `region` | "File upload area" |
| Preview table | `table` | "Import preview" |
| Results | `region` | "Import results" |

### Focus Management

- Page load: focus on step 1 upload zone
- Step transitions: focus on first interactive element of new step
- After import complete: focus on results summary
- Error: focus on first error row in preview

### Fields (Step 2 Preview)

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| row | integer | CSV parse | Row number | -- |
| firstName | text | CSV | Name | Required |
| lastName | text | CSV | Name | Required |
| email | email | CSV | Email | Required, validated |
| licenseNumber | text | CSV | License | PRC format (BR-23) |
| category | text | CSV | Tier name | Must match active tier |
| matchStatus | enum | POST /org/:id/members/import | new / alreadyLinked / invalid | Color-coded badge |
| errorMessage | text | POST /org/:id/members/import | Error detail | Red text for invalid rows |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Download template | Link click | Static file download | President, Secretary (2FA) | CSV file downloads |
| Upload CSV | Drop/click file input | POST /org/:id/members/import | President, Secretary (2FA) | Progress to step 2 |
| Select default tier | Dropdown | Local state | President, Secretary (2FA) | -- |
| Download invalid rows | Button (step 2) | Client-side filter | President, Secretary (2FA) | CSV downloads |
| Confirm import | Button (step 3) | POST /org/:id/members/import/confirm | President, Secretary (2FA) | Progress bar, then step 4 |
| Download skipped rows | Button (step 4) | Client-side export | President, Secretary (2FA) | CSV downloads |

### Role-Variant Matrix

| Element | President | Secretary | All Others |
|---------|-----------|-----------|------------|
| Access page | Yes (2FA) | Yes (2FA) | Redirect to roster with permission error |
| All actions | Full | Full | None |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Full wizard with side preview | All columns visible in preview |
| 768-1023px (md) | Full-width wizard, scroll preview | Horizontal scroll on preview table |
| < 768px (sm) | Full-width, stacked steps | Preview shows card list per row |

### Interaction States

1. **Loading:** Step 2 validation: "Validating N rows..." with progress bar. `aria-busy="true"` on preview region.
2. **Empty:** Step 1: drag-drop zone + "Drop your CSV file here or click to browse." Template download link prominent.
3. **Success:** Step 4: "Import complete! X imported, Y linked, Z skipped." Green checkmark. Link back to roster.
4. **Validation Error:** File type: "Please upload a CSV file." Format: "CSV missing required columns: [list]." Row-level: red highlight with per-field error in preview table.
5. **Permission Error:** "Importing members requires President or Secretary role with two-factor authentication."
6. **Unexpected Error:** "Import failed. Your data was not modified." + Retry button. Error boundary catches.
7. **Conflict/Duplicate:** Already-linked tab in step 2: "25 members matched existing accounts (via email or license)." Match method shown per row.
8. **Confirmation/Warning:** Step 3: "Import X new members and link Y existing accounts? This action cannot be undone." Confirm/Cancel dialog.
9. **Offline/Sync:** "Import requires an internet connection." Upload disabled. Cached template still downloadable.

### Validation Rules

- File: .csv extension, max 500 rows (M05-005), max 5MB
- Required columns: email, firstName, lastName, licenseNumber
- Email: standard format, case-insensitive matching (BR-22)
- License: PRC regex format (BR-23)
- Category: must map to active tier
- 500-row validation < 30s (AC-M05-003)

### Edge Cases

- All rows invalid: "0 valid rows. Please check your data." Step 3 button disabled.
- Same email on two CSV rows: second row flagged as duplicate within file
- Ambiguous match (email -> PersonA, license -> PersonB): flagged for human resolution in already-linked tab
- 500-row file: progress indicator during validation

---

## Screen 3: Member Directory

**Route:** `/org/[organizationId]/members`
**Purpose:** Searchable member list (privacy-filtered)
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Member Directory" |
| Search | `search` | "Search directory" |
| Results | `region` | "Directory results" |

### Focus Management

- Page load: focus on search input
- After search: focus on first result card
- Empty results: focus on "no results" message

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| firstName + lastName | text | GET /org/:id/directory | Full name | Always visible |
| tierName | text | GET /org/:id/directory | Badge | Always visible |
| computedStatus | enum | GET /org/:id/directory | Status badge | Always visible |
| specialization | text | GET /org/:id/directory | Subtitle | Privacy-dependent |
| photo | image | Person profile | Avatar | Privacy-dependent |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Search | Input debounced 300ms | GET /org/:id/directory?search= | Org members | Results update |
| View profile | Card click | Navigate to member profile | Org members | Page transition |

### Role-Variant Matrix

| Element | Officer | Member | Non-member |
|---------|---------|--------|------------|
| Access | Full | Full | 403 redirect |
| Name + license | Always visible | Always visible | -- |
| Email | Visible | Privacy-dependent | -- |
| Phone | Visible | Privacy-dependent | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | 3-column card grid | Photo + name + tier + specialization |
| 768-1023px (md) | 2-column card grid | Same content |
| < 768px (sm) | Single-column card list | Compact card, smaller photo |

### Interaction States

1. **Loading:** Skeleton cards (6 cards, 3x2 grid). Search disabled with `aria-busy="true"`.
2. **Empty:** "No members in this organization's directory."
3. **Success:** Populated card grid with cursor pagination.
4. **Validation Error:** N/A.
5. **Permission Error:** Non-member: "You must be a member of this organization to view the directory."
6. **Unexpected Error:** "Couldn't load the directory." + Retry button.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** N/A.
9. **Offline/Sync:** Cached cards shown with "Offline" banner. Search disabled.

### Edge Cases

- Member with hidden fields: fields never rendered (AC-M05-005)
- Officer always sees name and license even when hidden
- Public directory (opt-in): accessible without authentication at `/org/:id/directory/public`

---

## Screen 4: Application Review

**Route:** `/org/[organizationId]/officer/applications`
**Purpose:** Review pending membership applications
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Membership Applications" |
| Application list | `table` | "Pending applications" |
| Detail panel | `complementary` | "Application details" |
| Action bar | `toolbar` | "Review actions" |

### Focus Management

- Page load: focus on first application row
- After selecting application: focus on detail panel heading
- After approve/reject: focus returns to next application in list, sonner toast announces result
- After bulk approve: focus on results summary

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| applicantEmail | email | PUT /org/:id/applications/:id | Email | -- |
| firstName + lastName | text | Application data | Full name | -- |
| applicantLicenseNumber | text | Application data | License number | PRC format |
| tierId | uuid -> name | Application data | Category badge | Resolved to tier name |
| status | enum | Application data | Status badge | submitted / underReview / approved / denied |
| createdAt | date-time | Application data | Relative date | Sortable, default newest first |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Select application | Row click | Local state | President, Secretary | Detail panel populates |
| Approve | Button click | PUT /org/:id/applications/:id {status: "approved"} | President, Secretary (2FA) | sonner: "Application approved. Welcome email sent." |
| Reject | Button click | PUT /org/:id/applications/:id {status: "denied", reason} | President, Secretary (2FA) | Reason input required. sonner: "Application rejected." |
| Request info | Button click | PUT /org/:id/applications/:id {status: "underReview"} | President, Secretary (2FA) | sonner: "More information requested." |
| Bulk approve | Toolbar button | PUT /org/:id/applications/:id (batch) | President, Secretary (2FA) | sonner: "N applications approved." |

### Role-Variant Matrix

| Element | President | Secretary | All Others |
|---------|-----------|-----------|------------|
| View applications | Yes | Yes | 403 redirect |
| Approve/Reject | Yes (2FA) | Yes (2FA) | -- |
| Bulk approve | Yes (2FA) | Yes (2FA) | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | List + detail side panel | 60/40 split |
| 768-1023px (md) | List + modal detail | Detail opens in sheet |
| < 768px (sm) | List only, tap opens detail page | Full-page detail view |

### Interaction States

1. **Loading:** Skeleton list (5 rows). Detail panel shows placeholder.
2. **Empty:** "No pending applications." Illustration with happy members.
3. **Success:** Populated list with status badges. Detail panel shows full application.
4. **Validation Error:** Reject without reason: inline error "Please provide a reason for rejection."
5. **Permission Error:** "Only the President or Secretary can review applications."
6. **Unexpected Error:** "Couldn't load applications." + Retry button.
7. **Conflict/Duplicate:** "This person already has an active membership." Alert on detail panel (M5-R5). Approve blocked.
8. **Confirmation/Warning:** Approve: "Approve [Name]? This will create their membership and generate a dues invoice." Reject: "Reject [Name]? They will be notified with your reason."
9. **Offline/Sync:** "Application review requires an internet connection." Actions disabled. List shows cached data.

### Validation Rules

- Reject requires reason (1-500 chars)
- Bulk approve: only same-org applications processed (AC-M05-007)
- Duplicate detection: if applicant matches existing member, approve blocked

### Edge Cases

- Application from existing member: shown with conflict badge, approve button disabled
- Applicant already applied and was denied: new application allowed (back to PENDING)
- Org with no dues config: approval creates Active member with no expiry (edge case noted in spec)
