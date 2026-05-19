# Module 6: Dues & Payments

## Overview

| Attribute | Detail |
|---|---|
| **Purpose** | Collect, allocate, track, and report on membership dues and activity fees. This is the financial engine of the platform -- it handles online payments, manual payment recording, fund allocation, refunds, automated reminders, gateway configuration, and financial reporting. Highest-complexity module in the system. |
| **Phase** | 1 |
| **Monetization Tier** | Standard |
| **Dependencies** | M01 (Auth & Onboarding), M04 (Org Admin), M05 (Membership) |
| **Key Actors** | Treasurer, President, Officers, Member, System |

---

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|---|---|---|---|
| 6.1 | Online dues payment | Member pays through org's connected payment gateway. Flow: see amount -> Pay Now -> gateway checkout -> webhook confirms -> `dues_expiry_date` updated -> receipt generated. | Member | P0 |
| 6.2 | Activity fee payment | For paid events/trainings, member pays registration fee through same org gateway. Payment confirms registration. | Member | P0 |
| 6.3 | Fund allocation execution | On each dues payment, system automatically splits amount into configured funds. Percentages must total 100%. Last fund absorbs rounding remainder. If no funds configured, entire amount goes to default "General Fund". | System | P0 |
| 6.4 | Payment receipt | After confirmation, PDF receipt generated and emailed. Includes: org name + logo, member name, amount, date, method, reference number, fund allocation breakdown, receipt number. Downloadable from payment history. | System | P0 |
| 6.5 | Manual payment recording | Treasurer records offline payment (cash, check, bank transfer, GCash). Enters: member, amount, method, reference number, date. Triggers same fund split and membership extension. Receipt marked "Manually Recorded". Requires confirmation dialog. | Treasurer | P0 |
| 6.6 | Dues categories with rates | Different categories have different rates. When category changes, next dues amount reflects new rate. Rates configured in M04/M05. | Officer | P0 |
| 6.7 | Payment history | Member views own history: date, amount, org, method, receipt link. Officer views any member's history. Filterable by date, method, status. | Member, Officer | P0 |
| 6.8 | Financial reports | Collection summary, fund allocation breakdown, member dues status, aging report. All exportable as CSV and PDF. | Treasurer | P0 |
| 6.9 | Webhook payment confirmation | Gateway sends webhook on success. System processes idempotently (duplicate webhooks produce same result). Updates payment status, `dues_expiry_date`, triggers receipt. Processes webhook events via gateway-specific adapter. Each supported gateway (initially PayMongo and Stripe) implements a standard webhook interface. Adding a new gateway requires only a new adapter -- no changes to core payment logic. Failed webhooks retried by gateway; all webhook events logged. | System | P0 |
| 6.10 | Payment gateway setup | Treasurer connects org's payment gateway account (provider determined by association's country configuration, e.g., PayMongo for Philippines, Stripe for international). Not platform's account. Test transaction supported before going live. Gateway credentials stored encrypted. | Treasurer | P0 |
| 6.11 | Automated reminders | Configurable schedule: defaults 60, 30, 7 days before expiry; 7, 30 days after. Each reminder contains member name, org, amount, expiry date, and one-tap payment link. Schedule configurable per org. | System, Officer | P0 |
| 6.12 | Refunds | Treasurer initiates refund. Gateway processes refund. Fund allocation reversed. Refund status tracked (pending/completed/failed). Audit logged. Member notified. | Treasurer | P0 |
| 6.13 | Dues configuration | Treasurer sets: amount per category, frequency (annual/quarterly), grace period (days), due date (month/day for annual), per-category custom amounts. | Treasurer | P0 |

---

## User Journeys

### CT-1: Configure Dues

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens `/org/[id]/officer/settings/dues` | Dues configuration form | |
| 2 | Sets default dues amount | Amount field (currency-formatted) | |
| 3 | Sets billing frequency | Annual or Quarterly | |
| 4 | Optionally sets per-category overrides | Table of categories with amount field per row. Leave blank to use default. | |
| 5 | Sets due date | Month/day selector (e.g., "January 1" for annual) | |
| 6 | Sets grace period | Number input (0-365 days). Default: 30. | Value outside range: "Grace period must be 0-365 days" |
| 7 | Saves | Configuration saved. Applies to future dues cycles. Existing members' current terms unaffected. | |

