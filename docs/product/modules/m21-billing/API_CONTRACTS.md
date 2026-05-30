<!-- oli:api-contracts v0.1 | generated 2026-05-30 | source: TypeSpec → OpenAPI -->
# API Contracts — Billing (M21)

> Source: TypeSpec at `specs/api/src/modules/billing.tsp` → OpenAPI at `specs/api/dist/openapi/openapi.json`
> Conventions: `API_CONVENTIONS.md` | Errors: `ERROR_TAXONOMY.md`
> Audit-grade scaffold (Wave G6). Promote to v1.0 with per-endpoint detail when the module reaches full coverage parity with m05.

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/billing` |
| Auth default | GA (session cookie or Bearer token) for invoices/merchant routes; **public** for `/billing/webhooks/stripe` (signed request validation) |
| Rate limit tier | Authenticated (120 req/min); webhook bypasses rate limit |
| Tenant scoping | Session orgContext middleware on `/billing/*` (`app.ts:429`) except webhook |
| External integration | Stripe Connect (test + live); requires `STRIPE_SECRET_KEY` env var (503 graceful fallback when unset — see `/my/billing` UI) |

---

## 2. Endpoints

### 2.1 Invoices

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/billing/invoices` | listInvoices | officer / member (own) |
| POST | `/billing/invoices` | createInvoice | officer |
| GET | `/billing/invoices/{invoice}` | getInvoice | officer / member (own) |
| PATCH | `/billing/invoices/{invoice}` | updateInvoice | officer |
| DELETE | `/billing/invoices/{invoice}` | deleteInvoice | officer (draft only) |
| POST | `/billing/invoices/{invoice}/finalize` | finalizeInvoice | officer |
| POST | `/billing/invoices/{invoice}/pay` | payInvoice | member (own) / officer |
| POST | `/billing/invoices/{invoice}/capture` | captureInvoicePayment | officer (manual capture mode) |
| POST | `/billing/invoices/{invoice}/refund` | refundInvoicePayment | officer / admin |
| POST | `/billing/invoices/{invoice}/void` | voidInvoice | officer (pre-payment) |
| POST | `/billing/invoices/{invoice}/mark-uncollectible` | markInvoiceUncollectible | officer / admin |

### 2.2 Merchant accounts

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| POST | `/billing/merchant-accounts` | createMerchantAccount | officer (owner) |
| GET | `/billing/merchant-accounts/{merchantAccount}` | getMerchantAccount | officer (owner) / admin |
| POST | `/billing/merchant-accounts/{merchantAccount}/onboard` | onboardMerchantAccount | officer (owner) |
| POST | `/billing/merchant-accounts/{merchantAccount}/dashboard` | getMerchantDashboard | officer (owner) |

### 2.3 Webhooks (public, signed)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| POST | `/billing/webhooks/stripe` | handleStripeWebhook | none (Stripe-Signature header validated) |

Hand-wired: `app.ts` — public route registered before auth middleware.

---

## 3. Domain Events Published

Audit-grade stub. See `docs/audits/codebase-map/events.json` for the authoritative ledger.

- `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_captured`, `invoice.refunded`, `invoice.voided`, `invoice.uncollectible`
- `merchant_account.created`, `merchant_account.onboarding_started`, `merchant_account.onboarding_completed`
- `stripe.webhook.received` (audit)

## 4. Domain Events Consumed

- `dues.invoice.due` (auto-finalize)
- `person.deleted` (cascade outstanding invoice voiding per retention rules)

## 5. Shared Types

- `Invoice`, `MerchantAccount`, `InvoiceStatus`, `PaymentIntent` — see OpenAPI `#/components/schemas/`
- Stripe types: forwarded under `#/components/schemas/Stripe*`
- Error taxonomy: `ExternalServiceError` (503) when Stripe unreachable or `STRIPE_SECRET_KEY` unset
