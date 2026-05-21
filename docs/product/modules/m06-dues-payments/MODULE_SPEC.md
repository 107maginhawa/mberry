# Module Specification: Dues & Payments (M06)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Collect, allocate, track, and report on membership dues and activity fees. Financial engine handling online payments, manual recording, fund allocation, refunds, automated reminders (dunning), gateway configuration, receipt generation, and financial reporting. Highest-complexity module in the platform.

### Users
- Treasurer, President, Officers, Member, System

### Related Modules
- M01 (Auth), M04 (Org Admin -- fund config, officer roles)
- M05 (Membership -- payment triggers status recomputation via dues_expiry_date update)
- M07 (Communications -- reminders, dunning notifications, receipt delivery)
- M08 (Events -- activity fee payment), M09 (Training -- activity fee payment)
- M14 (National Dashboard -- financial rollups)

### In Scope
- Online dues payment (gateway checkout via PayMongo/Stripe), activity fee payment
- Fund allocation execution (configurable splits, currency-aware rounding)
- Payment receipt (PDF, unique number), manual payment recording
- Payment history, financial reports (collection, fund, aging, status)
- Webhook processing (idempotent), gateway setup and configuration
- Automated reminders and dunning (configurable schedule), refunds (full/partial)
- Dues configuration (amounts, frequency, grace period, category overrides)
- Two-level payment architecture (platform gateway vs org gateway)

### Out of Scope
- Membership status computation (M05), platform billing (M03), event management (M08)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Dues | Annual or periodic payment required to maintain active membership. |
| Fund Allocation | Configurable split of each dues payment into 0-N designated funds (e.g., 60% Chapter Operating, 30% National, 10% Activity). Per org. |
| Rounding Resolution | When fund allocation percentages produce fractional amounts, the last fund (by sort order) absorbs the remainder. sum(allocations) == payment_amount always. |
| Platform Gateway | Payment gateway for Memberry's own subscription billing (Platform charges Associations). |
| Org Gateway | Payment gateway configured by each org for collecting dues from members. |
| Two-Level Payment | Architecture where platform billing and member dues use separate gateway accounts. No cross-org leakage. |
| Royalty Split | Revenue sharing configuration between chapters and national bodies for dues collected. |
| Dunning | Automated escalating reminder process for overdue dues payments. |
| Aging Bucket | Time-based categorization of outstanding dues (30/60/90/120+ days) for financial reporting. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-038: Pay Dues Online | Member | Gateway checkout flow, webhook confirmation | P0 |
| WF-039: Fund Allocation | System | Automatic split on every payment | P0 |
| WF-040: Dues Config | Treasurer | Set amount, currency, billing cycle per org | P0 |
| WF-041: Refund Processing | Treasurer | Full/partial refund, reverses expiry extension | P0 |
| WF-042: Dunning/Reminders | System | Scheduled reminder processor checks expiry, creates notifications | P0 |
| WF-043: Financial Dashboard | Treasurer | Collection rates, payment history, fund reports | P0 |
| WF-044: Manual Payment | Treasurer | Record offline payment with fund split | P0 |
| WF-045: Receipt Generation | System | Auto-generate receipt on completed payment | P0 |

## 4. Workflow Details

### Workflow: Pay Dues Online (WF-038)

Actor: Member
Preconditions: Org has gateway configured (dues_gateway_config exists), member has dues amount via dues_org_config
Steps:
1. Member receives reminder with one-tap payment link OR opens dashboard "Pay Dues."
2. Reviews amount, org, category, new expiry date.
3. Clicks "Pay Now." Redirected to gateway checkout.
4. Completes payment on gateway page.
5. Redirected back. "Payment processing..." with polling.
6. Webhook confirms. Status: completed. dues_expiry_date extended (BR-07). Funds split (BR-05). Receipt generated (M6-R6).
7. Success screen with receipt download.

Exception Flows:
- Gateway not configured: "Online payment unavailable. Contact your treasurer."
- Payment fails: "Payment failed. Try again or contact your treasurer."
- Webhook delayed: "Processing... usually takes a few minutes." (Polling continues.)
- Webhook never arrives (24h): Payment status -> expired, treasurer notified.

### Workflow: Fund Allocation (WF-039, automatic on every payment)

