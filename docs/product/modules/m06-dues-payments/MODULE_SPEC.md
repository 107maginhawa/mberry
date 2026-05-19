# Module Specification: Dues & Payments (M06)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Collect, allocate, track, and report on membership dues and activity fees. Financial engine handling online payments, manual recording, fund allocation, refunds, automated reminders, gateway configuration, and financial reporting. Highest-complexity module.

### Users
- Treasurer, President, Officers, Member, System

### Related Modules
- M01 (Auth), M04 (Org Admin), M05 (Membership — status triggers)
- M07 (Communications — reminders), M08 (Events — activity fees)
- M09 (Training — activity fees), M14 (National Dashboard — financial rollups)

### In Scope
- Online dues payment (gateway checkout), activity fee payment
- Fund allocation execution (configurable splits, rounding)
- Payment receipt (PDF), manual payment recording
- Payment history, financial reports (collection, fund, aging, status)
- Webhook processing (idempotent), gateway setup (PayMongo/Stripe)
- Automated reminders (configurable schedule), refunds
- Dues configuration (amounts, frequency, grace period)

### Out of Scope
- Membership status computation (M05), platform billing (M03), event management (M08)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Dues | Annual or periodic payment to maintain active membership. |
| Fund Allocation | Configurable split of each payment into N designated funds. |
| Rounding Resolution | Last fund absorbs remainder. Sum always equals payment amount. |
| Org Gateway | Payment gateway configured per org for collecting dues (not platform billing). |
| Two-Level Payment | Platform billing separate from member dues collection. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Configure Dues | Treasurer | Set amounts, frequency, grace, per-category overrides | P0 |
| Setup Gateway | Treasurer | Connect PayMongo/Stripe, test connection | P0 |
| Record Manual Payment | Treasurer | Offline payment with fund split | P0 |
| Pay Dues Online | Member | Gateway checkout flow | P0 |
| Process Refund | Treasurer | Full/partial refund with allocation reversal | P0 |
| Generate Reports | Treasurer | Collection, fund, aging, status reports | P0 |
| Automated Reminders | System | Pre/post expiry notifications | P0 |

## 4. Workflow Details

### Workflow: Pay Dues Online (M-13)

Actor: Member
Preconditions: Org has gateway configured, member has dues amount
Steps:
1. Member receives reminder with one-tap payment link OR opens dashboard "Pay Dues."
2. Reviews amount, org, category, new expiry date.
3. Clicks "Pay Now." Redirected to gateway checkout.
4. Completes payment on gateway page.
5. Redirected back. "Payment processing..." with polling.
6. Webhook confirms. Status: completed. dues_expiry_date updated. Funds split. Receipt generated.
7. Success screen with receipt download.

Exception Flows:
- Gateway not configured: "Online payment unavailable. Contact treasurer."
- Payment fails: "Payment failed. Try again."
- Webhook delayed: "Processing... usually takes a few minutes."

### Workflow: Fund Allocation (automatic on every payment)

Steps:
1. For each fund except last: floor(amount × percentage / 100, currency_decimals).
2. Last fund: payment_amount − sum(other funds).
3. Verify: sum(all funds) == payment_amount exactly.

Invariant: No money appears or disappears.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-05 | IF payment recorded THEN split into configured funds, total 100% | Fund allocation | Last fund absorbs rounding |
| BR-07 | IF payment confirmed THEN extend dues_expiry_date by billing cycle | Payment | Status recomputes to Active |
| BR-08 | IF refund processed THEN reverse dues_expiry_date extension | Refund | Status may revert |
| BR-30 | IF org gateway THEN separate from platform gateway | Security | No cross-org leakage |
| BR-32 | IF financial record THEN retain 7 years | Compliance | BIR requirement |
| M6-R1 | IF fund allocation THEN currency-aware rounding, last fund absorbs | Rounding | sum(allocations) == payment_amount always |
| M6-R2 | IF payment status THEN follow state machine | Payment | pending→completed→refunded; pending→failed; pending→expired |
| M6-R4 | IF two treasurers record for same member within 5 min THEN warn | Concurrency | Duplicate prevention |
| M6-R5 | IF reminder schedule THEN defaults 60/30/7 pre, 7/30 post | Reminders | Configurable per org |
| M6-R6 | IF receipt generated THEN unique number: ORG_CODE-YEAR-SEQ | Receipts | No duplicates |
| M6-R8 | IF duplicate webhook THEN skip, return 200 | Idempotency | gateway_transaction_id as key |
| M6-R12 | IF new gateway needed THEN implement adapter interface only | Extensibility | No core logic changes |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View dues dashboard | president (2FA), treasurer (2FA) | All others | GA+HG |
| Record manual payment | president (2FA), treasurer (2FA) | All others | GA+HG |
| Process refund | president (2FA), treasurer (2FA) | All others | GA+HG |
| View own dues | All authenticated | — | GA |
| Configure dues | president (2FA), treasurer (2FA) | All others | GA+HG |