### CT-2: Set Up Payment Gateway

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens `/org/[id]/officer/settings/gateway` | Gateway setup page | |
| 2 | Selects gateway provider | Available providers based on association's country config (e.g., PayMongo, Stripe). List is extensible. | |
| 3 | Enters API credentials | Secret key and public key fields (masked input) | |
| 4 | Clicks "Test Connection" | System makes a test API call to validate credentials | Invalid keys: "Connection failed. Please verify your API keys." |
| 5 | Optionally runs test transaction | Small amount (PHP 1.00) charged and immediately refunded | Test charge fails: "Test transaction failed. Check your gateway account status." |
| 6 | Confirms setup | Gateway activated. "Online payments are now enabled for your organization." | |
| 7 | Views gateway status | Status badge: Connected (green) / Disconnected (red). Last test date. | |

### CT-3: Record Manual Payment

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens "Record Payment" from finance section | Payment form | |
| 2 | Searches and selects member | Search by name or license# | Member not found: "Check spelling or add member first" |
| 3 | System shows member's current status and dues info | Category, current status, dues amount for category, expiry date | |
| 4 | Enters payment details | Amount (pre-filled with category dues amount), date, method (cash/check/bank transfer/GCash/other), reference number | |
| 5 | Reviews fund allocation preview | System shows how payment will be split across funds | |
| 6 | Confirmation dialog | "Record payment of [Amount] for [Member]? This will extend their membership to [New Expiry Date]." | |
| 7 | Confirms | Payment recorded. Fund allocations created. `dues_expiry_date` updated. Receipt generated (marked "Manually Recorded"). | Amount mismatch with category: warning "Amount differs from category rate of [X]. Continue?" -- allows override |
| 8 | Member receives notification | "Payment recorded by [Treasurer Name]. Receipt available." | |

### CT-4: Send Dues Reminders

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens members list filtered by status | Filters: Grace, Lapsed, Expiring within 30/60/90 days | |
| 2 | Selects members | Checkbox selection or "Select All" | |
| 3 | Clicks "Send Reminder" | Preview: "Send reminder to N members. Each will receive a personalized notification with payment link." | |
| 4 | Confirms | Reminders sent via configured channels (in-app always, push if enabled, email if opted in). Each contains one-tap payment link. | No email on file: in-app only. Opted out of email: in-app + push only. |
| 5 | Views delivery status | Sent count, delivered count, opened count | |

### CT-5: Process Refund

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens payment record for member | Payment detail with "Refund" button | Payment already refunded: button disabled |
| 2 | Clicks "Refund" | Refund form: full or partial amount, reason (required) | |
| 3 | Enters refund details | Amount (default: full payment amount), reason | Partial refund amount > original: "Refund cannot exceed original payment" |
| 4 | Confirmation dialog | "Refund [Amount] to [Member]? Fund allocations will be reversed. If this was a dues payment, membership status may change." | |
| 5 | Confirms | If online payment: refund initiated via gateway API. If manual payment: marked as refunded (no gateway action). | Gateway refund fails: "Refund failed. Gateway error: [message]. Retry?" |
| 6 | Fund allocation reversed | Each fund allocation record for this payment marked as reversed. New negative allocation records created. | |
| 7 | Status impact assessed | If refunded payment was the most recent dues payment, `dues_expiry_date` may need adjustment. System warns: "This member's dues status may change to [Lapsed/Grace]." | |
| 8 | Member notified | "Refund of [Amount] processed. Reference: [Ref#]." | |
| 9 | Audit log entry created | Refund amount, reason, treasurer, original payment reference, fund allocation reversal details. | |

