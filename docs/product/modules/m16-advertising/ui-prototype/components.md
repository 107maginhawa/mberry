<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Components: Advertising (M16)

---

## Component: CampaignTable

**Purpose:** Sortable, filterable table of advertising campaigns with metrics
**Used In:** Advertising Dashboard
**WAI-ARIA Pattern:** grid
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/grid/

### TypeScript Props Interface

```typescript
interface CampaignTableProps {
  /** Campaign data rows */
  campaigns: Array<{
    id: string;
    name: string;
    advertiserName: string;
    status: "draft" | "pending_review" | "active" | "paused" | "completed" | "rejected";
    budgetCents: number;
    spentCents: number;
    adSlot: "feed_banner" | "sidebar" | "email_footer" | "event_sponsor";
    impressions: number;
    clicks: number;
    ctr: number;
    startsAt: string | null;
    endsAt: string | null;
  }>;
  /** Current sort state */
  sortColumn: string;
  sortDirection: "asc" | "desc";
  /** Callback fired when sort changes */
  onSortChange: (column: string, direction: "asc" | "desc") => void;
  /** Callback fired when row clicked */
  onRowClick: (campaignId: string) => void;
  /** Whether data is loading */
  isLoading: boolean;
}
```

### Render Contract

- **Visual output:** Table with columns: Name (link), Advertiser, Status (badge), Budget (bar), Spent, Impressions, Clicks, CTR, Slot (badge). Clickable rows. Sortable headers.
- **Slots/children:** None
- **Conditional rendering:**
  - Status badges color-coded per status
  - Budget bar: green (<50%), yellow (50-90%), red (>90%)
  - CTR shows "--" when impressions=0
  - Loading: skeleton rows

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSortChange | `(column: string, direction: "asc" \| "desc") => void` | Sort changed |
| onRowClick | `(campaignId: string) => void` | Row clicked for detail |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus table, then rows |
| Arrow Up/Down | Navigate rows |
| Enter | Open campaign detail |
| Space | Toggle sort on focused column header |

### States
- **Default:** Populated table
- **Loading:** Skeleton rows (5-8)
- **Disabled:** N/A
- **Error:** "Unable to load campaigns" with retry
- **Success:** N/A (read-only table)

### Should Contain
- Column sort logic (client-side)
- Currency formatting (cents to PHP)
- Status badge color mapping
- Budget progress bar

### Should NOT Contain
- Data fetching
- Campaign CRUD logic

### Reuse Notes
- Table pattern reusable; columns are module-specific

---

## Component: CampaignConfigForm

**Purpose:** Inline-editable campaign configuration form
**Used In:** Campaign Detail
**WAI-ARIA Pattern:** none (form)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface CampaignConfigFormProps {
  /** Campaign data */
  campaign: {
    id: string;
    name: string;
    description: string | null;
    budgetCents: number;
    targetSegmentId: string | null;
    adSlot: "feed_banner" | "sidebar" | "email_footer" | "event_sponsor";
    startsAt: string | null;
    endsAt: string | null;
    status: "draft" | "pending_review" | "active" | "paused" | "completed" | "rejected";
  };
  /** Advertiser info */
  advertiser: {
    id: string;
    companyName: string;
  };
  /** Available advertisers for selection */
  advertisers: Array<{ id: string; companyName: string }>;
  /** Callback fired on save */
  onSave: (data: Partial<CampaignConfigFormProps["campaign"]>) => void;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Whether campaign is in a terminal state (completed/rejected) */
  isReadOnly: boolean;
}
```

### Render Contract

- **Visual output:** Inline-editable form fields: name (text), description (textarea), budget (currency input), ad slot (select), start/end dates (date pickers), targeting (segment selector). Save button appears when dirty.
- **Slots/children:** None
- **Conditional rendering:**
  - isReadOnly=true: all fields display-only, no edit affordances
  - Save button: appears only when form is dirty
  - Advertiser: always read-only (set at creation)

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSave | `(data: Partial<Campaign>) => void` | Config changes saved |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move between fields |
| Ctrl+S | Save changes |
| Escape | Revert unsaved changes |

### States
- **Default:** Display mode with edit affordances
- **Loading:** Save button spinner
- **Disabled:** isReadOnly=true (completed/rejected campaigns)
- **Error:** Inline validation errors
- **Success:** Sonner toast "Campaign updated"

### Should Contain
- Inline edit toggle per field
- Dirty state tracking
- Client-side validation
- Currency input formatting

### Should NOT Contain
- Campaign state transition logic
- API save calls

### Reuse Notes
- Inline-edit form pattern reusable for other config screens

---

## Component: CreativeCard

**Purpose:** Display a single ad creative with preview and approval actions
**Used In:** Campaign Detail (creative list), Creative Review Queue
**WAI-ARIA Pattern:** none (article)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface CreativeCardProps {
  /** Creative data */
  creative: {
    id: string;
    title: string;
    bodyText: string;
    imageUrl: string | null;
    clickUrl: string | null;
    status: "pending" | "approved" | "rejected";
    sponsoredLabel: boolean;
    reviewedBy: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
  /** Campaign name for context */
  campaignName: string;
  /** Advertiser name for context */
  advertiserName: string;
  /** Whether to show approval actions */
  showActions: boolean;
  /** Callback fired on approve */
  onApprove: (creativeId: string) => void;
  /** Callback fired on reject (opens reason dialog) */
  onReject: (creativeId: string) => void;
}
```

