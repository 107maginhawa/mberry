# Module Specification: Billing (M21)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 1.0
Last Updated: 2026-05-29
Last Validated Against: DOMAIN_MODEL.md v1.0, EVENT_CONTRACTS.md v1.0
---

## 1. Module Overview

### Purpose
Stripe Connect billing infrastructure for the platform. Manages merchant accounts (connected Stripe accounts for organizations), invoices with line items, payment processing, refunds, and webhook handling. Provides the payment rail that other modules (M06 Dues, M08 Events) use for monetary transactions.

### Users
- Organization Admin — configure billing, onboard merchant account, view invoices
- Member — view/pay invoices
- System — process webhooks, handle payment state transitions, retry failed payments

### Related Modules
- M06 (Dues — creates invoices for membership fees)
- M08 (Events — paid event registration fees)
- M03 (Platform Admin — billing configuration per org)

### In Scope
- Merchant account CRUD (Stripe Connect onboarding)
- Invoice lifecycle: create → send → pay → complete, with void/refund paths
- Invoice line items
- Payment processing via Stripe Payment Intents
- Stripe webhook handling (signature verification)
- Refund processing
- Per-org billing configuration (AES-256 encrypted API keys)

### Out of Scope
- Dues-specific business logic (M06)
- Subscription management (future)
- Tax calculation (delegated to Stripe)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Merchant Account | Stripe Connect account linked to a person for receiving payments. |
| Invoice | Billing document with line items, status tracking, and payment linkage. Stripe-aligned model. |
| Line Item | Individual charge on an invoice (description, quantity, unit price, tax). |
| Billing Config | Per-organization payment gateway configuration with encrypted Stripe keys. |
| Payment Intent | Stripe object representing a payment attempt. Created when invoice is paid. |
| Webhook | Stripe callback notifying payment state changes (succeeded, failed, refunded). |

## 3. Workflows

| WF-ID | Workflow | Actor | Description | Priority | Anchors |
|-------|----------|-------|-------------|----------|---------|
| WF-M21-01 | Onboard Merchant | Admin | Create Stripe Connect account, complete onboarding flow | P0 | BR-60, M21-R1 |
| WF-M21-02 | Create Invoice | System/Admin | Generate invoice with line items for dues/events/services | P0 | BR-66, M21-R7 |
| WF-M21-03 | Pay Invoice | Member | Process payment via Stripe Payment Intent | P0 | BR-60, BR-61, M21-R1, M21-R2 |
| WF-M21-04 | Refund Payment | Admin | Process full or partial refund | P0 | BR-64, M21-R5 |
| WF-M21-05 | Handle Webhook | System | Process Stripe webhook events (payment success/failure/refund) | P0 | BR-62, BR-63, M21-R3, M21-R4 |
| WF-M21-06 | View Invoices | Member/Admin | List and filter invoices by status/date | P0 | BR-66 |

> **Note:** `WF-M21-*` IDs are module-scoped pending promotion to the canonical WORKFLOW_MAP registry (deferred — touches outside `m21-billing/` are out of scope for TR-P1-002). Anchors reference billing-module BR-* added in `br-registry.json` plus local `M21-R*` business rules.

## 4. Business Rules

| Rule ID | Canonical BR | Rule | Applies To | Expected Behavior |
|---------|--------------|------|-----------|-------------------|
| M21-R1 | BR-60 | IF merchant account does not exist THEN block payment processing for that person | Payments | Require merchant onboarding first |
| M21-R2 | BR-61 | IF invoice status is `paid` or `void` THEN reject further payment attempts | Invoice | Prevent double-payment |
| M21-R3 | BR-62 | IF Stripe webhook signature invalid THEN reject with 400 | Webhooks | Signature verification mandatory |
| M21-R4 | BR-63 | IF payment_intent.succeeded webhook received THEN mark invoice paid | Webhooks | Automated payment confirmation |
| M21-R5 | BR-64 | IF refund requested THEN validate original payment exists and is in paid status | Refunds | Cannot refund unpaid invoice |
| M21-R6 | BR-65 | IF billing config keys stored THEN encrypt with AES-256 | Config | Secrets at rest |
| M21-R7 | BR-66 | IF invoice has line items THEN total = sum of (quantity × unitPrice) per item | Invoices | Calculated total, not user-supplied |