## 7. Data Requirements

### Entity: DuesPayment

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Organization FK | — |
| personId | Yes | Person FK | — |
| amount | Yes | Payment amount | Decimal, > 0 |
| currency | Yes | ISO 4217 | — |
| status | Yes | pending/completed/failed/expired/refunded/partially_refunded | Enum |
| paymentMethod | Yes | online_card/cash/check/bank_transfer/gcash/other | Enum |
| gatewayTransactionId | No | Unique idempotency key | Nullable, unique |
| receiptNumber | Yes | ORG_CODE-YEAR-SEQ | Unique per org per year |
| recordedBy | No | Officer ID for manual | Nullable |

### Entity: FundConfig

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Organization FK | — |
| name | Yes | Fund name | — |
| percentage | Yes | Allocation % | 0.01-100.00, all must sum to 100 |
| sortOrder | Yes | Last by sort absorbs rounding | Integer |

### Entity: FundAllocation

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| paymentId | Yes | Payment FK | — |
| fundConfigId | Yes | Fund FK | — |
| amount | Yes | Allocated amount | Decimal |
| isReversal | Yes | Refund reversal flag | Default false |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| DuesPayment | FundAllocation, WebhookEvent, Refund | — | sum(allocations) == payment_amount. Receipt number unique. |
| DuesOrgConfig | DuesCategoryOverride, DuesFund, ReminderSchedule | — | One config per org. Fund percentages sum to 100. |
| GatewayConfig | — | EncryptedCredentials | One active config per org. Keys never logged. |

## 8. State Transitions

### Payment Status
```txt
Pending → Completed (webhook or manual confirm)
Pending → Failed (gateway failure)
Pending → Expired (24h timeout, no webhook)
Completed → Refunded (full refund)
Completed → PartiallyRefunded (partial refund)
```

## 9. UI / UX Requirements

### Screen: Financial Dashboard (/org/[id]/officer/payments)
Purpose: Collection overview with action cards
Components: Collection rate card, total collected, outstanding, pending payments table, action cards
States: No gateway (setup banner), No payments (empty state), Populated

### Screen: Public Payment Page (/pay/[token])
Purpose: One-tap payment from reminder link
Components: Org logo, member name, amount, category, expiry after payment, "Pay Now" button
States: Valid token, Expired token, Already paid, Processing, Success, Failed

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/payments/manual | Record manual payment | memberId, amount, method, ref | paymentId, receipt | 403, 400 |
| POST /org/:id/payments/checkout | Initiate online payment | memberId, amount | checkoutUrl | 400 no gateway |
| POST /webhooks/:provider | Process webhook | raw body, headers | 200 OK | — |
| POST /org/:id/payments/:id/refund | Process refund | amount, reason | refundId | 400, 502 gateway |
| GET /org/:id/reports/financial | Generate report | type, dateRange, filters | Report data | — |
| GET /my/payments | View own history | — | Payment list | 401 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| PaymentRecorded | Payment completed | orgId, personId, amount, newExpiryDate | M05 (status), M07 (notification) |
| PaymentRefunded | Refund completed | orgId, personId, amount | M05 (status recompute) |
| InvoiceGenerated | Dues invoice created | orgId, personId, amount | M07 (notification) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipApproved | M05 | Generate first dues invoice | Invoice created |
| MembershipStatusChanged | M05 | Trigger/suppress reminders | Reminder schedule adjusted |

## 11. Acceptance Criteria

### AC-M06-001: Fund Allocation Integrity
Fund allocation never loses or gains a centavo. sum(allocations) == payment_amount for every payment.

### AC-M06-002: Idempotent Webhooks
Duplicate webhooks do not create duplicate records, fund splits, or membership extensions.