Steps:
1. Load fund configuration for org (dues_fund table, sum of percentages must be 100%).
2. For each fund except last (by sortOrder): `floor(amount * percentage / 100, currency_decimals)`.
3. Last fund: `payment_amount - sum(other funds)`.
4. Verify invariant: `sum(all allocations) == payment_amount` exactly.
5. Insert fund_allocation records.

Invariant: No money appears or disappears. Sum always equals payment amount.

### Workflow: Refund Processing (WF-041)

Actor: Treasurer (2FA required)
Preconditions: Payment exists in completed status
Steps:
1. Treasurer selects payment and refund type (full/partial).
2. Enters refund amount and reason.
3. System reverses dues_expiry_date extension (BR-08).
4. For gateway payments: refund request sent to gateway.
5. For manual payments: recorded as negative payment entry.
6. Fund allocations reversed (isReversal=true).
7. If reversed expiry is in the past, membership status recomputes immediately.

Exception Flows:
- Gateway refund fails: retry available, treasurer notified.
- Partial refund: proportional fund allocation reversal.

### Workflow: Dunning/Reminders (WF-042)

Actor: System (cron via pg-boss)
Preconditions: Reminder schedule configured per org (dues_reminder_schedule)
Steps:
1. Cron job queries members with upcoming/past expiry dates.
2. Match against configured schedule (default: 60/30/7 days pre-expiry, 7/30 days post-expiry).
3. For each match: check if reminder already sent (dues_reminder_log).
4. If not sent: create notification via M07, log to dues_reminder_log.
5. Dunning escalation: if overdue > configured threshold, escalate via dunning_template.

Exception Flows:
- Life member: skip (exempt from dues).
- Suspended/Removed member: skip (no active membership).

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-04 | IF org sets dues config THEN amount applies to all members unless category-specific overrides configured | Dues config | Per-org, per-category override supported |
| BR-05 | IF payment recorded THEN split into configured funds; fund percentages must sum to 100% | Fund allocation | Last fund absorbs rounding remainder |
| BR-06 | IF payment is recorded manually THEN record includes member, amount, date, method, fund breakdown, and recording officer identity | Manual payment | Gateway payments auto-generate receipts; manual on demand |
| BR-07 | IF payment confirmed THEN extend dues_expiry_date by billing cycle period | Payment | Status recomputes to Active via M05 |
| BR-08 | IF refund processed THEN reverse dues_expiry_date extension; if reversed date is in the past, status recomputes immediately | Refund | Gateway refunds trigger gateway API call; manual refunds are negative entries |
| BR-30 | IF org gateway configured THEN separate from platform gateway; no cross-org leakage | Security | Each org has isolated gateway credentials |
| BR-32 | IF financial record THEN retain for 7 years | Compliance | BIR requirement. No hard-delete of payments. |
| M6-R1 | IF fund allocation THEN currency-aware rounding; last fund (by sortOrder) absorbs remainder | Rounding | sum(allocations) == payment_amount always |
| M6-R2 | IF payment status change THEN follow state machine | Payment | See Section 8 |
| M6-R4 | IF two treasurers record for same member within 5 minutes THEN warn about potential duplicate | Concurrency | Warning only, allow if confirmed |
| M6-R5 | IF reminder schedule THEN defaults 60/30/7 pre-expiry, 7/30 post-expiry | Reminders | Configurable per org |
| M6-R6 | IF receipt generated THEN unique number format: ORG_CODE-YEAR-SEQ | Receipts | No duplicates per org per year |
| M6-R8 | IF duplicate webhook received THEN skip processing, return 200 OK | Idempotency | gateway_transaction_id as idempotency key |
| M6-R12 | IF new gateway needed THEN implement adapter interface only | Extensibility | No core logic changes required |

## 6. Permissions

From ROLE_PERMISSION_MATRIX Section 3.4 (Dues Module):

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Dashboard | super, admin, president (2FA), treasurer (2FA) | All others | GA+HG |
| List invoices | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (Own) | user | GA |
| Create invoice | super, admin, president (2FA), treasurer (2FA) | All others | GA+HG |
| Record payment | super, admin, president (2FA), treasurer (2FA) | All others | GA+HG |
| Process refund | super, admin, president (2FA), treasurer (2FA) | All others | GA+HG |
| View own dues | All authenticated (except user) | user | GA |
| Configure dues | super, admin, president (2FA), treasurer (2FA) | All others | GA+HG |

