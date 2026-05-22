<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Components: Membership (M05)

> Reusable components for the Membership module. Built on Radix UI (shadcn) primitives.

---

## Component 1: MemberStatusBadge

**Purpose:** Color-coded badge showing computed membership status.

### TypeScript Props Interface

```typescript
interface MemberStatusBadgeProps {
  /** Computed membership status from API (BR-01) */
  status: ComputedMembershipStatus;
  /** Optional size variant */
  size?: "sm" | "md" | "lg";
  /** Show status label text */
  showLabel?: boolean;
}

type ComputedMembershipStatus =
  | "active"
  | "gracePeriod"
  | "lapsed"
  | "suspended"
  | "removed"
  | "pendingPayment"
  | "deceased"
  | "resigned"
  | "expired"
  | "expelled";
```

### WAI-ARIA Pattern

- **Pattern:** Status indicator (no ARIA pattern ref; use `role="status"`)
- **Attributes:** `aria-label="Membership status: [status]"`
- **Live region:** No (static display)

### Keyboard Interaction

| Key | Action |
|-----|--------|
| N/A | Non-interactive element |

### Render Contract

| Status | Color | Icon | Label |
|--------|-------|------|-------|
| active | green-500 | CheckCircle | Active |
| gracePeriod | yellow-500 | Clock | Grace Period |
| lapsed | orange-500 | AlertTriangle | Lapsed |
| suspended | red-500 | Ban | Suspended |
| removed | gray-500 | XCircle | Removed |
| pendingPayment | blue-500 | CreditCard | Pending Payment |
| deceased | gray-400 | -- | Deceased |
| resigned | gray-400 | LogOut | Resigned |
| expired | red-300 | XCircle | Expired |
| expelled | red-700 | ShieldX | Expelled |

### Events

| Event | Payload | When |
|-------|---------|------|
| N/A | -- | Non-interactive |

### States

- **Default:** Colored badge with optional icon and label
- **Skeleton:** Gray rounded rectangle, no text

---

## Component 2: MemberRosterTable

**Purpose:** Paginated, sortable, filterable data table of organization members.

### TypeScript Props Interface

```typescript
interface MemberRosterTableProps {
  /** Organization ID for data fetching */
  organizationId: string;
  /** Current filters */
  filters: MemberRosterFilters;
  /** Filter change handler */
  onFiltersChange: (filters: MemberRosterFilters) => void;
  /** Selected member IDs for bulk actions */
  selectedIds: string[];
  /** Selection change handler */
  onSelectionChange: (ids: string[]) => void;
  /** Row click handler */
  onMemberClick: (memberId: string) => void;
}

interface MemberRosterFilters {
  search?: string;
  status?: ComputedMembershipStatus;
  tierId?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/) with sortable column headers
- **Attributes:**
  - Table: `role="table"`, `aria-label="Organization members"`
  - Sortable headers: `aria-sort="ascending" | "descending" | "none"`
  - Checkbox column: `aria-label="Select member"`
  - Row: `aria-selected` for selected rows

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between interactive elements (checkboxes, sort headers, pagination) |
| Space | Toggle row checkbox selection |
| Enter | Activate sort on column header; open member detail on row |
| Arrow Up/Down | Move between rows (when table has focus) |
| Ctrl+A | Select all visible rows |
| Escape | Clear selection |

### Render Contract

- Header row with sortable columns (name, joined, expiry)
- Data rows with member info, status badge, tier badge
- Selection checkbox per row (officers only)
- Pagination footer with cursor-based navigation
- Empty row when no data

### Events

| Event | Payload | When |
|-------|---------|------|
| onMemberClick | `{ memberId: string }` | Row clicked or Enter on row |
| onSelectionChange | `{ ids: string[] }` | Checkbox toggled |
| onFiltersChange | `MemberRosterFilters` | Search, sort, or filter changed |
| onPageChange | `{ cursor: string }` | Pagination clicked |

### States

- **Loading:** Skeleton rows (10), all interactions disabled
- **Empty:** Single row spanning all columns with CTA message
- **Populated:** Data rows with interactive elements
- **Filtered empty:** "No members match your filters" with clear filters link
- **Error:** Error row with retry button

---

## Component 3: CSVImportWizard

**Purpose:** Multi-step file upload, validate, preview, confirm wizard.

### TypeScript Props Interface

```typescript
interface CSVImportWizardProps {
  /** Organization ID */
  organizationId: string;
  /** Available membership tiers */
  tiers: MembershipTier[];
  /** Callback on wizard completion */
  onComplete: (result: ImportResult) => void;
  /** Callback on cancel */
  onCancel: () => void;
}

interface MembershipTier {
  id: string;
  name: string;
  duesAmount: string;
  billingCycle: string;
  status: "active" | "retired";
}

interface ImportResult {
  succeeded: number;
  linked: number;
  failed: number;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Wizard/Stepper](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) (tabs variant for linear steps)
- **Attributes:**
  - Step list: `role="tablist"`, `aria-label="Import steps"`
  - Each step: `role="tab"`, `aria-selected`, `aria-controls`
  - Step panel: `role="tabpanel"`, `aria-labelledby`
  - Progress: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between controls within current step |
| Enter | Confirm current step / proceed to next |
| Escape | Cancel wizard (with confirmation if data entered) |
| Arrow Left/Right | Navigate between completed steps (read-only) |

### Render Contract