### Render Contract

- **Visual output:** Card showing: "Sponsored" label (always present per M16-R5), title, body text (truncated at 200 chars), image thumbnail (if present), click URL preview, status badge, approve/reject buttons (if showActions and status=pending)
- **Slots/children:** None
- **Conditional rendering:**
  - Image: shown only if imageUrl is non-null
  - Approve/Reject buttons: shown only if showActions=true and status="pending"
  - Rejection reason: shown only if status="rejected" and rejectionReason is non-null
  - Reviewer info: shown if reviewedBy is non-null

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onApprove | `(creativeId: string) => void` | Creative approved |
| onReject | `(creativeId: string) => void` | Reject initiated (opens dialog) |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus card, then action buttons |
| Enter | Activate focused button (approve/reject) |

### States
- **Default:** Card with creative preview
- **Loading:** Skeleton card
- **Disabled:** Actions hidden when status is not "pending"
- **Error:** "Failed to update creative" toast
- **Success:** Card fades out of pending queue / status badge updates

### Should Contain
- Creative preview layout
- Status badge rendering
- "Sponsored" label display
- Text truncation

### Should NOT Contain
- Approval API calls
- Campaign state logic

### Reuse Notes
- Used in both campaign detail and review queue screens

---

## Component: RejectionReasonDialog

**Purpose:** Collect rejection reason when rejecting an ad creative
**Used In:** Creative Review Queue, Campaign Detail
**WAI-ARIA Pattern:** dialog
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

### TypeScript Props Interface

```typescript
interface RejectionReasonDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Creative ID being rejected */
  creativeId: string;
  /** Creative title for display */
  creativeTitle: string;
  /** Callback fired on rejection submission */
  onSubmit: (creativeId: string, reason: string) => void;
  /** Callback fired on cancel */
  onClose: () => void;
  /** Whether submission is in progress */
  isSubmitting: boolean;
}
```

### Render Contract

- **Visual output:** Modal dialog with creative title, reason textarea (required), submit and cancel buttons
- **Slots/children:** None
- **Conditional rendering:** Submit disabled while isSubmitting

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSubmit | `(creativeId: string, reason: string) => void` | Rejection submitted |
| onClose | `() => void` | Dialog dismissed |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move between reason field and buttons |
| Enter | Submit (when button focused) |
| Escape | Close dialog |

### States
- **Default:** Open dialog with empty reason field
- **Loading:** Submit spinner, fields disabled
- **Disabled:** N/A
- **Error:** "Rejection reason is required" inline error
- **Success:** Dialog closes, parent handles toast

### Should Contain
- Reason input with required validation
- Focus trap
- Return focus to trigger on close

### Should NOT Contain
- API calls
- Creative state management

### Reuse Notes
- Dialog pattern reusable for any rejection/denial flow

---

## Component: BudgetGauge

**Purpose:** Visual progress bar showing campaign budget utilization
**Used In:** Campaign Detail, CampaignTable (inline)
**WAI-ARIA Pattern:** none (progressbar)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface BudgetGaugeProps {
  /** Total budget in cents */
  budgetCents: number;
  /** Amount spent in cents */
  spentCents: number;
  /** Whether to show labels */
  showLabels: boolean;
  /** Size variant */
  size: "sm" | "md" | "lg";
}
```

### Render Contract

- **Visual output:** Horizontal progress bar with spent/total ratio. Color: green (<50%), yellow (50-90%), red (>90%). Optional labels showing "PHP X / PHP Y" and percentage.
- **Slots/children:** None
- **Conditional rendering:**
  - Labels: shown only if showLabels=true
  - "Budget exhausted" text: shown when spentCents >= budgetCents

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| (none) | -- | Read-only display |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus (screen reader reads progress) |

### States
- **Default:** Progress bar at current ratio
- **Loading:** N/A (derived from parent data)
- **Disabled:** N/A
- **Error:** N/A
- **Success:** N/A

### Should Contain
- Progress calculation
- Color threshold logic
- Currency formatting (cents to PHP)
- role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax

### Should NOT Contain
- Budget enforcement logic

### Reuse Notes
- Reusable for any budget/quota visualization

---

## Component: PerformanceChart

**Purpose:** Display campaign impressions, clicks, and CTR over time
**Used In:** Campaign Detail
**WAI-ARIA Pattern:** none (image with aria-label)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface PerformanceChartProps {
  /** Time-series performance data */
  data: Array<{
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  /** Date range for x-axis */
  dateRange: { from: string; to: string };
  /** Accessible summary */
  ariaSummary: string;
}
```