## 7. Data Requirements

### Entity: DuesPayment

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | -- |
| personId | Yes | Person FK | -- |
| amount | Yes | Payment amount | Decimal, > 0 |
| currency | Yes | ISO 4217 | Inherited from association config |
| status | Yes | pending/completed/failed/refunded/partiallyRefunded/expired/submitted/underReview/confirmed/rejected | Enum: dues_payment_status |
| paymentMethod | Yes | online/cash/check/bankTransfer/gcash/other | Enum: dues_payment_method |
| gatewayTransactionId | No | Unique idempotency key | Nullable, unique when present |
| receiptNumber | Yes | ORG_CODE-YEAR-SEQ | Unique per org per year |
| recordedBy | No | Officer ID for manual payments | Nullable |

### Entity: DuesOrgConfig

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | One config per org |
| duesAmount | Yes | Default dues amount | Decimal |
| billingFrequency | Yes | annual/semi-annual/quarterly | Enum: billing_frequency |
| gracePeriodDays | Yes | Grace period length | 0-90, default 30 |

### Entity: DuesCategoryOverride

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| duesConfigId | Yes | DuesOrgConfig FK | -- |
| categoryId | Yes | MembershipCategory FK | -- |
| amount | Yes | Override amount | Decimal |

### Entity: DuesFund

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | -- |
| name | Yes | Fund name | e.g., "Chapter Operating", "National", "Activity" |
| percentage | Yes | Allocation % | 0.01-100.00. All funds per org must sum to 100 |
| sortOrder | Yes | Sort position | Integer. Last by sort absorbs rounding |

### Entity: DuesFundAllocation

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| paymentId | Yes | DuesPayment FK | -- |
| fundId | Yes | DuesFund FK | -- |
| amount | Yes | Allocated amount | Decimal |
| isReversal | Yes | Refund reversal flag | Default false |

### Entity: DuesGatewayConfig

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | One active config per org |
| provider | Yes | paymongo/stripe | -- |
| credentials | Yes | Encrypted credentials | EncryptedCredentials VO. Never logged. |
| isActive | Yes | Active toggle | Only one active per org |

### Entity: DuesReminderSchedule

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| duesConfigId | Yes | DuesOrgConfig FK | -- |
| daysBefore | No | Days before expiry | Positive integer |
| daysAfter | No | Days after expiry | Positive integer |
| channel | Yes | email/sms/letter | Enum: dunning_channel |

### Entity: DuesPaymentStatusHistory

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| paymentId | Yes | DuesPayment FK | -- |
| previousStatus | Yes | Status before | -- |
| newStatus | Yes | Status after | -- |
| changedAt | Yes | Timestamp | -- |

### Entity: WebhookRetryLog

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| paymentId | Yes | DuesPayment FK | -- |
| status | Yes | processing/completed/pending_retry/dead_letter | Enum: webhook_retry_status |
| attemptCount | Yes | Retry count | -- |
| lastError | No | Error message | -- |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| DuesPayment | DuesFundAllocation, DuesPaymentStatusHistory, WebhookRetryLog | -- | sum(allocations) == payment_amount. Receipt number unique per org per year. Never hard-deleted (BR-32). |
| DuesOrgConfig | DuesCategoryOverride, DuesFund, DuesReminderSchedule | -- | One config per org. Fund percentages sum to 100. |
| DuesGatewayConfig | -- | EncryptedCredentials | One active config per org. Keys never logged. Separate from platform gateway (BR-30). |

## 8. State Transitions

### Payment Status (dues_payment_status enum)
```txt
pending -> completed (webhook confirms or manual confirmation)
pending -> failed (gateway failure)
pending -> expired (24h timeout, no webhook received)
pending -> submitted (manual payment awaiting review) [INFERRED]
submitted -> underReview (officer begins review) [INFERRED]
underReview -> confirmed (officer approves) [INFERRED]
underReview -> rejected (officer rejects) [INFERRED]
completed -> refunded (full refund)
completed -> partiallyRefunded (partial refund)
confirmed -> refunded (full refund) [INFERRED]
confirmed -> partiallyRefunded (partial refund) [INFERRED]
```

Note: The enum has 10 values. The submitted/underReview/confirmed/rejected flow is [INFERRED] from enum presence but not yet validated against handler code.