> Canonical `BR-*` IDs are registered in `docs/ver-3/business/br-registry.json` and serve as the cross-module trace anchors used by §8 API Expectations and §11b Acceptance Criteria.

## 5. Permissions

| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| Create merchant account | Authenticated person (owner) | Person creates own merchant account |
| Get/update merchant account | Owner only | Self-service |
| Onboard merchant | Owner only | Generates Stripe onboarding link |
| Create invoice | Admin, system | Officers create for org members |
| Get invoice | Invoice recipient or admin | Scoped access |
| List invoices | Authenticated | Filtered by role |
| Pay invoice | Invoice recipient | Self-service payment |
| Void invoice | Admin | Before payment |
| Refund invoice payment | Admin | After payment |
| Handle webhook | System (Stripe) | Signature-verified, no user auth |

## 6. Data Requirements

### Entity: BillingConfig (7 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Org FK | Unique per org |
| stripePublishableKey | No | Public Stripe key | AES-256 encrypted |
| stripeSecretKey | No | Secret Stripe key | AES-256 encrypted |
| stripeWebhookSecret | No | Webhook signing secret | AES-256 encrypted |
| stripeAccountId | No | Connected account ID | String |
| currency | Yes | Default currency | Default 'PHP' |
| isActive | Yes | Gateway enabled | Boolean |

### Entity: Invoice (19 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| invoiceNumber | Yes | Human-readable number | Unique per org |
| personId | Yes | Recipient person FK | UUID |
| status | Yes | draft/sent/paid/void/refunded/partially_refunded | Enum |
| currency | Yes | Payment currency | Default 'PHP' |
| subtotal | Yes | Sum of line items | Bigint |
| taxTotal | No | Total tax | Bigint |
| total | Yes | subtotal + taxTotal | Bigint |
| amountPaid | No | Amount received | Bigint |
| amountRefunded | No | Amount refunded | Bigint |
| dueDate | No | Payment deadline | Date |
| paidAt | No | Payment timestamp | Timestamptz |
| stripePaymentIntentId | No | Stripe PI reference | String |
| stripeInvoiceId | No | Stripe invoice reference | String |
| description | No | Invoice description | Text |
| metadata | No | Additional data | JSONB |
| notes | No | Internal notes | Text |
| sentAt | No | When invoice was sent | Timestamptz |
| voidedAt | No | When invoice was voided | Timestamptz |

### Entity: InvoiceLineItem (6 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| invoiceId | Yes | Invoice FK | Cascade delete |
| description | Yes | Line item description | Text |
| quantity | Yes | Item quantity | Positive integer |
| unitPrice | Yes | Price per unit | Bigint |
| taxRate | No | Tax percentage | Decimal |
| amount | Yes | quantity × unitPrice | Bigint, computed |

### Entity: MerchantAccount (4 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| personId | Yes | Owner person FK | Unique |
| stripeAccountId | No | Stripe Connect account ID | String |
| status | Yes | pending/active/restricted/disabled | Enum |
| metadata | No | Account metadata | JSONB |

## 7. State Transitions

### SM-M21-INVOICE — Invoice Status
Anchors: BR-61 (terminal-state guard), BR-63 (auto-mark paid), BR-64 (refund precondition).
```
Draft ──send──► Sent ──pay──► Paid
Draft ──void──► Void
Sent ──void──► Void
Paid ──refund──► Refunded
Paid ──partial_refund──► PartiallyRefunded
```

### SM-M21-MERCHANT — Merchant Account Status
Anchors: BR-60 (merchant-required guard), WF-M21-01 (onboarding workflow).
```
Pending ──onboard_complete──► Active
Active ──restrict──► Restricted
Restricted ──resolve──► Active
Active ──disable──► Disabled
```

## 8. API Expectations

Every endpoint anchors to ≥1 spec ID (BR-* in `br-registry.json`, M21-R* in §4, WF-M21-* in §3, AC-M21-* in §11b, or SM-M21-* in §7) — restores trace chain per TR-P1-002.

