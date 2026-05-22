<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Screens: Dues & Payments (M06)

> Tech: React 19, TanStack Router, TanStack Query, Radix UI (shadcn), Tailwind CSS, sonner toasts
> Apps: memberry (3004) for officer/member screens

---

## Screen 1: Financial Dashboard

**Route:** `/org/[organizationId]/officer/payments`
**Purpose:** Collection overview, pending payments, action cards, aging summary
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Financial Dashboard" |
| Summary cards | `region` | "Financial summary" |
| Pending table | `table` | "Pending payments" |
| Action cards | `region` | "Action items" |
| Aging summary | `region` | "Aging report" |

### Focus Management

- Page load: focus on first summary card
- After recording payment: focus on sonner toast, then pending table
- Tab order: summary cards -> action cards -> pending table -> aging summary

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| collectionRate | percentage | GET /org/:id/reports/financial?type=collection | Large stat card | Primary metric |
| totalCollectedYTD | currency | GET /org/:id/reports/financial?type=collection | Stat card | PHP formatted |
| outstandingAmount | currency | GET /org/:id/reports/financial?type=collection | Stat card | Red if > 0 |
| pendingPayments | array | Internal query | Table rows | Status, member, amount, date |
| agingBuckets | object | GET /org/:id/reports/financial?type=aging | Bar chart or table | 30/60/90/120+ days |
| overdueCount | integer | Computed | Action card | "N members overdue" |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Record manual payment | Button click | Navigate to payment form | Treasurer, President (2FA) | Page transition |
| View payment details | Row click | Navigate to payment detail | Treasurer, President (2FA) | Page transition |
| Generate report | Button click | GET /org/:id/reports/financial | Treasurer, President (2FA) | Report renders inline or downloads |
| Send overdue reminders | Action card click | POST via M07 | Treasurer, President (2FA) | sonner: "Reminders sent to N members" |

### Role-Variant Matrix

| Element | President | Treasurer | Secretary | Officer | Member |
|---------|-----------|-----------|-----------|---------|--------|
| View dashboard | Yes (2FA) | Yes (2FA) | -- | -- | -- |
| Record payment | Yes (2FA) | Yes (2FA) | -- | -- | -- |
| Generate report | Yes (2FA) | Yes (2FA) | -- | -- | -- |
| Send reminders | Yes (2FA) | Yes (2FA) | -- | -- | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | 3-column stat cards + table below | Full table, aging chart beside |
| 768-1023px (md) | 2-column stat cards, table scrolls | Aging below table |
| < 768px (sm) | Stacked stat cards, card list for pending | Aging as simple list |

### Interaction States

1. **Loading:** Skeleton stat cards (3) + skeleton table (5 rows). `aria-busy="true"`.
2. **Empty (NoGateway):** Setup banner: "Configure your payment gateway to start collecting dues online." CTA: "Set Up Payments" -> gateway config.
3. **Empty (NoPayments):** "No payments recorded yet. Record your first payment or set up online collection." CTAs: Record Payment, Configure Gateway.
4. **Success:** Populated cards and table. Collection rate color-coded (green > 80%, yellow 50-80%, red < 50%).
5. **Validation Error:** N/A for dashboard.
6. **Permission Error:** "Financial data requires Treasurer or President role with two-factor authentication."
7. **Unexpected Error:** "Couldn't load financial data." + Retry button.
8. **Conflict/Duplicate:** N/A for dashboard.
9. **Confirmation/Warning:** Send reminders: "Send overdue reminder to N members?" [Cancel] [Send].
10. **Offline/Sync:** "You're offline. Financial data may be stale." Dashboard read-only.

---

## Screen 2: Pay Dues (Token-Based)

**Route:** `/pay/[token]`
**Purpose:** One-tap payment from reminder link (no login required)
**App:** memberry (3004) -- public route

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Pay Dues" |
| Payment card | `region` | "Payment details" |
| Action | `region` | "Payment action" |

### Focus Management

- Page load: focus on payment summary card
- After Pay Now: focus on processing spinner
- Success: focus on receipt download link
- Error: focus on error message with retry option

### Fields

