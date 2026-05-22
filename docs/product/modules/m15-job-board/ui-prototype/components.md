<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Components: Job Board (M15)

---

## Component: JobListingCard

**Purpose:** Display a single job listing summary with key details and bookmark action
**Used In:** Job Board
**WAI-ARIA Pattern:** none (article)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface JobListingCardProps {
  /** Job posting data */
  job: {
    id: string;
    title: string;
    organizationName: string;
    type: "full_time" | "part_time" | "contract" | "fellowship" | "internship";
    location: string;
    specialty: string | null;
    salary: string | null;
    postedAt: string | null;
    expiresAt: string;
    status: "active" | "expired";
  };
  /** Whether job is bookmarked by current user */
  isBookmarked: boolean;
  /** Whether current user can bookmark (active member) */
  canBookmark: boolean;
  /** Callback fired when bookmark toggled */
  onToggleBookmark: (jobId: string) => void;
  /** Callback fired when card clicked for detail view */
  onClick: (jobId: string) => void;
}
```

### Render Contract

- **Visual output:** Card with title (h3), employer name, type badge (colored), location with pin icon, specialty badge (if present), salary (if present), relative posted date, expiry warning, bookmark icon button
- **Slots/children:** None
- **Conditional rendering:**
  - Salary: shown only if non-null
  - Specialty badge: shown only if non-null
  - Expiry warning: orange "Expiring soon" badge if <7 days remaining
  - Bookmark icon: filled if isBookmarked, outline if not; disabled if canBookmark=false

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onToggleBookmark | `(jobId: string) => void` | Bookmark toggled |
| onClick | `(jobId: string) => void` | Card clicked for detail navigation |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus card, then bookmark button |
| Enter | Navigate to job detail (when card focused) |
| Space | Toggle bookmark (when bookmark button focused) |

### States
- **Default:** Card with job summary
- **Loading:** Skeleton card matching dimensions
- **Disabled:** Bookmark button disabled for non-active members
- **Error:** N/A (card is read-only display)
- **Success:** Bookmark toggle — brief icon animation

### Should Contain
- Job type badge color mapping
- Relative time formatting
- Expiry calculation and warning display

### Should NOT Contain
- Navigation logic
- Bookmark API calls
- Search/filter logic

### Reuse Notes
- Specific to job board module

---

## Component: JobSearchBar

**Purpose:** Text search across job listings with debounced input
**Used In:** Job Board
**WAI-ARIA Pattern:** combobox (search)
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

### TypeScript Props Interface

```typescript
interface JobSearchBarProps {
  /** Current search query */
  value: string;
  /** Callback fired on search input change (debounced) */
  onChange: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of results for screen reader announcement */
  resultCount: number | null;
}
```

### Render Contract

- **Visual output:** Search input with magnifying glass icon, clear button when value is non-empty
- **Slots/children:** None
- **Conditional rendering:** Clear (X) button appears only when value is non-empty; result count announced via aria-live

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onChange | `(query: string) => void` | Debounced search query update |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Ctrl+K | Focus search bar (global shortcut) |
| Escape | Clear search and blur |
| Enter | Submit search (no debounce wait) |

### States
- **Default:** Empty search bar with placeholder
- **Loading:** Subtle spinner in search icon area during debounce
- **Disabled:** N/A
- **Error:** N/A
- **Success:** N/A

### Should Contain
- Debounce logic (300ms)
- Minimum character gate (2 chars)
- Clear button

### Should NOT Contain
- API search calls
- Result rendering

### Reuse Notes
- Reusable search bar pattern across modules

---

## Component: JobFilterChips

**Purpose:** Filter job listings by type, specialty, and location
**Used In:** Job Board
**WAI-ARIA Pattern:** toolbar
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

### TypeScript Props Interface

```typescript
interface JobFilterChipsProps {
  /** Active type filters */
  selectedTypes: Array<"full_time" | "part_time" | "contract" | "fellowship" | "internship">;
  /** Active specialty filter */
  selectedSpecialty: string | null;
  /** Active location filter */
  selectedLocation: string | null;
  /** Available specialties for filter options */
  specialtyOptions: string[];
  /** Available locations for filter options */
  locationOptions: string[];
  /** Callback fired when filters change */
  onFilterChange: (filters: {
    types: Array<"full_time" | "part_time" | "contract" | "fellowship" | "internship">;
    specialty: string | null;
    location: string | null;
  }) => void;
}
```

### Render Contract

- **Visual output:** Horizontal row of toggle chips for job types + dropdown chips for specialty and location
- **Slots/children:** None
- **Conditional rendering:** "Clear all" link appears when any filter is active

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onFilterChange | `(filters: JobFilters) => void` | Combined filter state changed |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move focus into/out of filter toolbar |
| Arrow Left/Right | Navigate between chips |
| Enter/Space | Toggle chip or open dropdown |
| Escape | Close open dropdown |

### States
- **Default:** All chips unselected
- **Loading:** N/A (client-side)
- **Disabled:** N/A
- **Error:** N/A
- **Success:** N/A

### Should Contain
- Multi-select toggle for types
- Single-select dropdowns for specialty/location
- Clear all action

### Should NOT Contain
- Data fetching
- Listing re-rendering

### Reuse Notes
- Filter chip pattern reusable across modules

---

## Component: JobApplicationForm

**Purpose:** In-app job application form with resume upload
**Used In:** Job Detail
**WAI-ARIA Pattern:** none (form)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface JobApplicationFormProps {
  /** Job posting ID */
  jobId: string;
  /** Organization ID */
  organizationId: string;
  /** Whether user has already applied */
  hasApplied: boolean;
  /** Callback fired on successful submission */
  onSubmit: (data: { resumeUrl: string; coverLetter: string | null }) => void;
  /** Whether form is submitting */
  isSubmitting: boolean;
}
```