### Webhook Retry Status
```txt
processing -> completed (webhook processed successfully)
processing -> pending_retry (transient failure)
pending_retry -> processing (retry attempt)
pending_retry -> dead_letter (max retries exceeded)
```

## 9. UI / UX Requirements

### Screen: Financial Dashboard (/org/[id]/officer/payments)
Purpose: Collection overview with action cards
Users: President, Treasurer (2FA required)
Components: Collection rate card (percentage), total collected YTD, outstanding amount, pending payments table, action cards ("N members overdue"), aging report summary
States: Loading (skeleton), NoGateway (setup banner with CTA), NoPayments (empty state with first-payment guide), Populated, PermissionError ("Financial data requires Treasurer or President role"), UnexpectedError (retry)

### Screen: Pay Dues (/pay/[token])
Purpose: One-tap payment from reminder link (token-based, no login required)
Users: Member
Components: Org logo, member name, amount, category, expiry after payment, "Pay Now" button
States: Loading, ValidToken (payment form), ExpiredToken ("This link has expired. Log in to pay."), AlreadyPaid ("Your dues are current through [date]."), Processing (polling spinner), Success (receipt download), Failed ("Payment failed. Try again."), GatewayUnavailable ("Online payment temporarily unavailable.")

### Screen: Dues Configuration (/org/[id]/officer/settings/dues)
Purpose: Configure dues amounts, billing cycle, grace period, fund splits
Users: President, Treasurer (2FA required)
Components: Dues amount field, billing frequency dropdown, grace period slider (0-90), category overrides table, fund allocation table (name + percentage + sort order with live sum validation)
States: Loading, Empty (first-time setup wizard), Populated, ValidationError (percentages != 100, invalid amounts), PermissionError

### Screen: Payment History (/me/payments)
Purpose: Member views their own payment history
Users: All authenticated members
Components: Payment list (date, amount, status, receipt download link), filters (date range, org)
States: Loading, Empty ("No payment history"), Populated

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/payments/manual | Record manual payment | personId, amount, method, reference | paymentId, receiptNumber | 403, 400 |
| POST /org/:id/payments/checkout | Initiate online payment | personId | checkoutUrl, sessionId | 400 no gateway, 400 Life member |
| POST /webhooks/:provider | Process webhook | raw body, signature headers | 200 OK | (always 200) |
| POST /org/:id/payments/:id/refund | Process refund | amount, reason | refundId | 400, 403, 502 gateway error |
| GET /org/:id/reports/financial | Generate financial report | type, dateRange, filters | Report data (collection/fund/aging/status) | 403 |
| GET /my/payments | View own payment history | filters | Payment list | 401 |
| PUT /org/:id/config/dues | Update dues configuration | amount, frequency, grace, overrides | Updated config | 403, 400 |
| PUT /org/:id/config/funds | Update fund allocation | funds[] | Updated funds | 400 percentages != 100 |
| POST /org/:id/config/gateway | Setup gateway | provider, credentials | Config record | 403, 400 invalid credentials |
| GET /org/:id/payments/:id/receipt | Download receipt PDF | -- | PDF | 403, 404 |
| GET /pay/:token | Token-based payment page | -- | Payment details | 400 expired/invalid token |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| PaymentRecorded | Payment completed (webhook or manual) | orgId, personId, amount, newExpiryDate | M05 (status recompute to Active) |
| PaymentRefunded | Refund completed | orgId, personId, amount, reversedExpiryDate | M05 (status may revert) |
| InvoiceGenerated | Dues invoice created | orgId, personId, amount, dueDate | M07 (notification) |
| dunning.escalation | Dunning threshold exceeded | organizationId, personId, membershipId, stage, daysOverdue, templateName | M07 (escalated notification) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipApproved | M05 | Generate first dues invoice | Invoice created, reminder schedule activated |
| MembershipStatusChanged | M05 | Adjust reminder schedule | Suppress reminders for Suspended/Removed/Life members |

## 11. Acceptance Criteria

### AC-M06-001: Fund Allocation Integrity
**Given** a payment of any amount split across N funds
**When** fund allocation executes
**Then** `sum(allocations) == payment_amount` for every payment, with no centavo lost or gained. Last fund absorbs rounding.