- Step 1: Upload zone + tier selector + template download
- Step 2: Tabbed preview (Valid / Already Linked / Invalid) with per-row detail
- Step 3: Summary confirmation with counts
- Step 4: Results with download links

### Events

| Event | Payload | When |
|-------|---------|------|
| onFileSelected | `{ file: File }` | File dropped or selected |
| onTierSelected | `{ tierId: string }` | Default tier chosen |
| onConfirm | `{ importJobId: string }` | User confirms import |
| onComplete | `ImportResult` | Import finishes |
| onCancel | -- | User cancels |

### States

- **Idle:** Step 1, upload zone prominent
- **Validating:** Progress bar, "Validating N rows..."
- **Preview:** Step 2, tabbed view with counts
- **Confirming:** Step 3, summary with confirm/cancel
- **Importing:** Progress bar with row count
- **Complete:** Step 4, results summary
- **Error:** Per-step error display

---

## Component 4: ApplicationReviewPanel

**Purpose:** Detail panel for reviewing a single membership application.

### TypeScript Props Interface

```typescript
interface ApplicationReviewPanelProps {
  /** Application data */
  application: MembershipApplication;
  /** Review action handler */
  onReview: (action: ReviewAction) => void;
  /** Loading state */
  isLoading: boolean;
  /** Whether user has review permission */
  canReview: boolean;
}

interface MembershipApplication {
  id: string;
  organizationId: string;
  personId: string | null;
  applicantEmail: string;
  applicantLicenseNumber: string;
  firstName: string;
  lastName: string;
  tierId: string;
  tierName: string;
  status: "submitted" | "underReview" | "approved" | "denied" | "waitlisted";
  createdAt: string;
}

type ReviewAction =
  | { type: "approve" }
  | { type: "deny"; reason: string }
  | { type: "requestInfo" };
```

### WAI-ARIA Pattern

- **Pattern:** Complementary landmark with action buttons
- **Attributes:**
  - Panel: `role="complementary"`, `aria-label="Application details for [Name]"`
  - Action buttons: standard button semantics
  - Reject reason: `aria-required="true"` when reject selected

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between fields and action buttons |
| Enter | Activate focused button |
| Escape | Close panel (if modal on mobile) |

### Render Contract

- Applicant info (name, email, license, category)
- Application date and status
- Action buttons (Approve, Reject, Request Info)
- Reject reason textarea (shown on reject selection)
- Conflict alert if duplicate detected

### Events

| Event | Payload | When |
|-------|---------|------|
| onReview | `ReviewAction` | Officer clicks action button |

### States

- **Loading:** Skeleton fields
- **Ready:** Application data displayed, actions enabled (if canReview)
- **Read-only:** Application data displayed, actions hidden
- **Conflict:** Duplicate member alert, approve disabled
- **Processing:** Buttons disabled, spinner on active button

---

## Component 5: MemberDirectoryCard

**Purpose:** Privacy-filtered member card for the directory grid.

### TypeScript Props Interface

```typescript
interface MemberDirectoryCardProps {
  /** Person data (privacy-filtered by API) */
  person: DirectoryEntry;
  /** Click handler */
  onClick: (personId: string) => void;
}

interface DirectoryEntry {
  personId: string;
  firstName: string;
  lastName: string;
  tierName: string;
  computedStatus: ComputedMembershipStatus;
  /** Only present if privacy settings allow */
  specialization?: string;
  photoUrl?: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Card](https://www.w3.org/WAI/ARIA/apg/patterns/card/) (interactive)
- **Attributes:**
  - Card: `role="article"`, `aria-label="[firstName] [lastName], [tierName]"`
  - Clickable: entire card is focusable link

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Focus card |
| Enter/Space | Navigate to member profile |

### Render Contract

- Avatar (photo or initials fallback)
- Name (always visible)
- Tier badge
- Status badge
- Specialization (if present from API -- privacy-filtered)

### Events

| Event | Payload | When |
|-------|---------|------|
| onClick | `{ personId: string }` | Card clicked/activated |

### States

- **Default:** Card with all available fields
- **Skeleton:** Gray avatar circle + text lines
- **Hover:** Subtle shadow elevation
- **Focus:** Blue focus ring (2px)

---

## Component 6: BulkActionToolbar

**Purpose:** Toolbar for batch operations on selected members.

### TypeScript Props Interface

```typescript
interface BulkActionToolbarProps {
  /** Number of selected members */
  selectedCount: number;
  /** Available actions based on role */
  actions: BulkAction[];
  /** Action handler */
  onAction: (action: string) => void;
  /** Clear selection */
  onClearSelection: () => void;
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType;
  destructive?: boolean;
  requiresConfirmation?: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- **Attributes:**
  - Toolbar: `role="toolbar"`, `aria-label="Bulk actions for N selected members"`
  - Buttons: standard button with `aria-label`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Enter/exit toolbar |
| Arrow Left/Right | Navigate between toolbar buttons |
| Enter/Space | Activate button |
| Escape | Clear selection, hide toolbar |

### Render Contract

- Selection count badge: "N selected"
- Action buttons in row
- Clear selection (X) button
- Slides in from bottom on selection

### Events

| Event | Payload | When |
|-------|---------|------|
| onAction | `{ action: string }` | Action button clicked |
| onClearSelection | -- | X button or Escape |

### States

- **Hidden:** No selection (selectedCount === 0)
- **Visible:** Slides up with action buttons
- **Processing:** Buttons disabled, spinner on active button
- **Complete:** Success message, auto-hide after 3s