| Field | Type | Source | Display | Notes |
|-------|------|--------|---------|-------|
| organizationName | text | GET /pay/:token | Header | Org logo if available |
| memberName | text | GET /pay/:token | Subtitle | "Hello, [name]" |
| duesAmount | currency | GET /pay/:token | Large amount | PHP formatted |
| currency | text | GET /pay/:token | Beside amount | ISO 4217 |
| dueDate | date | GET /pay/:token | Info row | "Due by [date]" |
| newExpiryDate | date | Computed | Info row | "Active through [date] after payment" |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Pay Now | Button click | Redirect to checkoutUrl | Token-based (no login) | Redirect to gateway |
| Return from gateway | Redirect back | Poll payment status | Token-based | Processing spinner -> success/fail |
| Download receipt | Link click | GET /org/:id/payments/:id/receipt | Token-based | PDF download |

### Role-Variant Matrix

| Element | Any Token Holder |
|---------|-----------------|
| View payment details | Yes |
| Pay | Yes |
| Download receipt | Yes (after payment) |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 768px (md) | Centered card (max-w-md) | Full layout |
| < 768px (sm) | Full-width card | Pay button sticky bottom |

### Interaction States

1. **Loading:** Skeleton card with amount placeholder. Spinner overlay.
2. **Empty (ValidToken):** Payment form with amount, member name, Pay Now button.
3. **Success:** Green checkmark. "Payment successful! Your dues are current through [date]." Receipt download link.
4. **Validation Error:** N/A.
5. **Permission Error:** N/A (token-based, no roles).
6. **Unexpected Error:** "Payment failed. Try again or contact your treasurer." Retry button.
7. **Conflict/Duplicate (AlreadyPaid):** "Your dues are current through [date]. No payment needed." Green status.
8. **Confirmation/Warning (ExpiredToken):** "This payment link has expired. Log in to pay your dues." Link to /auth/sign-in.
9. **Offline/Sync (GatewayUnavailable):** "Online payment temporarily unavailable. Please try again later."

**Processing State:** "Payment processing... This usually takes a few minutes." Polling spinner with auto-refresh every 3s, timeout at 60s.

---

## Screen 3: Dues Configuration

**Route:** `/org/[organizationId]/officer/settings/dues`
**Purpose:** Configure dues amounts, billing cycle, grace period, fund splits
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "Dues Configuration" |
| Dues form | `form` | "Dues settings" |
| Category overrides | `table` | "Category-specific amounts" |
| Fund allocation | `table` | "Fund allocation" |
| Fund sum | `status` | "Fund allocation total" |

### Focus Management

- Page load: focus on dues amount field
- After save: focus on sonner success toast
- Validation error: focus on first invalid field
- Fund allocation error: focus on percentage sum indicator

### Fields

| Field | Type | Source | Display | Editable | Validation |
|-------|------|--------|---------|----------|------------|
| duesAmount | decimal | PUT /org/:id/config/dues | Currency input | Yes | Positive, > 0 |
| billingFrequency | enum | PUT /org/:id/config/dues | Dropdown | Yes | annual/semi-annual/quarterly |
| gracePeriodDays | integer | PUT /org/:id/config/dues | Slider (0-90) | Yes | 0-90, default 30 |
| categoryOverrides | array | PUT /org/:id/config/dues | Editable table | Yes | Category + amount pairs |
| funds[].name | text | PUT /org/:id/config/funds | Text input | Yes | Max 100 chars |
| funds[].percentage | decimal | PUT /org/:id/config/funds | Number input | Yes | 0.01-100.00, sum = 100 |
| funds[].sortOrder | integer | PUT /org/:id/config/funds | Drag handle | Yes | Auto-assigned |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Save dues config | Button click | PUT /org/:id/config/dues | Treasurer, President (2FA) | sonner: "Dues configuration saved." |
| Save fund allocation | Button click | PUT /org/:id/config/funds | Treasurer, President (2FA) | sonner: "Fund allocation saved." |
| Add category override | Row add button | Local state | Treasurer, President (2FA) | New row in table |
| Remove category override | Row delete button | Local state | Treasurer, President (2FA) | Row removed |
| Add fund | Button click | Local state | Treasurer, President (2FA) | New row in fund table |
| Remove fund | Row delete button | Local state | Treasurer, President (2FA) | Row removed |
| Reorder funds | Drag-and-drop | Local state | Treasurer, President (2FA) | Sort order updated |

