# F2: Dues & Payments — Implementation Design

**Date:** 2026-05-02
**Module:** M06 Dues & Payments
**Branch:** feature/phase0-foundation
**Approach:** Dues domain layer wrapping generic billing primitives

## Overview

Build the complete Dues & Payments flow for Memberry: member payment history, officer financial dashboard, manual payment recording, refund handling, dues configuration, fund allocation, gateway setup, and financial reports. 8 screens total (1 member, 7 officer).

## Architecture Decision

**Approach A: Dues domain layer on top of billing primitives.**

The existing `billing` module provides generic invoice/payment/merchant infrastructure (Stripe Connect, webhooks, line items). The `dues` module adds association-specific domain logic:

- Fund allocation splits with last-fund rounding (M6-R1)
- Receipt numbering: `ORG_CODE-YEAR-SEQUENTIAL` (M6-R6)
- Concurrent payment detection within 5-min window (M6-R4)
- Automated reminder scheduling via notifs module (M6-R5)
- Membership status extension on payment
- Per-category dues overrides
- Grace period management

The dues module creates billing invoices internally but exposes its own endpoints to the frontend.

## Backend: Dues Module

### Location

`services/api-ts/src/handlers/dues/`

### Database Schema (`repos/dues.schema.ts`)

```
dues_config
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── default_amount (integer, cents)
├── currency (varchar(3), default 'PHP')
├── billing_frequency ('annual' | 'quarterly')
├── due_date_month (integer, 1-12, nullable — annual only)
├── due_date_day (integer, 1-31)
├── grace_period_days (integer, 0-365, default 30)
├── created_at, updated_at
└── UNIQUE(organization_id)

dues_category_override
├── id (uuid, PK)
├── dues_config_id (uuid, FK → dues_config)
├── category_id (uuid, FK → membership_categories)
├── override_amount (integer, cents)
└── UNIQUE(dues_config_id, category_id)

dues_fund
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── name (varchar(100))
├── percentage (numeric(5,2))
├── sort_order (integer)
├── active (boolean, default true)
├── created_at, updated_at
└── INDEX(organization_id, sort_order)

dues_payment
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── person_id (uuid, FK → persons)
├── invoice_id (uuid, FK → invoices, nullable)
├── receipt_number (varchar(50), UNIQUE)
├── amount (integer, cents)
├── currency (varchar(3))
├── payment_method ('online' | 'cash' | 'check' | 'bank_transfer' | 'gcash' | 'other')
├── reference_number (varchar(100), nullable)
├── status ('pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded' | 'expired')
├── recorded_by (uuid, FK → persons, nullable — officer for manual)
├── membership_extended_from (date, nullable)
├── membership_extended_to (date, nullable)
├── paid_at (timestamp, nullable)
├── expired_at (timestamp, nullable)
├── refunded_amount (integer, default 0)
├── metadata (jsonb)
├── created_at, updated_at
└── INDEX(organization_id, person_id, status)

dues_fund_allocation
├── id (uuid, PK)
├── payment_id (uuid, FK → dues_payment)
├── fund_id (uuid, FK → dues_fund)
├── amount (integer, cents)
├── is_reversal (boolean, default false)
├── created_at
└── INDEX(payment_id)

dues_reminder_schedule
├── id (uuid, PK)
├── dues_config_id (uuid, FK → dues_config)
├── days_offset (integer, negative = before expiry, positive = after)
├── enabled (boolean, default true)
├── channel_inapp (boolean, default true)
├── channel_push (boolean, default true)
├── channel_email (boolean, default true)
├── is_custom (boolean, default false)
└── INDEX(dues_config_id)

dues_gateway_config
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── provider ('paymongo' | 'stripe')
├── public_key (varchar(255))
├── encrypted_secret (text) — encrypted at rest
├── connected (boolean, default false)
├── last_test_at (timestamp, nullable)
├── created_at, updated_at
└── UNIQUE(organization_id)
```

### Handlers