| API Need | Method | Route | Auth | Handler | Spec Anchors | Notes |
|----------|--------|-------|------|---------|--------------|-------|
| Create invoice | POST | /billing/invoices | Required | `createInvoice.ts` | BR-66, M21-R7, WF-M21-02, AC-M21-002 | Admin/system; line-item sum enforced |
| Get invoice | GET | /billing/invoices/:id | Required | `getInvoice.ts` | WF-M21-06 | Recipient or admin |
| List invoices | GET | /billing/invoices | Required | `listInvoices.ts` | WF-M21-06 | Role-filtered |
| Update invoice | PUT | /billing/invoices/:id | Required | `updateInvoice.ts` | BR-61, M21-R2, SM-M21-INVOICE | Draft only (terminal-state guard) |
| Delete invoice | DELETE | /billing/invoices/:id | Required | `deleteInvoice.ts` | BR-61, M21-R2, SM-M21-INVOICE | Draft only |
| Finalize invoice (Send) | POST | /billing/invoices/:id/finalize | Required | `finalizeInvoice.ts` | SM-M21-INVOICE, WF-M21-02 | Draft → Sent transition |
| Pay invoice | POST | /billing/invoices/:id/pay | Required | `payInvoice.ts` | BR-60, BR-61, M21-R1, M21-R2, WF-M21-03, AC-M21-001 | Creates Payment Intent |
| Capture invoice payment | POST | /billing/invoices/:id/capture | Required | `captureInvoicePayment.ts` | BR-61, BR-63, SM-M21-INVOICE, WF-M21-03 | Manual capture after auth |
| Void invoice | POST | /billing/invoices/:id/void | Required | `voidInvoice.ts` | BR-61, M21-R2, SM-M21-INVOICE | Before payment |
| Mark invoice uncollectible | POST | /billing/invoices/:id/uncollectible | Required | `markInvoiceUncollectible.ts` | SM-M21-INVOICE, WF-M21-06 | Admin write-off path |
| Refund invoice payment | POST | /billing/invoices/:id/refund | Required | `refundInvoicePayment.ts` | BR-64, M21-R5, WF-M21-04, AC-M21-005 | Validates paid status |
| Create merchant account | POST | /billing/merchants | Required | `createMerchantAccount.ts` | BR-60, M21-R1, WF-M21-01 | Owner auto-set |
| Get merchant account | GET | /billing/merchants/:id | Required | `getMerchantAccount.ts` | BR-60, WF-M21-01 | Owner only |
| Onboard merchant | POST | /billing/merchants/:id/onboard | Required | `onboardMerchantAccount.ts` | BR-60, M21-R1, WF-M21-01, SM-M21-MERCHANT, AC-M21-006 | Generates Stripe link |
| Get merchant dashboard | GET | /billing/merchants/:id/dashboard | Required | `getMerchantDashboard.ts` | BR-65, M21-R6, WF-M21-01 | Owner only; Stripe Express link |
| Stripe webhook | POST | /billing/webhooks/stripe | None (signature) | `handleStripeWebhook.ts` | BR-62, BR-63, M21-R3, M21-R4, WF-M21-05, AC-M21-003, AC-M21-004 | Signature-verified |

**TypeSpec:** `specs/api/src/modules/billing.tsp` — COMPLETE (operations defined across InvoiceManagement and MerchantAccountManagement interfaces; routes auto-generated under `services/api-ts/src/generated/openapi/`).

## 9. Domain Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| InvoicePaid | Payment succeeded | invoiceId, personId, amount | M06 (dues payment confirmation), M07 (receipt notification) |
| InvoiceRefunded | Refund processed | invoiceId, personId, refundAmount | M06 (dues refund), M07 (refund notification) |
| MerchantOnboarded | Stripe onboarding complete | merchantAccountId, personId | M03 (org billing status) |
| PaymentFailed | Payment attempt failed | invoiceId, personId, error | M07 (failure notification) |

## 10. Dependencies

| Module | Why Needed |
|--------|------------|
| person (M02) | Invoice recipient and merchant account owner identity |
| communications (M07) | Payment confirmation/failure notifications |
| Stripe Connect (external) | Payment processing, merchant onboarding |

## 11. AI Instructions

