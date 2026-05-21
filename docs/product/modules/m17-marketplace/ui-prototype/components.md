<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M17 Marketplace -- Component Specifications

## Component Index

| Component ID | Name | Used In |
|-------------|------|---------|
| M17-C01 | ListingCard | M17-S01 |
| M17-C02 | ListingDetail | M17-S02 |
| M17-C03 | OrderForm | M17-S02 |
| M17-C04 | VendorRegistrationForm | M17-S03 |
| M17-C05 | VendorStatusBanner | M17-S04, M17-S07 |
| M17-C06 | ListingEditorForm | M17-S05 |
| M17-C07 | OrderTable | M17-S06, M17-S07 |
| M17-C08 | OrderStatusBadge | M17-S06, M17-S07 |
| M17-C09 | VendorTable | M17-S08 |
| M17-C10 | VendorActionToolbar | M17-S09 |
| M17-C11 | MarketplaceFilterBar | M17-S01 |
| M17-C12 | CategoryBadge | M17-S01, M17-S02, M17-S05 |
| M17-C13 | VendorVerifiedBadge | M17-S01, M17-S02 |

---

## M17-C01: ListingCard

### TypeScript Props

```typescript
interface ListingCardProps {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorVerified: boolean;
  title: string;
  description: string;
  price: number;
  currency: string;
  categoryTags: string[] | null;
  imageUrl: string | null;
  createdAt: string;
}
```

### WAI-ARIA Pattern