### CT-6: Generate Financial Report

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens `/org/[id]/officer/reports/financial` | Report type selector | |
| 2 | Selects report type | Collection Summary / Fund Breakdown / Dues Status / Aging Report | |
| 3 | Sets date range | Start date, end date | End before start: "Invalid date range" |
| 4 | Optionally filters | By payment method, by category, by fund | |
| 5 | Generates report | Report rendered in-page with data tables and summary metrics | No data: "No payments recorded for this period." |
| 6 | Exports | CSV or PDF download | |

### M-13: Pay Dues Online

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1a | Receives reminder with payment link | One-tap: link opens `/pay/[token]` with amount pre-filled | Token expired (>30 days): redirect to login then payment |
| 1b | OR opens dashboard, clicks "Pay Dues" | Payment page with dues amount and org info | |
| 2 | Reviews payment details | Amount, org name, category, new expiry date after payment | |
| 3 | Clicks "Pay Now" | Redirected to gateway-hosted checkout page | Gateway not configured: "Online payment unavailable. Contact treasurer." with treasurer contact |
| 4 | Completes payment on gateway page | Selects method (GCash, Maya, card, bank transfer). Completes payment. | Payment fails on gateway: "Payment failed. Please try again or contact your bank." |
| 5 | Redirected back to platform | "Payment processing..." with polling indicator | |
| 6 | Webhook confirms payment | Payment status: completed. `dues_expiry_date` updated. Funds auto-split. Receipt generated. | Webhook delayed: status stays "pending" with message "Your payment is being confirmed. This usually takes a few minutes." |
| 7 | Success screen | Green checkmark. "Payment confirmed! Your membership is active until [date]." Receipt download button. | |
| 8 | Receipt emailed | PDF receipt sent to member's email | |

### M-14: View Payment History

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens dashboard > "Payment History" | List of all payments across all orgs | No payments: "No payment history yet." |
| 2 | Filters by org, date range, or status | Filtered results | |
| 3 | Views payment detail | Amount, date, method, fund breakdown, status, receipt link | |
| 4 | Downloads receipt | PDF receipt | |

---

## Business Rules

### Referenced Business Rules

| Rule ID | Name | Application in This Module |
|---|---|---|
| BR-04 | Dues Amount per Org | Each org configures its own dues amounts per membership category independently |
| BR-05 | Fund Allocation | Every dues payment split across configured funds. Percentages total 100%. Last fund absorbs rounding remainder. Fund allocations recorded immutably. |
| BR-06 | Payment Recording | Authorized officers record offline payments with: amount, method, reference, date, officer identity. Same fund split and membership extension as online. Clearly distinguished in reports. |
| BR-07 | Dues Expiry Extension on Payment | Recording a payment extends `dues_expiry_date` by one billing cycle from payment date |
| BR-08 | Refund Policy | Refunding a payment reverses the `dues_expiry_date` extension and may trigger status recomputation |
| BR-30 | Payment Gateway Isolation | Org connects its own payment gateway account (provider determined by country configuration). Platform never receives, holds, or routes member payments. Payments flow directly from member to org's account. |
| BR-32 | Financial Record Retention | Payment records retained for 7 years; soft-deleted members' payment records retained |

### Module-Specific Rules

**M6-R1: Fund Allocation Rounding**

Fund allocation uses currency-aware rounding with last-fund remainder absorption.

Algorithm:
1. For each fund except the last: `fund_amount = floor(payment_amount * fund_percentage / 100, currency_decimals)`
2. For the last fund: `last_fund_amount = payment_amount - sum(all_other_fund_amounts)`
3. Verify: `sum(all_fund_amounts) == payment_amount` (must be exact)

Currency decimal places:
- PHP: 2 decimals (centavos)
- USD: 2 decimals (cents)
- All others: follow ISO 4217

Examples:
| Payment | Funds | Allocation | Remainder Fund |
|---|---|---|---|
| PHP 1,500.00 | General 33%, Education 33%, Building 34% | G: 495.00, E: 495.00, B: 510.00 | Building absorbs +0.00 |
| PHP 1,000.00 | Fund A 33.33%, Fund B 33.33%, Fund C 33.34% | A: 333.30, B: 333.30, C: 333.40 | Fund C absorbs +0.10 |
| PHP 999.00 | X 50%, Y 50% | X: 499.50, Y: 499.50 | Exact split |
| PHP 1.00 | A 33%, B 33%, C 34% | A: 0.33, B: 0.33, C: 0.34 | C absorbs +0.01 |

