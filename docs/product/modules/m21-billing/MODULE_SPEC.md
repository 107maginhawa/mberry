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

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Onboard Merchant | Admin | Create Stripe Connect account, complete onboarding flow | P0 |
| Create Invoice | System/Admin | Generate invoice with line items for dues/events/services | P0 |
| Pay Invoice | Member | Process payment via Stripe Payment Intent | P0 |
| Refund Payment | Admin | Process full or partial refund | P0 |
| Handle Webhook | System | Process Stripe webhook events (payment success/failure/refund) | P0 |
| View Invoices | Member/Admin | List and filter invoices by status/date | P0 |

## 4. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M21-R1 | IF merchant account does not exist THEN block payment processing for that person | Payments | Require merchant onboarding first |
| M21-R2 | IF invoice status is `paid` or `void` THEN reject further payment attempts | Invoice | Prevent double-payment |
| M21-R3 | IF Stripe webhook signature invalid THEN reject with 400 | Webhooks | Signature verification mandatory |
| M21-R4 | IF payment_intent.succeeded webhook received THEN mark invoice paid | Webhooks | Automated payment confirmation |
| M21-R5 | IF refund requested THEN validate original payment exists and is in paid status | Refunds | Cannot refund unpaid invoice |
| M21-R6 | IF billing config keys stored THEN encrypt with AES-256 | Config | Secrets at rest |
| M21-R7 | IF invoice has line items THEN total = sum of (quantity × unitPrice) per item | Invoices | Calculated total, not user-supplied |

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

### Invoice Status
```
Draft ──send──► Sent ──pay──► Paid
Draft ──void──► Void
Sent ──void──► Void
Paid ──refund──► Refunded
Paid ──partial_refund──► PartiallyRefunded
```

### Merchant Account Status
```
Pending ──onboard_complete──► Active
Active ──restrict──► Restricted
Restricted ──resolve──► Active
Active ──disable──► Disabled
```

## 8. API Expectations

| API Need | Method | Route | Auth | Notes |
|----------|--------|-------|------|-------|
| Create invoice | POST | /billing/invoices | Required | Admin/system |
| Get invoice | GET | /billing/invoices/:id | Required | Recipient or admin |
| List invoices | GET | /billing/invoices | Required | Filtered |
| Update invoice | PUT | /billing/invoices/:id | Required | Draft only |
| Send invoice | POST | /billing/invoices/:id/send | Required | Admin |
| Pay invoice | POST | /billing/invoices/:id/pay | Required | Creates Payment Intent |
| Void invoice | POST | /billing/invoices/:id/void | Required | Before payment |
| Refund payment | POST | /billing/invoices/:id/refund | Required | Admin |
| Create merchant account | POST | /billing/merchants | Required | Owner auto-set |
| Get merchant account | GET | /billing/merchants/:id | Required | Owner only |
| Update merchant account | PUT | /billing/merchants/:id | Required | Owner only |
| Delete merchant account | DELETE | /billing/merchants/:id | Required | Owner only |
| List merchant accounts | GET | /billing/merchants | Required | Admin |
| Onboard merchant | POST | /billing/merchants/:id/onboard | Required | Generates Stripe link |
| Get merchant dashboard | GET | /billing/merchants/:id/dashboard | Required | Owner only |
| Stripe webhook | POST | /billing/webhooks/stripe | None (signature) | Stripe signature auth |

**TypeSpec:** `specs/api/src/modules/billing.tsp` — COMPLETE (all 16 operations defined across InvoiceManagement and MerchantAccountManagement interfaces)

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

## 12. Section Completeness

| Section | Status |
|---------|--------|
| 1. Module Overview | COMPLETE |
| 2. Domain Terms | COMPLETE |
| 3. Workflows | COMPLETE |
| 4. Business Rules | COMPLETE (7 rules) |
| 5. Permissions | COMPLETE |
| 6. Data Requirements | COMPLETE (4 entities) |
| 7. State Transitions | COMPLETE (2 state machines) |
| 8. API Expectations | COMPLETE (16 endpoints, TypeSpec COMPLETE) |
| 9. Domain Events | COMPLETE |
| 10. Dependencies | COMPLETE |
| 11. AI Instructions | COMPLETE |

## 13. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | Claude | Initial spec from existing codebase (Wave 8 coverage) |