- Role: `article` with `aria-labelledby="listing-title-{id}"`
- Image: `role="img"` with `aria-label="{title}"` or decorative `aria-hidden="true"` for placeholder
- Price: `aria-label="Price: {formatted price}"`
- Verified badge: `aria-label="Verified vendor"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter/Space | Navigate to listing detail |
| Tab | Move focus to next card |

### Render Contract

| Condition | Renders |
|-----------|---------|
| imageUrl is null | Placeholder illustration |
| categoryTags is null or empty | No tags section |
| description > 120 chars | Truncated with ellipsis |
| vendorVerified is true | Green checkmark badge |

---

## M17-C02: ListingDetail

### TypeScript Props

```typescript
interface ListingDetailProps {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorVerified: boolean;
  title: string;
  description: string;
  price: number;
  currency: string;
  categoryTags: string[] | null;
  imageUrl: string | null;
  status: "active" | "inactive";
  createdAt: string;
  canOrder: boolean;
  isOwnListing: boolean;
}
```

### WAI-ARIA Pattern

- Container: `article` with `aria-labelledby="listing-title"`
- Sections use `aria-label` for screen reader navigation
- Price: `aria-label="Price: {formatted}"`

### Render Contract

| Condition | Renders |
|-----------|---------|
| canOrder is true | OrderForm below detail |
| isOwnListing is true | "Edit Listing" button instead of OrderForm |
| status is "inactive" | "Unavailable" banner, no order form |
| categoryTags is null | No tags section |

---

## M17-C03: OrderForm

### TypeScript Props

```typescript
interface OrderFormProps {
  listingId: string;
  maxQuantity?: number;
  onSuccess: (orderId: string) => void;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Place order"`
- Quantity: `aria-label="Quantity"`, `aria-required="false"`
- Notes: `aria-label="Order notes (optional)"`
- Submit: `aria-disabled` when submitting
- Error summary: `role="alert"` with `aria-live="assertive"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle: quantity -> notes -> submit |
| Enter | Submit form (when submit focused) |
| Escape | Clear form |

### Render Contract

| Condition | Renders |
|-----------|---------|
| isSubmitting | Spinner on button, all fields disabled |
| validationErrors | Inline error messages below fields |
| success | sonner toast, callback invoked |
| M17-002 error | "This listing is no longer available." alert |

---

## M17-C04: VendorRegistrationForm

### TypeScript Props

```typescript
interface VendorRegistrationFormProps {
  onSuccess: (vendorId: string) => void;
  existingVendor?: { id: string; verificationStatus: string } | null;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Vendor registration form"`
- Required fields: `aria-required="true"`
- Error summary: `role="alert"` at top of form
- Field errors: `aria-describedby="error-{fieldName}"`
- Success: `role="status"` with `aria-live="polite"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through fields in order |
| Enter | Submit form |
| Escape | Cancel (navigate back) |

### Render Contract

| Condition | Renders |
|-----------|---------|
| existingVendor is not null | "Already registered" message with dashboard link |
| isSubmitting | Spinner, fields disabled |
| CONFLICT-002 error | "A vendor with this email already exists." inline |
| success | sonner toast "Registration submitted." |

---

## M17-C05: VendorStatusBanner

### TypeScript Props

```typescript
interface VendorStatusBannerProps {
  verificationStatus: "pending" | "verified" | "suspended" | "rejected";
  businessName: string;
}
```

### WAI-ARIA Pattern

- Container: `role="status"` with `aria-live="polite"`
- Icon: `aria-hidden="true"` (decorative)

### Render Contract

| Status | Variant | Message |
|--------|---------|---------|
| pending | Warning (amber) | "Your vendor application is under review." |
| verified | Success (green) | "Verified vendor" |
| suspended | Destructive (red) | "Your vendor account has been suspended. Contact support." |
| rejected | Destructive (red) | "Your vendor application was rejected." |

---

## M17-C06: ListingEditorForm

### TypeScript Props

```typescript
interface ListingEditorFormProps {
  vendorId: string;
  listing?: {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    categoryTags: string[] | null;
    status: "draft" | "active";
  } | null;
  onSuccess: () => void;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Create listing"` or `"Edit listing"`
- Required fields: `aria-required="true"`
- Tag input: `aria-label="Category tags"`, `role="listbox"` for tag suggestions
- Status radios: `role="radiogroup"` with `aria-label="Listing status"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through fields |
| Enter (in tag input) | Add tag |
| Backspace (in tag input, empty) | Remove last tag |
| Arrow keys (in radio group) | Switch status |
| Enter | Submit form |

### Render Contract

| Condition | Renders |
|-----------|---------|
| listing is null | Create mode: empty form, defaults |
| listing is present | Edit mode: populated fields |
| categoryTags count >= 10 | Tag input disabled |
| M17-001 error | "Vendor not verified" alert |
| M17-003 error | "Vendor suspended" alert |

---

## M17-C07: OrderTable

### TypeScript Props

```typescript
interface OrderTableProps {
  orders: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    vendorId: string;
    vendorName: string;
    buyerPersonId: string;
    buyerName?: string;
    quantity: number;
    totalPrice: number;
    currency: string;
    status: "pending" | "confirmed" | "fulfilled" | "cancelled" | "refunded";
    createdAt: string;
    fulfilledAt: string | null;
    notes: string | null;
  }>;
  variant: "buyer" | "vendor";
  onStatusChange?: (orderId: string, newStatus: string) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}
```

### WAI-ARIA Pattern

- Table: `role="table"` with `aria-label="Order history"` or `"Orders received"`
- Sort headers: `aria-sort="ascending"` or `"descending"` or `"none"`
- Status badges: `aria-label="{status}"` on each badge
- Action buttons: `aria-label="Confirm order for {listingTitle}"` etc.
- Empty: `role="status"` with `aria-live="polite"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move through sortable headers, then rows, then actions |
| Enter/Space (on header) | Toggle sort |
| Enter/Space (on action) | Trigger action |

### Render Contract

| Condition | Renders |
|-----------|---------|
| variant is "buyer" | No action column, shows vendor name |
| variant is "vendor" | Action column per status, shows buyer name |
| isLoading | Skeleton rows (5) |
| orders.length is 0 | Empty state message |
| hasMore is true | "Load more" button below table |

---

## M17-C08: OrderStatusBadge

### TypeScript Props

```typescript
interface OrderStatusBadgeProps {
  status: "pending" | "confirmed" | "fulfilled" | "cancelled" | "refunded";
}
```

### Render Contract

| Status | Color | Icon |
|--------|-------|------|
| pending | Amber | Clock |
| confirmed | Blue | Check |
| fulfilled | Green | Package |
| cancelled | Gray | X |
| refunded | Red | ArrowLeft |

---

## M17-C09: VendorTable

### TypeScript Props

```typescript
interface VendorTableProps {
  vendors: Array<{
    id: string;
    businessName: string;
    category: string;
    contactEmail: string;
    verificationStatus: "pending" | "verified" | "suspended" | "rejected";
    createdAt: string;
  }>;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}
```

### WAI-ARIA Pattern

- Table: `role="table"` with `aria-label="Vendor list"`
- Status badges: `aria-label="{status}"`
- Business name links: navigate to admin vendor detail

### Render Contract

| Condition | Renders |
|-----------|---------|
| isLoading | Skeleton rows (5) |
| vendors.length is 0 | "No vendors registered." |
| hasMore | "Load more" button |

---

## M17-C10: VendorActionToolbar

### TypeScript Props

```typescript
interface VendorActionToolbarProps {
  vendorId: string;
  businessName: string;
  currentStatus: "pending" | "verified" | "suspended" | "rejected";
  onStatusChange: (newStatus: string) => void;
}
```

### WAI-ARIA Pattern

- Toolbar: `role="toolbar"` with `aria-label="Vendor actions"`
- Buttons: `aria-label="Verify {businessName}"` etc.
- Confirmation dialog: `role="alertdialog"` with `aria-labelledby` and `aria-describedby`
- Destructive actions (reject, suspend): `aria-label` includes consequence

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Move between action buttons |
| Enter/Space | Open confirmation dialog |
| Escape (in dialog) | Cancel action |
| Enter (in dialog) | Confirm action |

### Render Contract

| Current Status | Buttons Shown |
|----------------|---------------|
| pending | Verify (primary), Reject (destructive) |
| verified | Suspend (destructive) |
| suspended | Reinstate (primary) |
| rejected | None (terminal) |

---

## M17-C11: MarketplaceFilterBar

### TypeScript Props

```typescript
interface MarketplaceFilterBarProps {
  filters: {
    search: string;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
    sort: string;
  };
  onFilterChange: (filters: MarketplaceFilterBarProps["filters"]) => void;
  resultCount: number;
}
```

### WAI-ARIA Pattern

- Form: `role="search"` with `aria-label="Filter marketplace listings"`
- Search input: `aria-label="Search marketplace"`
- Result count: `role="status"` with `aria-live="polite"`
- Clear filters: `aria-label="Clear all filters"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter (in search) | Apply search |
| Escape (in search) | Clear search field |
| Tab | Cycle through filter controls |

### Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| >= 768px | Inline horizontal bar |
| < 768px | "Filters" button opens bottom sheet |

---

## M17-C12: CategoryBadge

### TypeScript Props

```typescript
interface CategoryBadgeProps {
  tag: string;
  removable?: boolean;
  onRemove?: () => void;
}
```

### WAI-ARIA Pattern

- Badge: `role="listitem"` inside a `role="list"` container
- Remove button (when removable): `aria-label="Remove {tag}"`

---

## M17-C13: VendorVerifiedBadge

### TypeScript Props

```typescript
interface VendorVerifiedBadgeProps {
  verified: boolean;
}
```

### WAI-ARIA Pattern

- Badge: `aria-label="Verified vendor"` when true
- Hidden when verified is false (only verified vendors appear in browse)