| Handler | Method | Route | Access |
|---------|--------|-------|--------|
| getDuesConfig | GET | `/api/dues/config/:orgId` | Treasurer |
| upsertDuesConfig | PUT | `/api/dues/config/:orgId` | Treasurer |
| listFunds | GET | `/api/dues/funds/:orgId` | Treasurer |
| upsertFunds | PUT | `/api/dues/funds/:orgId` | Treasurer |
| listPayments | GET | `/api/dues/payments` | Member (own) / Treasurer (org) |
| getPayment | GET | `/api/dues/payments/:id` | Member (own) / Treasurer (org) |
| recordPayment | POST | `/api/dues/payments` | Treasurer |
| refundPayment | POST | `/api/dues/payments/:id/refund` | Treasurer |
| voidPayment | POST | `/api/dues/payments/:id/void` | Treasurer |
| confirmPayment | POST | `/api/dues/payments/:id/confirm` | Treasurer |
| getFinancialDashboard | GET | `/api/dues/dashboard/:orgId` | Treasurer |
| generateReport | GET | `/api/dues/reports/:orgId` | Treasurer |
| getGatewayConfig | GET | `/api/dues/gateway/:orgId` | Treasurer |
| upsertGatewayConfig | PUT | `/api/dues/gateway/:orgId` | Treasurer |
| testGatewayConnection | POST | `/api/dues/gateway/:orgId/test` | Treasurer |
| testGatewayTransaction | POST | `/api/dues/gateway/:orgId/test-transaction` | Treasurer |
| disconnectGateway | DELETE | `/api/dues/gateway/:orgId` | Treasurer |

### Domain Rules (Server-Side)

**M6-R1 — Last-fund rounding:**
Split payment amount across funds by percentage. The last fund in sort order absorbs rounding remainder so total always equals payment amount exactly.

```
Example: PHP 1,500.00 split across 3 funds (33%, 33%, 34%)
Fund 1: floor(1500 * 0.33) = 495
Fund 2: floor(1500 * 0.33) = 495
Fund 3: 1500 - 495 - 495 = 510 (absorbs remainder)
```

**M6-R4 — Concurrent payment detection:**
Before recording a payment, check if another payment for the same person+org was recorded in the last 5 minutes. If so, return a warning flag in the response (frontend shows confirmation dialog).

**M6-R5 — Reminder scheduling:**
On dues config save, upsert jobs in the notifs module for each enabled reminder trigger. Jobs fire relative to each member's expiry date.

**M6-R6 — Receipt numbering:**
Format: `{ORG_CODE}-{YEAR}-{NNNNNN}` where NNNNNN is zero-padded sequential per org per year. Generated atomically using a database sequence or `SELECT MAX + 1` with row lock.

## Frontend Structure

### Feature Directory

`apps/memberry/src/features/dues/`

```
features/dues/
├── components/
│   ├── payment-history-table.tsx      — filterable table (member + officer)
│   ├── payment-detail-panel.tsx       — expanded detail with fund breakdown
│   ├── payment-filters.tsx            — org/date/status/method filter bar
│   ├── record-payment-form.tsx        — member search + amount + live preview
│   ├── fund-allocation-editor.tsx     — drag-reorder, live total, 100% gate
│   ├── fund-allocation-preview.tsx    — read-only live split display
│   ├── dues-config-form.tsx           — (rewrite) frequency, grace, reminders
│   ├── reminder-schedule-editor.tsx   — toggle table + custom rows
│   ├── gateway-setup.tsx              — provider, keys, test, status card
│   ├── financial-dashboard.tsx        — 4 stat cards + action cards
│   ├── report-selector.tsx            — 4 report type cards
│   ├── report-filters.tsx             — contextual filters per report
│   ├── report-results.tsx             — data table + summary metrics
│   └── refund-form.tsx                — inline refund with amount + reason
├── hooks/
│   ├── use-dues-config.ts             — query + mutation for config
│   ├── use-payments.ts                — list/get/record/refund
│   ├── use-funds.ts                   — fund CRUD
│   ├── use-gateway.ts                 — gateway config + test
│   └── use-reports.ts                 — report generation
├── lib/
│   ├── money.ts                       — (exists) formatCents, parseCentsInput
│   ├── money.test.ts                  — (exists)
│   ├── fund-math.ts                   — last-fund rounding for preview
│   └── receipt-format.ts              — receipt number display formatting
└── types.ts                           — shared TypeScript interfaces
```