When implementing this module:
1. **Schema location:** `services/api-ts/src/handlers/billing/repos/billing.schema.ts` — all tables defined here.
2. **TypeSpec:** `specs/api/src/modules/billing.tsp` — fully defined with InvoiceManagement + MerchantAccountManagement interfaces.
3. **Stripe webhook:** Signature verification is mandatory. TypeSpec defines `stripe-signature` header pattern.
4. **Encrypted keys:** Billing config stores Stripe keys with AES-256 encryption. Never log or expose in API responses.
5. **Money as bigint:** All monetary values stored as bigint (cents/centavos). No floating point.
6. **Webhook idempotency:** Handle duplicate webhook deliveries gracefully (check if already processed).
7. **Multi-tenant:** All queries scope by `organizationId`.
8. **16 handlers** already implemented — full invoice + merchant CRUD + payment + webhook.

## 11b. Acceptance Criteria

### AC-M21-001: Merchant Required for Payment
**Given** a person without an active merchant account
**When** they attempt `POST /billing/invoices/:id/pay`
**Then** the request is rejected with `MERCHANT_NOT_CONFIGURED` (422) and no Payment Intent is created.
Anchors: BR-60, M21-R1, WF-M21-03

### AC-M21-002: Line-Item Total Integrity
**Given** an invoice with N line items
**When** the invoice is created or finalized
**Then** `invoice.total == sum(lineItem.quantity * lineItem.unitPrice)` exactly; user-supplied totals are ignored.
Anchors: BR-66, M21-R7, WF-M21-02

### AC-M21-003: Webhook Signature Verification
**Given** a webhook POST to `/billing/webhooks/stripe` with an invalid `stripe-signature` header
**When** the handler runs
**Then** the response is 400 and no invoice state mutation occurs.
Anchors: BR-62, M21-R3, WF-M21-05

### AC-M21-004: Idempotent Webhook Processing
**Given** a `payment_intent.succeeded` webhook already processed (same event ID)
**When** the same event arrives again
**Then** the handler returns 200 OK with no duplicate `paid` transition.
Anchors: BR-63, M21-R4, WF-M21-05, SM-M21-INVOICE

### AC-M21-005: Refund Precondition
**Given** an invoice in any status other than `paid` or `partially_refunded`
**When** `POST /billing/invoices/:id/refund` is called
**Then** the request is rejected with `INVALID_REFUND_STATE` (422); refund only proceeds against a captured payment.
Anchors: BR-64, M21-R5, WF-M21-04

### AC-M21-006: Stripe Connect Onboarding Round-Trip
**Given** an admin initiates merchant onboarding
**When** Stripe returns onboarding completion
**Then** `merchantAccount.status` transitions `pending → active` and `MerchantOnboarded` is emitted.
Anchors: BR-60, M21-R1, WF-M21-01, SM-M21-MERCHANT

### AC-M21-007: Encrypted Key Storage
**Given** an org sets Stripe credentials via billing config
**When** values are persisted
**Then** `stripePublishableKey`, `stripeSecretKey`, `stripeWebhookSecret` are encrypted at rest (AES-256); responses never include plaintext.
Anchors: BR-65, M21-R6

## 12. Section Completeness

| Section | Status |
|---------|--------|
| 1. Module Overview | COMPLETE |
| 2. Domain Terms | COMPLETE |
| 3. Workflows | COMPLETE (6 workflows, WF-M21-01..06 anchors) |
| 4. Business Rules | COMPLETE (7 rules, canonical BR-60..BR-66) |
| 5. Permissions | COMPLETE |
| 6. Data Requirements | COMPLETE (4 entities) |
| 7. State Transitions | COMPLETE (SM-M21-INVOICE, SM-M21-MERCHANT) |
| 8. API Expectations | COMPLETE (16 endpoints, each anchored to ≥1 BR-*/WF-*/AC-*/SM-*) |
| 9. Domain Events | COMPLETE |
| 10. Dependencies | COMPLETE |
| 11. AI Instructions | COMPLETE |
| 11b. Acceptance Criteria | COMPLETE (AC-M21-001..007) |

## 13. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | Claude | Initial spec from existing codebase (Wave 8 coverage) |
| 1.1 | 2026-06-02 | Claude | TR-P1-002 fix: minted BR-60..BR-66 in `br-registry.json`; added WF-M21-01..06 to §3, SM-M21-INVOICE/MERCHANT to §7, AC-M21-001..007 in §11b, and per-endpoint `Spec Anchors` column in §8 so every endpoint resolves to ≥1 BR-*/WF-*/AC-*/SM-* ID. |