### Render Contract

- **Visual output:** Combined chart: bar chart for impressions/clicks, line overlay for CTR. Dual y-axes (count left, percentage right). Tooltip on hover with all three metrics.
- **Slots/children:** None
- **Conditional rendering:** "No data yet" if data array is empty

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| (none) | -- | Read-only display |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus chart region |
| Arrow Left/Right | Navigate data points |

### States
- **Default:** Chart with performance data
- **Loading:** Skeleton chart placeholder
- **Disabled:** N/A
- **Error:** "Unable to load performance data" placeholder
- **Success:** N/A

### Should Contain
- Dual-axis chart rendering
- Tooltip with formatted values
- Accessible data table fallback

### Should NOT Contain
- Data fetching
- Date range management

### Reuse Notes
- Performance chart pattern adaptable for other metrics (events, training)

---

## Component: CampaignStatusActions

**Purpose:** Contextual action buttons for campaign state transitions
**Used In:** Campaign Detail
**WAI-ARIA Pattern:** toolbar
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

### TypeScript Props Interface

```typescript
interface CampaignStatusActionsProps {
  /** Current campaign status */
  status: "draft" | "pending_review" | "active" | "paused" | "completed" | "rejected";
  /** Whether campaign has at least one approved creative */
  hasApprovedCreative: boolean;
  /** Callback fired when status action taken */
  onStatusChange: (newStatus: "active" | "paused" | "completed") => void;
  /** Whether action is in progress */
  isUpdating: boolean;
}
```

### Render Contract

- **Visual output:** Action buttons based on current status:
  - draft + hasApprovedCreative: "Activate" (primary)
  - draft + !hasApprovedCreative: "Activate" (disabled) + tooltip "Approve at least one creative first"
  - active: "Pause" + "Complete"
  - paused: "Resume" + "Complete"
  - completed: no actions (terminal)
  - rejected: no actions (terminal)
- **Slots/children:** None
- **Conditional rendering:** Only valid transition buttons shown

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onStatusChange | `(newStatus: string) => void` | Status transition requested |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus action buttons |
| Enter/Space | Activate focused button |

### States
- **Default:** Contextual buttons for current status
- **Loading:** Active button shows spinner
- **Disabled:** Activate disabled without approved creative; terminal states show no buttons
- **Error:** Sonner toast "Failed to update campaign status"
- **Success:** Sonner toast "Campaign {action}" + status badge updates

### Should Contain
- Valid transition calculation from current status
- Conditional button rendering
- Confirmation for terminal actions (complete)

### Should NOT Contain
- Campaign update API calls
- Business rule validation beyond display logic

### Reuse Notes
- State-machine-driven action pattern reusable for other entities with lifecycle states

---

## Component: AdReportButton

**Purpose:** Allow members to report an inappropriate or misleading ad
**Used In:** Ad display components (feed banner, sidebar, etc.)
**WAI-ARIA Pattern:** none (button + dialog)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface AdReportButtonProps {
  /** Creative ID to report */
  creativeId: string;
  /** Callback fired on report submission */
  onReport: (creativeId: string, reason: string) => void;
  /** Whether report is submitting */
  isSubmitting: boolean;
}
```

### Render Contract

- **Visual output:** Small "Report ad" link/icon button. Opens report dialog with reason textarea.
- **Slots/children:** None
- **Conditional rendering:** Report dialog only when triggered

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onReport | `(creativeId: string, reason: string) => void` | Report submitted |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Enter/Space | Open report dialog |
| Escape | Close dialog |

### States
- **Default:** "Report ad" link
- **Loading:** Submit spinner in dialog
- **Disabled:** N/A
- **Error:** "Failed to submit report" toast
- **Success:** Dialog closes, toast "Ad reported. We'll review it."

### Should Contain
- Report dialog trigger
- Reason input

### Should NOT Contain
- Report API calls
- Moderation logic

### Reuse Notes
- Pattern reusable for any content reporting (shared with M13 ReportPostDialog pattern)
