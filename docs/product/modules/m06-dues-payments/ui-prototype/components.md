<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint --- Components: Dues & Payments (M06)

> Reusable components for the Dues & Payments module. Built on Radix UI (shadcn) primitives.

---

## Component 1: PaymentStatusBadge

**Purpose:** Color-coded badge showing payment status.

### TypeScript Props Interface

```typescript
interface PaymentStatusBadgeProps {
  status: DuesPaymentStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

type DuesPaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "partiallyRefunded"
  | "expired"
  | "submitted"
  | "underReview"
  | "confirmed"
  | "rejected";
```

### WAI-ARIA Pattern

- **Pattern:** Status indicator
- **Attributes:** `aria-label="Payment status: [status]"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| N/A | Non-interactive |

### Render Contract

| Status | Color | Icon | Label |
|--------|-------|------|-------|
| pending | yellow-500 | Clock | Pending |
| completed | green-500 | CheckCircle | Completed |
| failed | red-500 | XCircle | Failed |
| refunded | blue-500 | RotateCcw | Refunded |
| partiallyRefunded | blue-300 | RotateCcw | Partial Refund |
| expired | gray-400 | Timer | Expired |
| submitted | yellow-300 | Upload | Submitted |
| underReview | orange-500 | Eye | Under Review |
| confirmed | green-500 | CheckCircle | Confirmed |
| rejected | red-500 | XCircle | Rejected |

### Events

None (non-interactive).

### States

- **Default:** Badge with color + icon + optional label
- **Skeleton:** Gray rounded rectangle

---

## Component 2: CollectionRateCard

**Purpose:** Summary stat card showing collection rate percentage with visual indicator.

### TypeScript Props Interface

```typescript
interface CollectionRateCardProps {
  /** 0-1 decimal */
  rate: number;
  /** Total collected amount */
  totalCollected: string;
  /** Total outstanding amount */
  totalOutstanding: string;
  /** Currency code */
  currency: string;
  /** Period label */
  period: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Meter](https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
- **Attributes:** `role="meter"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Collection rate"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| N/A | Non-interactive display |

### Render Contract

- Large percentage number (color-coded: green > 80%, yellow 50-80%, red < 50%)
- Circular or bar progress indicator
- Collected vs outstanding amounts below
- Period label ("Jan - May 2026")

### Events

| Event | Payload | When |
|-------|---------|------|
| onClick | -- | Card clicked (navigate to detailed report) |

### States

- **Default:** Populated with data
- **Loading:** Skeleton circle + text lines
- **Zero:** "0%" with "No payments collected" subtitle

---

## Component 3: FundAllocationEditor

**Purpose:** Editable table for configuring fund splits with live sum validation.

### TypeScript Props Interface

```typescript
interface FundAllocationEditorProps {
  /** Current fund configuration */
  funds: FundConfig[];
  /** Change handler */
  onChange: (funds: FundConfig[]) => void;
  /** Save handler */
  onSave: () => void;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Saving state */
  isSaving: boolean;
}

interface FundConfig {
  id?: string;
  name: string;
  percentage: string;
  sortOrder: number;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/) with editable cells and [drag-and-drop](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) reordering
- **Attributes:**
  - Table: `role="table"`, `aria-label="Fund allocation configuration"`
  - Sum indicator: `role="status"`, `aria-live="polite"`
  - Drag handle: `aria-label="Reorder [fund name]"`, `aria-roledescription="sortable"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between editable cells |
| Enter | Save current cell, move to next |
| Delete | Remove fund row (with confirmation) |
| Space | Grab/drop drag handle |
| Arrow Up/Down | Move fund in sort order (when grabbed) |

### Render Contract

- Rows: drag handle | fund name input | percentage input | delete button
- Footer: sum indicator ("Total: 100.00%") with color (green = 100, red != 100)
- Add Fund button below table
- Save button (disabled if sum != 100 or no changes)

### Events

| Event | Payload | When |
|-------|---------|------|
| onChange | `FundConfig[]` | Any cell edited or row reordered |
| onSave | -- | Save clicked |
| onAdd | -- | Add Fund clicked |
| onRemove | `{ index: number }` | Delete clicked (after confirmation) |

### States

- **Empty:** "Add your first fund to configure dues allocation." + Add Fund button
- **Valid:** Sum = 100.00, save button enabled, indicator green
- **Invalid:** Sum != 100.00, save button disabled, indicator red with "Must total 100%"
- **Saving:** Inputs disabled, save button shows spinner
- **Saved:** sonner: "Fund allocation saved."

---

## Component 4: PaymentReceiptLink

**Purpose:** Inline receipt download link/button for payment records.

### TypeScript Props Interface

```typescript
interface PaymentReceiptLinkProps {
  /** Payment ID */
  paymentId: string;
  /** Organization ID */
  organizationId: string;
  /** Receipt number for display */
  receiptNumber: string;
  /** Compact mode (icon only) */
  compact?: boolean;
}
```

### WAI-ARIA Pattern

- **Pattern:** Link
- **Attributes:** `aria-label="Download receipt [receiptNumber]"`, `role="link"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Enter/Space | Trigger PDF download |
| Tab | Focus link |

### Render Contract

- Default: "[receiptNumber]" as clickable link with download icon
- Compact: Download icon only with tooltip

### Events

| Event | Payload | When |
|-------|---------|------|
| onDownload | `{ paymentId: string }` | Link activated |

### States

- **Default:** Clickable link
- **Downloading:** Spinner replaces icon
- **Error:** "Download failed" tooltip, retry on click

---

## Component 5: DuesPaymentCard

**Purpose:** One-tap payment card for the token-based payment flow.

### TypeScript Props Interface

```typescript
interface DuesPaymentCardProps {
  /** Payment token data */
  paymentData: TokenPaymentData;
  /** Pay action handler */
  onPay: () => void;
  /** Current processing state */
  state: "ready" | "processing" | "success" | "failed" | "expired" | "alreadyPaid";
}

interface TokenPaymentData {
  organizationName: string;
  memberName: string;
  duesAmount: string;
  currency: string;
  dueDate: string;
  checkoutUrl: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** Card with primary action
- **Attributes:** `role="region"`, `aria-label="Pay dues for [organizationName]"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Focus pay button |
| Enter/Space | Initiate payment |

### Render Contract

- Org logo/name header
- "Hello, [memberName]" greeting
- Amount display (large, prominent)
- Due date and new expiry date info
- Pay Now button (primary, full-width)

### Events

| Event | Payload | When |
|-------|---------|------|
| onPay | -- | Pay button clicked |

### States

- **Ready:** Full payment card with Pay Now enabled
- **Processing:** "Payment processing..." with spinner, polling indicator
- **Success:** Green checkmark, receipt download link, "Active through [date]"
- **Failed:** "Payment failed. Try again." + Retry button
- **Expired:** "This payment link has expired." + Login link
- **AlreadyPaid:** "Your dues are current through [date]." Green status

---

## Component 6: AgingReportChart

**Purpose:** Visual display of outstanding dues by aging bucket.

### TypeScript Props Interface

```typescript
interface AgingReportChartProps {
  /** Aging bucket data */
  buckets: AgingBucket[];
  /** Currency code */
  currency: string;
  /** Click handler for bucket drill-down */
  onBucketClick?: (bucket: string) => void;
}

interface AgingBucket {
  label: string;
  dayRange: string;
  count: number;
  amount: string;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Figure](https://www.w3.org/WAI/ARIA/apg/patterns/) with accessible data
- **Attributes:** `role="figure"`, `aria-label="Dues aging report"`. Each bar: `role="img"`, `aria-label="[range]: [count] members, [amount]"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between bars |
| Enter | Drill down into bucket (show member list) |

### Render Contract

- Horizontal bar chart: 30-day / 60-day / 90-day / 120+ day buckets
- Each bar: color-coded (yellow -> orange -> red -> dark red)
- Label: member count + amount per bucket
- Optional: table fallback for screen readers

### Events

| Event | Payload | When |
|-------|---------|------|
| onBucketClick | `{ bucket: string }` | Bar clicked |

### States

- **Default:** Chart with data
- **Empty:** "No outstanding dues." (all buckets zero)
- **Loading:** Skeleton bars
- **Accessible:** Hidden data table available via screen reader

---

## Component 7: DuplicatePaymentWarning

**Purpose:** Warning dialog when concurrent payment detected (M6-R4).

### TypeScript Props Interface

```typescript
interface DuplicatePaymentWarningProps {
  /** Existing recent payment info */
  existingPayment: {
    amount: string;
    recordedBy: string;
    recordedAt: string;
  };
  /** Continue handler */
  onContinue: () => void;
  /** Cancel handler */
  onCancel: () => void;
}
```

### WAI-ARIA Pattern

- **Pattern:** [Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
- **Attributes:** `role="alertdialog"`, `aria-labelledby="duplicate-warning-title"`, `aria-describedby="duplicate-warning-desc"`

### Keyboard Interaction

| Key | Action |
|-----|--------|
| Tab | Move between Cancel and Continue |
| Enter | Activate focused button |
| Escape | Cancel (dismiss dialog) |

### Render Contract

- Warning icon (amber)
- Title: "Possible Duplicate Payment"
- Description: "A payment of [amount] was recorded for this member [time] ago by [officer]. Continue?"
- Cancel (default focus) + Continue buttons

### Events

| Event | Payload | When |
|-------|---------|------|
| onContinue | -- | User confirms proceed |
| onCancel | -- | User cancels |

### States

- **Open:** Dialog visible, focus trapped
- **Closed:** Dialog hidden