### Render Contract

- **Visual output:** Form with resume upload zone (drag-drop + file picker), optional cover letter textarea, submit button. If hasApplied=true: "Applied" badge replaces form.
- **Slots/children:** None
- **Conditional rendering:**
  - hasApplied=true: form replaced with "You've already applied" message + applied date
  - Resume upload progress bar during upload
  - Cover letter character count

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSubmit | `(data: ApplicationPayload) => void` | Application submitted |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move between resume upload, cover letter, submit |
| Enter | Trigger file picker (on upload zone) or submit (on button) |

### States
- **Default:** Empty form ready for input
- **Loading:** Submit button spinner, fields disabled
- **Disabled:** hasApplied=true — form replaced with applied confirmation
- **Error:** "Resume is required" inline error, file type/size errors
- **Success:** Parent handles toast + button state change to "Applied"

### Should Contain
- Resume file type validation (PDF, DOC, DOCX)
- File size limit display
- Upload progress indicator
- Cover letter character count

### Should NOT Contain
- File upload to storage (parent handles via storage module)
- Application API call

### Reuse Notes
- Specific to job board module

---

## Component: BookmarkButton

**Purpose:** Toggle bookmark/save state for a job listing
**Used In:** JobListingCard, Job Detail
**WAI-ARIA Pattern:** none (toggle button)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface BookmarkButtonProps {
  /** Whether currently bookmarked */
  isBookmarked: boolean;
  /** Whether user can bookmark (active member) */
  isEnabled: boolean;
  /** Disabled tooltip text */
  disabledTooltip?: string;
  /** Callback fired on toggle */
  onToggle: () => void;
}
```

### Render Contract

- **Visual output:** Icon button — filled bookmark when isBookmarked, outline when not. Disabled state with tooltip when isEnabled=false.
- **Slots/children:** None
- **Conditional rendering:** Tooltip on disabled state

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onToggle | `() => void` | Bookmark state toggled |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Enter/Space | Toggle bookmark |

### States
- **Default:** Outline bookmark icon
- **Loading:** Spinner replacing icon during API call
- **Disabled:** Grayed out with tooltip
- **Error:** Sonner toast "Failed to save job"
- **Success:** Icon animates to filled state

### Should Contain
- Toggle icon display
- aria-pressed attribute
- Tooltip on disabled

### Should NOT Contain
- Bookmark API calls
- Permission checks

### Reuse Notes
- Generic toggle button pattern, reusable

---

## Component: JobAlertForm

**Purpose:** Create or manage job alert preferences
**Used In:** Job Board (sidebar/modal)
**WAI-ARIA Pattern:** dialog (when modal)
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

### TypeScript Props Interface

```typescript
interface JobAlertFormProps {
  /** Existing alerts for current user */
  existingAlerts: Array<{
    id: string;
    keyword: string | null;
    type: string | null;
    specialty: string | null;
    location: string | null;
    createdAt: string;
  }>;
  /** Callback fired on new alert creation */
  onCreateAlert: (alert: { keyword?: string; type?: string; specialty?: string; location?: string }) => void;
  /** Callback fired on alert deletion */
  onDeleteAlert: (alertId: string) => void;
  /** Whether creation is in progress */
  isCreating: boolean;
}
```

### Render Contract

- **Visual output:** List of existing alerts with delete buttons + form to create new alert (keyword, type, specialty, location fields)
- **Slots/children:** None
- **Conditional rendering:** Empty list message if no existing alerts

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onCreateAlert | `(alert: AlertPayload) => void` | New alert created |
| onDeleteAlert | `(alertId: string) => void` | Alert removed |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move between alert list and create form fields |
| Enter | Submit new alert or delete focused alert |
| Escape | Close modal (if in modal mode) |

### States
- **Default:** Existing alerts listed + create form
- **Loading:** Create button spinner
- **Disabled:** N/A
- **Error:** "Failed to create alert" inline error
- **Success:** Sonner toast "Job alert created" + new alert appears in list

### Should Contain
- Alert list display
- Create alert form
- Delete confirmation

### Should NOT Contain
- Alert notification delivery logic
- API calls

### Reuse Notes
- Alert pattern could be adapted for other notification preferences