### AC-M06-002: Idempotent Webhooks
**Given** a webhook that has already been processed (matching gateway_transaction_id)
**When** the same webhook arrives again
**Then** no duplicate payment records, fund splits, or membership extensions are created. Returns 200 OK.

### AC-M06-003: One-Tap Payment
**Given** a member receives a reminder email with payment link
**When** they click the link
**Then** they can complete payment without logging in (token-based). Token expires after 30 days.

### AC-M06-004: Concurrent Payment Warning
**Given** two treasurers recording payment for the same member within 5 minutes
**When** the second recording is attempted
**Then** a conflict warning is displayed. Payment proceeds only if confirmed.

### AC-M06-005: Report Accuracy
**Given** a financial report is generated
**When** compared against gateway records
**Then** totals match to the centavo. Aging buckets correctly categorize outstanding amounts.

### AC-M06-006: Refund Reversal
**Given** a refund is processed for a completed payment
**When** the dues_expiry_date is reversed
**Then** if the reversed date is in the past, membership status recomputes immediately (may become Grace or Lapsed).

### AC-M06-007: Life Member Payment Block
**Given** a Life member (dues_expiry_date = 2099-12-31)
**When** a payment checkout is attempted
**Then** it is blocked with "Life members are exempt from dues."

## 12. Test Expectations

Required test categories:
- **Fund allocation**: rounding for all currency edge cases (PHP 1.00 / 3 funds = 0.33 + 0.33 + 0.34), sum invariant, 1 fund (100%), many funds
- **Webhook idempotency**: duplicate events (same gateway_transaction_id), unknown transactions, delayed webhooks (23.5h)
- **Payment state machine**: all valid transitions, invalid transitions rejected, 24h expiry
- **Manual payment**: role enforcement (treasurer/president only + 2FA), duplicate detection (5-min window), receipt generation
- **Refund**: full and partial, fund allocation reversal (isReversal=true), status impact on membership, gateway vs manual
- **Gateway adapter**: credentials validation, test transaction, cross-org isolation (BR-30)
- **Reminder/dunning**: correct timing against schedule, Life member exclusion, Suspended/Removed exclusion, deduplication via reminder_log
- **Receipt number**: uniqueness per org per year, format compliance (ORG_CODE-YEAR-SEQ)
- **Financial reports**: collection rate accuracy, aging bucket correctness, fund report totals
- **Permissions**: 403 for non-treasurer/president, 2FA enforcement

## 13. Edge Cases

- Payment of PHP 1.00 split across 3 funds (33/33/34): allocations = 0.33, 0.33, 0.34.
- Webhook arrives 23.5 hours after checkout: processed normally (before 24h expiry).
- Refund of manual payment: marked refunded (no gateway API call -- negative entry only).
- Two treasurers record same amount for same member: warning displayed, allow if confirmed.
- Gateway credentials rotated: old webhooks still validated (signature check uses original key).
- Payment for Life member: blocked ("Life members exempt from dues").
- Fund percentages sum to 99.99: blocked ("Percentages must total exactly 100%").
- Org with no funds configured: entire payment goes to default fund. [VERIFY]
- Payment in progress when refund attempted: blocked ("Payment must be completed before refund").
- Member pays dues but is currently Suspended: payment recorded, expiry extended, but status remains Suspended (officer must restore). [INFERRED]
- Receipt number sequence reset at year boundary: ORG_CODE-2027-001 follows ORG_CODE-2026-NNN.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth -- authentication, session, token validation for /pay/:token)
- M04 (Org Admin -- fund configuration is org-scoped, officer roles gate financial actions)
- M05 (Membership -- PaymentRecorded event triggers dues_expiry_date update; MembershipApproved triggers first invoice)
- M07 (Communications -- reminder/dunning delivery, receipt email)

### External Dependencies
- PayMongo API (payment gateway -- Philippines)
- Stripe API (payment gateway -- international)
- PDF generation library (receipts)
- pg-boss (reminder/dunning cron job processor)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Gateway unreachable during checkout | No payment created, retry available | "Payment service temporarily unavailable. Please try again." |
| Webhook never arrives (24h) | Status -> expired, treasurer notified | (Treasurer): "Payment pending 24h. Verify in gateway dashboard." |
| Refund gateway failure | Retry available, treasurer notified | "Refund failed. Gateway error: [msg]. Retry available." |
| Unmatched webhook (unknown transaction) | Log to webhook_retry_log, alert platform admin | (Internal only -- no user message) |
| Fund percentages != 100 | Block save | "Fund percentages must total exactly 100%." |
| Life member payment attempt | Block checkout | "Life members are exempt from dues." |
| Duplicate manual recording (5-min window) | Warning with override | "A payment was recorded for this member 3 minutes ago. Continue?" |
| Token expired on /pay/:token | Show expiry message | "This payment link has expired. Please log in to pay your dues." |