### Role-Variant Matrix

| Element | President | Treasurer | All Others |
|---------|-----------|-----------|------------|
| View config | Yes (2FA) | Yes (2FA) | Redirect with permission error |
| Edit config | Yes (2FA) | Yes (2FA) | -- |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Two-column: dues config left, funds right | All fields visible |
| 768-1023px (md) | Single column, dues above funds | Full-width tables |
| < 768px (sm) | Stacked sections, compact tables | Drag handles replaced with up/down buttons |

### Interaction States

1. **Loading:** Skeleton form fields + tables. `aria-busy="true"`.
2. **Empty:** First-time setup wizard: "Set up your organization's dues collection." Step-by-step guide.
3. **Success:** Populated form with current values. Save buttons enabled on change.
4. **Validation Error:** Fund sum != 100: live indicator turns red "Total: 97% (must be 100%)". Invalid amount: red border + "Amount must be positive." Grace period out of range: slider clamped.
5. **Permission Error:** "Dues configuration requires Treasurer or President role with two-factor authentication."
6. **Unexpected Error:** "Couldn't save configuration." + Retry button. Form state preserved.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** Save with existing active invoices: "Changing dues configuration will affect future invoices only. Existing invoices are not modified." [Cancel] [Save].
9. **Offline/Sync:** "Configuration changes require an internet connection." Form read-only.

### Validation Rules

- Dues amount: positive decimal
- Grace period: 0-90 integer
- Fund percentages: must sum to exactly 100.00 (M6-R1)
- Category overrides: category must be active tier from M05
- At least 1 fund required

---

## Screen 4: Payment History (Member)

**Route:** `/me/payments`
**Purpose:** Member views own payment history across all orgs
**App:** memberry (3004)

### ARIA Landmarks

| Landmark | Role | Label |
|----------|------|-------|
| Page | `main` | "My Payments" |
| Filters | `region` | "Payment filters" |
| Payment list | `table` | "Payment history" |

### Focus Management

- Page load: focus on first payment row (if any) or empty state
- After filter change: focus on first result

### Fields

| Field | Type | Source | Display | Sortable |
|-------|------|--------|---------|----------|
| organizationName | text | GET /my/payments | Org badge | No |
| amount | currency | GET /my/payments | PHP formatted | No |
| currency | text | GET /my/payments | Inline with amount | No |
| status | enum | GET /my/payments | Status badge | No |
| paymentMethod | enum | GET /my/payments | Method icon + label | No |
| receiptNumber | text | GET /my/payments | Link | No |
| paidAt | date-time | GET /my/payments | Formatted date | Default desc |

### Actions

| Action | Trigger | API Call | Auth | Feedback |
|--------|---------|----------|------|----------|
| Filter by org | Dropdown change | GET /my/payments?organizationId= | Authenticated | List updates |
| Filter by date range | Date picker | GET /my/payments?from=&to= | Authenticated | List updates |
| Filter by status | Dropdown | GET /my/payments?status= | Authenticated | List updates |
| Download receipt | Link click | GET /org/:id/payments/:id/receipt | Authenticated (own) | PDF download |

### Role-Variant Matrix

| Element | All Authenticated Members |
|---------|--------------------------|
| View own payments | Yes |
| Download own receipts | Yes |

### Responsive Breakpoints

| Breakpoint | Layout | Adaptations |
|------------|--------|-------------|
| >= 1024px (lg) | Full table with all columns | Filters inline |
| 768-1023px (md) | Table with horizontal scroll | Filters collapse |
| < 768px (sm) | Card list per payment | Amount + status + date per card |

### Interaction States

1. **Loading:** Skeleton table (5 rows). Filters disabled.
2. **Empty:** "No payment history yet." If member has active membership: "Your dues status is shown on your dashboard."
3. **Success:** Populated table with receipt links. Status badges: green (completed), gray (pending), red (failed), blue (refunded).
4. **Validation Error:** N/A.
5. **Permission Error:** N/A (own data only, any authenticated user).
6. **Unexpected Error:** "Couldn't load payment history." + Retry.
7. **Conflict/Duplicate:** N/A.
8. **Confirmation/Warning:** N/A.
9. **Offline/Sync:** Cached payment list shown. "You're offline." Download buttons disabled.