### AC-M06-003: One-Tap Payment
Payment link works without login (token-based). Token expires after 30 days.

### AC-M06-004: Concurrent Payment Warning
Two treasurers recording for same member within 5 minutes triggers conflict warning.

### AC-M06-005: Report Accuracy
Financial reports accurate to centavo and match gateway records.

## 12. Test Expectations

Required tests:
- Fund allocation: rounding for all currency edge cases, sum invariant
- Webhook idempotency: duplicate events, unknown transactions
- Payment state machine: all valid transitions, invalid transitions rejected
- Manual payment: role enforcement, duplicate detection, receipt generation
- Refund: full and partial, fund allocation reversal, status impact
- Gateway adapter: credentials validation, test transaction
- Reminder schedule: correct timing, Life member exclusion
- Receipt number: uniqueness, format compliance

## 13. Edge Cases

- Payment of PHP 1.00 split across 3 funds (33/33/34): 0.33, 0.33, 0.34.
- Webhook arrives 23.5 hours after checkout: processed normally (before 24h expiry).
- Refund of manual payment: marked refunded (no gateway action).
- Two treasurers record same amount for same member: warning, allow if confirmed.
- Gateway credentials rotated: old webhooks still validated.
- Payment for Life member: blocked (Life members exempt from dues).

## 14. Dependencies

### Internal Dependencies
- M01 (Auth), M04 (Org Admin — fund config), M05 (Membership — status trigger)
- M07 (Communications — reminder delivery)

### External Dependencies
- PayMongo API, Stripe API (payment gateways)
- PDF generation (receipts)
- pg-boss (reminder processor cron job)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Gateway unreachable during checkout | No payment created | "Payment service temporarily unavailable." |
| Webhook never arrives (24h) | Status→expired, notify treasurer | "Payment pending 24h. Verify in gateway." |
| Refund gateway failure | Retry available | "Refund failed. Gateway error: [msg]." |
| Unmatched webhook | Log, alert platform admin | (Internal only) |
| Fund percentages != 100 | Block save | "Percentages must total exactly 100%." |

## 16. Performance Expectations

- Expected data volume: 500+ payments per org per year
- Expected concurrent users: 50+ paying simultaneously at convention
- Acceptable response times: Checkout redirect < 2s, webhook processing < 5s
- Caching requirements: Gateway config cached per-org

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| payment.created | INFO | Payment initiated | orgId, personId, amount, method | No |
| payment.completed | INFO | Payment confirmed | paymentId, receiptNumber | No |
| payment.failed | WARN | Payment failed | paymentId, error | No |
| payment.refunded | INFO | Refund processed | paymentId, refundAmount | No |
| webhook.received | INFO | Webhook arrived | provider, eventId | No |
| webhook.duplicate | WARN | Duplicate webhook | provider, eventId | No |
| reminder.sent | INFO | Reminder dispatched | orgId, personId, triggerType | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| payments_total | counter | method, status | Payment count |
| payment_amount_cents | histogram | method | Payment amounts |
| fund_allocation_drift | gauge | orgId | Should always be 0 |
| reminder_sent_total | counter | trigger_type | Reminder count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| dues_online_payment_enabled | release | true | Gates online payment | — |
| dues_gcash_direct | release | false | GCash direct integration | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M06-S1 | Dues Configuration | Set amounts, frequency, grace period | M04, M05 | P0 |
| M06-S2 | Fund Allocation Config | Define funds with percentages | M06-S1 | P0 |
| M06-S3 | Manual Payment Recording | Treasurer records offline payment | M06-S1, M06-S2 | P0 |
| M06-S4 | Gateway Setup | Connect PayMongo/Stripe, test | M06-S1 | P0 |
| M06-S5 | Online Payment Flow | Member checkout via gateway | M06-S4 | P0 |
| M06-S6 | Webhook Processing | Idempotent webhook handler | M06-S5 | P0 |
| M06-S7 | Payment Receipts | PDF generation + email | M06-S3, M06-S6 | P0 |
| M06-S8 | Automated Reminders | Cron-based reminder schedule | M06-S1 | P0 |
| M06-S9 | Refunds | Full/partial with allocation reversal | M06-S3, M06-S6 | P0 |
| M06-S10 | Financial Reports | Collection, fund, aging, status | M06-S3 | P0 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