## 16. Performance Expectations

- Expected data volume: 500+ payments per org per year, 15+ tables in Financial context
- Expected concurrent users: 50+ members paying simultaneously at convention events
- Acceptable response times: Checkout redirect < 2s, webhook processing < 5s, receipt generation < 3s, financial report < 5s
- Caching: Gateway config cached per-org (invalidated on update). Reminder schedule cached. Payment data never cached (financial accuracy).

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| payment.created | INFO | Payment initiated | orgId, personId, amount, method | No |
| payment.completed | INFO | Payment confirmed | paymentId, receiptNumber | No |
| payment.failed | WARN | Payment failed | paymentId, error | No |
| payment.expired | WARN | 24h timeout | paymentId | No |
| payment.refunded | INFO | Refund processed | paymentId, refundAmount | No |
| webhook.received | INFO | Webhook arrived | provider, eventId | No |
| webhook.duplicate | WARN | Duplicate webhook | provider, eventId, gatewayTransactionId | No |
| webhook.unmatched | ERROR | Unknown transaction | provider, eventId | No |
| reminder.sent | INFO | Reminder dispatched | orgId, personId, triggerType | No |
| dunning.escalated | WARN | Dunning escalation | orgId, personId, stage, daysOverdue | No |
| fund.allocation.completed | DEBUG | Funds split | paymentId, fundCount, amounts[] | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| payments_total | counter | method, status | Payment count by method and outcome |
| payment_amount_cents | histogram | method | Payment amount distribution |
| fund_allocation_drift | gauge | orgId | Should always be 0 (canary metric) |
| reminder_sent_total | counter | trigger_type | Reminder count by type |
| webhook_processing_seconds | histogram | provider | Webhook processing latency |
| receipt_generation_seconds | histogram | -- | Receipt PDF generation time |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| dues.onlinePayment | release | true | Gates online payment checkout flow | -- |
| dues.gcashDirect | release | false | GCash direct integration (bypassing PayMongo) | -- |
| dues.dunningV2 | release | false | Enhanced dunning with escalation templates | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M06-S1 | Dues Configuration | Set amounts, frequency, grace period, category overrides | M04, M05 | P0 |
| M06-S2 | Fund Allocation Config | Define funds with percentages, sort order | M06-S1 | P0 |
| M06-S3 | Manual Payment Recording | Treasurer records offline payment with fund split | M06-S1, M06-S2 | P0 |
| M06-S4 | Gateway Setup | Connect PayMongo/Stripe, test connection, credential storage | M06-S1 | P0 |
| M06-S5 | Online Payment Flow | Member checkout via gateway, redirect, polling | M06-S4 | P0 |
| M06-S6 | Webhook Processing | Idempotent webhook handler with retry log | M06-S5 | P0 |
| M06-S7 | Payment Receipts | PDF generation with unique numbering + email | M06-S3, M06-S6 | P0 |
| M06-S8 | Automated Reminders | Cron-based reminder schedule via pg-boss | M06-S1 | P0 |
| M06-S9 | Refunds | Full/partial with fund allocation reversal and expiry reversal | M06-S3, M06-S6 | P0 |
| M06-S10 | Financial Reports | Collection, fund, aging, status reports | M06-S3 | P0 |
| M06-S11 | Dunning Escalation | Escalating templates with configurable thresholds | M06-S8 | P1 |
| M06-S12 | Token-Based Payment | One-tap payment links in reminder emails | M06-S5 | P1 |

## 20. AI Instructions