### Routes

| Route File | Screen | Role |
|------------|--------|------|
| `my/payments.tsx` | Member payment history | Member |
| `officer/payments.tsx` | Financial dashboard + payments table | Treasurer |
| `officer/payments/$paymentId.tsx` | Payment detail + refund | Treasurer |
| `officer/payments/new.tsx` | Record manual payment | Treasurer |
| `officer/settings/dues.tsx` | Dues configuration | Treasurer |
| `officer/settings/funds.tsx` | Fund allocation | Treasurer |
| `officer/settings/gateway.tsx` | Gateway setup (desktop only) | Treasurer |
| `officer/reports/financial.tsx` | Financial reports | Treasurer |

### Responsive Behavior

- Member payments: table on desktop → cards on mobile (infinite scroll)
- Officer dashboard: 4 stat cards in row → 2×2 grid on mobile
- Record payment: side-by-side preview → accordion on mobile
- Gateway setup: desktop only — mobile redirects to "desktop only" message
- Fund editor: drag handles for touch reorder on mobile
- Reports: horizontal scroll for wide tables on mobile

## Testing Strategy

### E2E Journey Tests (`apps/memberry/e2e/f2-dues-payments.spec.ts`)

1. **Officer configures dues** — set amount, frequency, grace period, category overrides, save
2. **Officer configures funds** — add 3 funds totaling 100%, reorder, save
3. **Officer records manual payment** — search member, confirm amount, see fund preview, submit
4. **Officer views dashboard** — stat cards show data, payments table populated
5. **Officer views payment detail** — fund breakdown visible, refund form works
6. **Officer refunds payment** — enter amount + reason, confirm, see reversal
7. **Member views payment history** — filter by org/status, expand detail
8. **Officer generates report** — select type, set date range, generate, verify data shown

### Unit Tests

- `fund-math.test.ts` — last-fund rounding edge cases (1 cent, 0, large amounts, 1 fund, many funds)
- `receipt-format.test.ts` — formatting + parsing
- Backend: `recordPayment.test.ts` — concurrent detection, membership extension, receipt generation
- Backend: `refundPayment.test.ts` — full/partial refund, fund reversal
- Backend: `generateReport.test.ts` — each report type with fixture data

## Implementation Order (Vertical Slices)

Each slice is independently shippable with its own E2E test.

| # | Slice | Screens | Dependencies |
|---|-------|---------|--------------|
| 1 | Dues Config + Funds | settings/dues, settings/funds | None |
| 2 | Record Payment | payments/new | Slice 1 (needs fund config) |
| 3 | Financial Dashboard | officer/payments | Slice 2 (needs payment data) |
| 4 | Payment Detail + Refund | payments/$paymentId | Slice 3 (navigates from table) |
| 5 | Member Payments | my/payments | Slice 2 (needs payment data) |
| 6 | Gateway Setup | settings/gateway | Slice 1 (config must exist) |
| 7 | Financial Reports | reports/financial | Slice 2 (needs payment data) |
| 8 | Reminders | (background jobs) | Slice 1 + notifs module |

## Notes

- Gateway encrypted secret uses Node.js `crypto.createCipheriv` with AES-256-GCM, key from env var
- Receipt PDF generation deferred — show receipt data in UI first, PDF export in later slice
- Reminder jobs are background (cron-based via existing jobs infrastructure)
- `dues_payment.invoice_id` links to billing module for online payments processed via Stripe/PayMongo
- Member payments view uses same `listPayments` endpoint with `?scope=member` query param
- Export CSV uses streaming response for large datasets
- "Membership extension" means updating the person's `membership_expires_at` field on their org membership record (adding billing_frequency duration from current expiry or today, whichever is later)
- Partial payments (amount < category rate) still extend membership by full period — the warning is informational only