Invariant: fund allocation must never cause money to appear or disappear. `sum(allocations) == payment_amount` always.

**M6-R2: Payment Status State Machine**

```
    +----------+
    | pending  |-------> completed -------> refunded
    +----------+              |                  ^
         |                    |                  |
         +-------> failed     +---> partially_refunded
         |
         +-------> expired (24hr timeout)
```

Valid states:
- **pending:** Payment initiated (checkout started or manual recording in progress). Online payments: awaiting webhook.
- **completed:** Webhook confirmed (online) or treasurer confirmed (manual). Membership extended. Funds allocated.
- **failed:** Gateway reported failure. No membership change. Member notified to retry.
- **expired:** Online payment pending for >24 hours with no webhook. Treasurer can manually confirm or void.
- **refunded:** Full refund processed. Fund allocations reversed.
- **partially_refunded:** Partial refund processed. Original allocations remain; refund allocations created as negative entries.

**M6-R3: Gateway Failure Handling**

| Scenario | System Behavior |
|---|---|
| Webhook never arrives within 24 hours | Payment stays "pending". After 24 hours, status transitions to "expired". Treasurer receives notification: "Payment [Ref#] from [Member] has been pending for 24 hours. Please verify in your gateway dashboard and manually confirm or void." |
| Gateway API unreachable during refund | Refund stays "pending". Retry button available. Treasurer notified. |
| Gateway API unreachable during checkout redirect | Member sees: "Payment service temporarily unavailable. Please try again in a few minutes." No payment record created. |
| Webhook arrives for unknown transaction ID | Logged as "Unmatched webhook event". No action taken. Alert sent to platform admin. |

**M6-R4: Concurrency -- Duplicate Payment Prevention**

If two treasurers attempt to record a manual payment for the same member simultaneously:
1. First recording succeeds normally.
2. Second recording, before confirmation, checks for recent payments for the same member in the same org within the last 5 minutes.
3. If found: warning displayed: "A payment of [Amount] was just recorded for [Member] by [Other Treasurer] at [Time]. Are you sure this is a separate payment?"
4. Treasurer can confirm (creating a second payment) or cancel.

For online payments: M6-R8 (idempotent webhook processing) prevents duplicate processing.

**M6-R5: Automated Reminder Schedule**

Default schedule (configurable per org):
| Trigger | Timing | Channel |
|---|---|---|
| Pre-expiry reminder 1 | 60 days before expiry | In-app + email (if opted in) |
| Pre-expiry reminder 2 | 30 days before expiry | In-app + push + email |
| Pre-expiry reminder 3 | 7 days before expiry | In-app + push + email |
| Day-of reminder | Day of expiry | In-app + push + email |
| Post-expiry reminder 1 | 7 days after expiry (Grace period) | In-app + push + email |
| Post-expiry reminder 2 | 30 days after expiry (Grace/Lapsed) | In-app + push + email |