When implementing this module:
1. **Two handler directories exist**: `handlers/dues/` (15 handlers, hand-wired, no TypeSpec) is the primary payment system. `handlers/association:member/` also has dues-related handlers (the mega-module). New dues handlers should go in `dues/` with TypeSpec definitions.
2. **Schema files**: Primary schema at `dues/repos/dues-payments.schema.ts`. Legacy schema at `association:member/repos/dues.schema.ts` (dues_config, dues_invoice -- legacy). Also `association:member/repos/dunning.schema.ts` for dunning tables.
3. **Fund allocation is the critical path**: Implement the rounding algorithm with explicit tests. Use `Decimal` or integer-cents arithmetic to avoid floating-point errors. Last fund by sortOrder absorbs remainder.
4. **Webhook idempotency**: Use `gatewayTransactionId` as the idempotency key. Always return 200 OK to webhooks (even for duplicates/errors). Log to `webhook_retry_log`.
5. **Two-level payment architecture**: Platform gateway (billing/) and org gateway (dues/) are completely separate. Never cross-reference credentials (BR-30).
6. **Financial retention**: Never hard-delete payment records. 7-year retention (BR-32). Use soft-delete patterns.
7. **Receipt numbering**: Format ORG_CODE-YEAR-SEQ. Use a database sequence or counter table to prevent duplicates under concurrency.
8. **Permissions**: Treasurer and president require 2FA for all financial mutations. Use `officerAuthMiddleware` + `requirePosition(['treasurer', 'president'])`.
9. **Cron jobs**: Use pg-boss for reminder/dunning processing. Schedule defined in `dues_reminder_schedule` table.
10. **Gateway adapter pattern**: Abstract gateway behind interface. PayMongo and Stripe are the two initial providers. M6-R12 requires no core logic changes when adding a new gateway.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | 9 terms from DOMAIN_GLOSSARY including Dunning, Aging Bucket |
| 3. Workflows | COMPLETE | Aligned with WORKFLOW_MAP WF-038 through WF-045 |
| 4. Workflow Details | COMPLETE | 4 workflows detailed: online payment, fund allocation, refund, dunning |
| 5. Business Rules | COMPLETE | BR-04 through BR-32 + 7 module rules |
| 6. Permissions | COMPLETE | From ROLE_PERMISSION_MATRIX 3.4 (7 actions) |
| 7. Data Requirements | COMPLETE | 9 entities with full field specs from DOMAIN_MODEL |
| 7b. Aggregate Boundaries | COMPLETE | 3 aggregates from DOMAIN_MODEL section 10 |
| 8. State Transitions | COMPLETE | Payment status (10 values) + webhook retry status. [INFERRED] items tagged. |
| 9. UI/UX Requirements | COMPLETE | 4 screens with all 6 states |
| 10. API Expectations | COMPLETE | 11 endpoints |
| 10b. Domain Events | COMPLETE | 4 published (incl. dunning.escalation from DOMAIN_MODEL 11), 2 consumed |
| 11. Acceptance Criteria | COMPLETE | 7 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | 10 categories |
| 13. Edge Cases | COMPLETE | 11 cases |
| 14. Dependencies | COMPLETE | 4 internal, 4 external |
| 15. Error Handling | COMPLETE | 8 scenarios |
| 16. Performance | COMPLETE | -- |
| 17. Observability | COMPLETE | 11 log events, 6 metrics |
| 18. Feature Flags | COMPLETE | 3 flags (added dunning V2) |
| 19. Vertical Slice Plan | COMPLETE | 12 slices (added dunning escalation + token payment) |
| 20. AI Instructions | COMPLETE | 10 implementation directives |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M05 Membership**: PaymentRecorded event is the primary trigger for dues_expiry_date updates, which drive the entire membership status computation (BR-01). If payment recording is broken, no members can become Active.
- **M04 Org Admin**: Dashboard smart action cards ("N members unpaid") depend on dues data. Fund configuration is part of org admin workflows.
- **M07 Communications**: Reminder/dunning delivery depends on M06 scheduling. Receipt emails triggered by M06.
- **M08 Events + M09 Training**: Activity fee payments route through M06 payment infrastructure.
- **M14 National Dashboard**: Financial rollups (collection rates, fund reports) aggregate M06 data across chapters.
- **Handler split note**: `handlers/dues/` is hand-wired (no TypeSpec). New endpoints should be TypeSpec-defined. Legacy `dues_config`/`dues_invoice` in `association:member/repos/dues.schema.ts` coexist with v2 payment system in `dues/repos/dues-payments.schema.ts`.