Each reminder includes:
- Member name
- Organization name
- Amount due (based on member's category)
- Expiry date
- One-tap payment link (tokenized URL, valid 30 days, no login required for payment)

Life members (BR-01) are excluded from all reminders.

**M6-R6: Receipt Number Format**

Receipt numbers follow the format: `[ORG_CODE]-[YEAR]-[SEQUENTIAL_NUMBER]`

Example: `PDA-MNL-2026-00142`

Sequential numbers are per-org, per-year, and monotonically increasing. Gaps are acceptable (e.g., from voided payments) but duplicates are not.

**M6-R7: Financial Report Definitions**

| Report | Content | Filters |
|---|---|---|
| **Collection Summary** | Total collected, total outstanding, collection rate (%), trend chart (monthly). Breakdown by payment method (online vs. manual). | Date range, payment method |
| **Fund Allocation Breakdown** | Per-fund totals for selected period. Includes refund reversals as negative entries. Net total per fund. | Date range, specific fund |
| **Member Dues Status** | All members with: name, category, status (Active/Grace/Lapsed), expiry date, amount due (if not paid). | Status filter, category filter |
| **Aging Report** | Members grouped by overdue duration: 1-30 days, 31-60 days, 61-90 days, 90+ days. Count and total amount per bucket. | Date range |

All reports must be accurate to the centavo and must match actual gateway records. Reports exportable as CSV (raw data) and PDF (formatted).

**M6-R8: Idempotent Webhook Processing**
Duplicate webhook events are detected by gateway transaction/event ID. A duplicate is skipped and logged, and HTTP 200 is returned to the gateway. No duplicate payment records, fund splits, or membership extensions are created as a result of a duplicate webhook.

**M6-R9: Immutable Audit Trail**
All payment events are logged: creation, confirmation, refund, manual recording, and correction. Audit log entries are never modified or deleted after creation.

**M6-R10: Mandatory In-App Notifications**
All payment events generate in-app notifications. This channel cannot be disabled by the member or officer.

**M6-R11: Push Notification Defaults**
Payment confirmations and dues reminders are push-enabled by default. Members can toggle push notifications per category (e.g., disable push for reminders but keep for payment confirmations).

**M6-R12: Gateway Adapter Contract**

Each payment gateway is implemented as an adapter that conforms to this interface:

| Method | Purpose | Input | Output |
|---|---|---|---|
| createCheckout | Initiate a payment session | amount, currency, member reference, return URLs | checkout URL + gateway session ID |
| processWebhook | Parse and validate incoming webhook | raw request body, headers, gateway secret | normalized payment event (status, transaction ID, amount, metadata) |
| initiateRefund | Request a refund | gateway transaction ID, amount, reason | refund ID + status |
| validateCredentials | Test API keys without charging | public key, secret key | success/failure + error message |
| testTransaction | Charge minimal amount and refund | credentials, test amount | success/failure |

Each adapter also declares:
- `supportedMethods`: array of payment methods (e.g., PayMongo: ["gcash", "maya", "card", "bank_transfer"]; Stripe: ["card", "bank_transfer"])
- `webhookSignatureHeader`: header name for webhook verification (e.g., PayMongo: "Paymongo-Signature", Stripe: "Stripe-Signature")
- `metadataFields`: gateway-specific fields stored in payment metadata (e.g., PayMongo: gcash_reference_number; Stripe: payment_intent_id, charge_id)

Adding a new gateway = implement this interface. No changes to core payment logic, M06 business rules, or UX screens.

---

## UX Specification

### Screen Inventory

| Route | Screen Name | Access | Purpose |
|---|---|---|---|
| `/org/[id]/officer/payments` | Financial Dashboard | Treasurer, President | Overview: collection rate, recent payments, action cards |
| `/org/[id]/officer/settings/dues` | Dues Configuration | Treasurer | Set amounts, frequency, grace period, per-category rates |
| `/org/[id]/officer/payments` | Payment List | Treasurer, President | All payments with search, filter, export |
| `/org/[id]/officer/settings/funds` | Fund Allocation Config | Treasurer | Define funds and percentages |
| `/org/[id]/officer/reports/financial` | Financial Reports | Treasurer, President | Generate and export reports |
| `/org/[id]/officer/settings/gateway` | Gateway Setup | Treasurer | Connect/test payment gateway |
| `/pay/[token]` | Public Payment Page | Member (tokenized, no auth required) | Hosted checkout page for one-tap payment |

### Screen Details

#### `/org/[id]/officer/payments` -- Financial Dashboard

**Layout:** Summary cards at top, recent payments table below, action cards in sidebar.

**Summary Cards:**
- **Collection Rate:** `[paid] / [total] = [X]%` for current period. Green if >80%, yellow if 50-80%, red if <50%.
- **Total Collected:** Currency-formatted total for current period.
- **Outstanding:** Currency-formatted total of unpaid dues.
- **Pending Payments:** Count of payments awaiting confirmation.

**Recent Payments Table (last 10):**
| Column | Content |
|---|---|
| Date | Payment date |
| Member | Name (linked to member detail) |
| Amount | Currency-formatted |
| Method | Online / Cash / Check / Bank Transfer / GCash |
| Status | Badge: completed (green) / pending (yellow) / failed (red) / refunded (gray) |
| Receipt | Download icon |

**Action Cards:**
- "N members with expiring dues this month -- Send reminders"
- "N pending payments awaiting confirmation -- Review"
- "Gateway not configured -- Set up now" (if no gateway)

**States:**
- **No Gateway:** Prominent banner: "Connect a payment gateway to accept online payments." Link to gateway setup.
- **No Payments:** "No payments recorded yet. Record your first payment or configure online payments."
- **Loading:** Skeleton cards and table with shimmer.
- **Populated:** Full dashboard with real data.

#### `/org/[id]/officer/settings/dues` -- Dues Configuration

**Layout:** Form with sections.

**Section 1: Default Dues**
| Field | Type | Required | Constraints |
|---|---|---|---|
| Default Amount | Currency input | Yes | > 0. Two decimal places. |
| Billing Frequency | Select: Annual / Quarterly | Yes | |
| Due Date | Month/Day picker (for annual) or day-of-quarter (for quarterly) | Yes | |
| Grace Period | Number input (days) | Yes | 0-365. Default: 30. |

**Section 2: Per-Category Overrides**
Table of active membership categories:
| Category | Default Amount | Override Amount |
|---|---|---|
| Regular | [from default] | [editable, blank = use default] |
| Associate | [from default] | [editable] |
| Student | [from default] | [editable] |
| Life | N/A | N/A (Life members exempt) |

**Section 3: Reminder Schedule**
Table of reminder triggers (pre-filled with defaults per M6-R5):
| Trigger | Days | Enabled | Channels |
|---|---|---|---|
| Pre-expiry 1 | 60 | Toggle | In-app, Email |
| Pre-expiry 2 | 30 | Toggle | In-app, Push, Email |
| ... | ... | ... | ... |

"Add custom reminder" button for additional triggers.

**States:**
- **First Setup:** All fields empty except defaults. Guided intro: "Set up your dues structure."
- **Editing:** Fields editable. "Save" and "Cancel" buttons.
- **Saved:** Success toast. "Dues configuration updated. Applies to future billing cycles."
- **Validation Error:** Inline errors. "Amount must be greater than 0."

#### `/org/[id]/officer/settings/funds` -- Fund Allocation Configuration

**Layout:** Sortable list of funds with percentage fields.

**Each Fund Row:**
| Field | Type | Required |
|---|---|---|
| Fund Name | Text input | Yes |
| Percentage | Number input (0.01-100.00) | Yes |
| Remove | Delete button (disabled if transactions exist) |

**Footer:**
- Total percentage indicator: shows sum of all percentages. Green if exactly 100%. Red if not.
- "Add Fund" button.
- "Save" button (disabled if total != 100%).

**Default State:** If no funds configured, single "General Fund" at 100%.

**States:**
- **Empty:** "No custom funds configured. All payments go to the default General Fund."
- **Valid (100%):** Total shows "100.00%" in green. Save enabled.
- **Invalid (!= 100%):** Total shows "[X]%" in red. Save disabled. Message: "Fund percentages must total exactly 100%."
- **Cannot Delete:** Fund with existing transactions shows disabled delete button. Tooltip: "This fund has [N] transactions and cannot be deleted."
- **Saved:** Toast: "Fund allocation updated. New allocation applies to future payments."
- **Warning on change:** If existing transactions exist, warning: "Existing payment allocations will not be recalculated. Only future payments will use the new allocation."

#### `/org/[id]/officer/reports/financial` -- Financial Reports

**Layout:** Report selector, filters, and results area.

**Step 1: Select Report**
Four cards:
- Collection Summary (icon: bar chart)
- Fund Breakdown (icon: pie chart)
- Dues Status (icon: list)
- Aging Report (icon: clock)

**Step 2: Configure Filters**
- Date range picker (start, end). Defaults to current year.
- Additional filters per report type (method, category, fund).

**Step 3: View Results**
- Data table with totals row.
- Summary metrics above table.
- Export buttons: "Download CSV" and "Download PDF".

**States:**
- **No Data:** "No data found for the selected period and filters."
- **Loading:** Table skeleton with shimmer.
- **Populated:** Full report with export options.
- **Exporting:** "Generating [format]..." spinner on button. Download starts automatically.

#### `/org/[id]/officer/settings/gateway` -- Gateway Setup

**Layout:** Status card at top, configuration form below.

**Status Card:**
- Connected: Green badge, gateway name, last test date, "Disconnect" button.
- Not Connected: Red badge, "Connect Gateway" prompt.

**Configuration Form:**
| Field | Type | Required |
|---|---|---|
| Gateway Provider | Select from available providers (country-specific, e.g., PayMongo, Stripe) | Yes |
| Secret Key | Password input (masked) | Yes |
| Public Key | Text input | Yes |

**Actions:**
- "Test Connection" -- validates API keys without charging.
- "Run Test Transaction" -- charges PHP 1.00 and immediately refunds. Shows success/failure.
- "Save & Activate" -- saves credentials (encrypted) and enables online payments.

**States:**
- **Not Connected:** Form visible. Status: red "Not Connected" badge.
- **Testing:** "Testing connection..." spinner. Form disabled.
- **Test Success:** Green checkmark. "Connection verified."
- **Test Failure:** Red X. "Connection failed: [error message]." Form remains editable.
- **Connected:** Green "Connected" badge. Keys shown masked (last 4 chars visible). "Disconnect" and "Run Test" buttons available.
- **Disconnecting:** Confirmation: "Disconnect gateway? Members will not be able to pay online until a new gateway is configured. Pending payments are unaffected."

#### `/pay/[token]` -- Public Payment Page

**Layout:** Single-page checkout. Minimal, focused design. No sidebar, no navigation. Org branding (logo + name) at top.

**Content:**
- Org logo and name
- Member name (from token)
- Amount due
- Membership category
- New expiry date after payment
- "Pay Now" button (redirects to gateway checkout)
- "Already paid? Contact your treasurer." link

**Token Properties:**
- Valid for 30 days from generation.
- Single-use per successful payment (can be retried on failure).
- Contains: org_id, member_id, amount, expiry. Signed with HMAC.
- Does not require login.

**States:**
- **Valid Token:** Payment form displayed.
- **Expired Token:** "This payment link has expired. Please log in to your account or contact your chapter treasurer for a new link."
- **Already Paid:** "Your dues are already current. Active until [date]." (Detected if member's status is Active and expiry is in the future.)
- **Payment Processing:** "Processing your payment..." with spinner.
- **Payment Success:** Green checkmark. "Payment confirmed! Your membership is active until [date]." Receipt download button.
- **Payment Failed:** "Payment failed. [Gateway error message]." "Try Again" button.
- **Gateway Unavailable:** "Payment service temporarily unavailable. Please try again later or contact your chapter treasurer."

---

## Acceptance Criteria Patterns

- Fund allocation rounding never loses or gains a centavo/cent. `sum(allocations) == payment_amount` for every payment.
- Webhook processing is idempotent -- duplicate webhooks do not create duplicate records, duplicate fund splits, or duplicate membership extensions.
- Manual payment recording requires Treasurer role (API returns 403 for unauthorized roles).
- Financial reports are accurate to the centavo and match actual gateway records.
- One-tap payment link works without login (token-based authentication).
- Payment token expires after 30 days. Expired tokens show clear error with recovery path.
- Concurrent manual payment recording for the same member triggers conflict warning.
- Refund reverses fund allocations exactly. `sum(original_allocations) - sum(refund_allocations) == 0` for full refund.
- Gateway credentials stored encrypted at rest. Never logged. Never exposed in API responses.
- Automated reminders fire at configured intervals. Life members excluded.
- Payment pending for >24 hours transitions to expired with treasurer notification.
- Receipt numbers are unique per org per year with no duplicates.
- Reports with no data show clear empty state, not an error.

---

## Data Entities

| Entity | Key Fields | Notes |
|---|---|---|
| **DuesConfig** | `id`, `org_id`, `default_amount` (decimal), `billing_frequency` (enum: annual/quarterly), `due_date_month`, `due_date_day`, `grace_period_days` (int, 0-365), `created_at`, `updated_at` | One per org. Per-category overrides stored in MembershipCategory.dues_amount (M05). |
| **Payment** | `id`, `org_id`, `member_id`, `amount` (decimal), `currency` (ISO 4217), `status` (enum: pending/completed/failed/expired/refunded/partially_refunded), `payment_method` (enum: online_card/online_gcash/online_maya/online_bank/cash/check/bank_transfer/gcash_manual/other), `gateway_transaction_id` (nullable, unique), `gateway_provider` (string -- matches GatewayConfig.provider values, plus "manual" for officer-recorded payments. Extensible alongside GatewayConfig), `reference_number`, `receipt_number`, `recorded_by` (nullable -- officer ID for manual), `payment_date`, `confirmed_at` (nullable), `expires_at` (nullable -- for pending online payments), `gateway_metadata` (JSON, gateway-specific response data), `created_at`, `updated_at` | Core payment record. `gateway_transaction_id` is the idempotency key per M6-R8. |
| **FundAllocation** | `id`, `payment_id`, `fund_config_id`, `fund_name` (denormalized), `percentage` (decimal), `amount` (decimal), `is_reversal` (boolean, default false), `created_at` | One per fund per payment. Reversals created on refund with `is_reversal = true` and negative amount. Immutable after creation. |
| **FundConfig** | `id`, `org_id`, `name`, `percentage` (decimal), `sort_order` (int), `is_active` (boolean), `created_at`, `updated_at` | Per-org fund definitions. Last by sort_order absorbs rounding. Cannot delete if FundAllocation records exist (deactivate instead). |
| **PaymentReminder** | `id`, `org_id`, `member_id`, `trigger_type` (enum: pre_60/pre_30/pre_7/day_of/post_7/post_30/custom), `trigger_days` (int, negative=before, positive=after expiry), `scheduled_for` (datetime), `sent_at` (nullable), `channels_used` (JSON array: ["in_app", "push", "email"]), `payment_link_token`, `created_at` | Tracks reminder delivery. Token used for one-tap payment link. |
| **GatewayConfig** | `id`, `org_id`, `provider` (string, extensible -- initially: paymongo, stripe. New providers added via gateway adapter. Different gateways may require different metadata fields stored in a flexible `metadata` JSON column), `public_key_encrypted`, `secret_key_encrypted`, `is_active` (boolean), `last_test_at` (nullable), `last_test_result` (enum: success/failure), `connected_at`, `disconnected_at` (nullable), `metadata` (JSON, gateway-specific fields), `created_at`, `updated_at` | One active config per org. Keys encrypted at rest. Never exposed in API responses -- only last 4 characters shown in UI. |
| **WebhookEvent** | `id`, `org_id`, `gateway_provider`, `gateway_event_id` (unique), `event_type`, `payload` (JSON), `processed` (boolean), `processed_at` (nullable), `duplicate` (boolean, default false), `payment_id` (nullable -- linked after processing), `created_at` | All webhook events logged per M6-R8. `gateway_event_id` used as idempotency key. Duplicates flagged but not reprocessed. |
| **Refund** | `id`, `payment_id`, `amount` (decimal), `reason`, `status` (enum: pending/completed/failed), `gateway_refund_id` (nullable), `initiated_by`, `completed_at` (nullable), `created_at` | Tracks refund lifecycle. Links back to original payment. Audit-logged. |
| **ReminderSchedule** | `id`, `org_id`, `trigger_type`, `trigger_days` (int), `is_enabled` (boolean), `channels` (JSON array), `created_at`, `updated_at` | Per-org configurable reminder schedule. Defaults created on org setup per M6-R5. |
