# MODULE_SPEC: dues

> Written from actual source inspection. See template at `docs/quality/MODULE_SPEC_TEMPLATE.md`.

## 1. Purpose
Dues payment processing for member organisations. Owns the public-facing one-tap payment flow (tokenised links sent by email), the officer-facing dues dashboard and member summary, Stripe webhook ingestion, and receipt download. Invoice and dues-config lifecycle live in `association:member` — this module handles the payment execution layer and token-gated checkout.

## 2. Bounded Context
**In scope**: Stripe webhook ingestion, payment token generation/validation/checkout, PDF receipt download, dues dashboard stats (org-level), dues member summary (member-level), dues metrics.

**Out of scope**: Invoice creation, dues configuration, fund allocation rules, dunning campaign orchestration — those live in `association:member`. Stripe Connect account setup lives in `billing`.

**Adjacent modules**:
- `association:member` — owns `DuesRepository` (`repos/dues-payments.repo.ts`) and `DuesInvoice` records; `dues` handlers import from there.
- `billing` — provides `billing.verifyWebhookSignature()` used by `stripeWebhook.ts`.
- `communication` — reminder emails that contain one-tap payment token URLs are sent from `communication`.

## 3. Handler Inventory
| Handler file | Verb + Path | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `validatePaymentToken.ts` | `GET /pay/:token` | **NONE** (public) | TBD | Validates HMAC-SHA256 token, returns invoice/amount/member info or error hint (already_paid, expired, etc.) |
| `checkoutPaymentToken.ts` | `POST /pay/:token/checkout` | **NONE** (public) | TBD | Validates token, creates Stripe checkout session, marks token used (single-use, double-pay prevention). Returns `{ checkoutUrl }` |
| `downloadReceipt.ts` | `GET /dues/receipts/:invoiceId` | bearerAuth (member or officer) | TBD | Download PDF receipt for a paid invoice |
| `getDuesDashboard.ts` | `GET /dashboard/:organizationId` | bearerAuth, position: Treasurer/President | `TBD` | Org-level dues stats: totalCollected, totalOutstanding, paidCount, unpaidCount, collectionRate, memberCount |
| `getDuesMemberSummary.ts` | `GET /dues/members/:memberId` | bearerAuth | TBD | Member-level dues summary |
| `getDuesMetrics.ts` | `GET /dues/metrics` | bearerAuth | TBD | Aggregate dues metrics (likely org-scoped) |
| `sendPaymentLink.ts` | `POST /dues/payment-links` | bearerAuth (officer) | TBD | Generates HMAC-SHA256 token, stores hash, emails one-tap payment link |
| `stripeWebhook.ts` | `POST /webhooks/stripe` | **NONE** (Stripe signature verified) | `auditAction()` called directly | Hand-wired BEFORE auth middleware. Verifies Stripe signature, dispatches to `webhookRetryProcessor` |

**Background jobs** (in `jobs/`):
| Job file | Trigger | Purpose |
|---|---|---|
| `jobs/autoInvoiceGenerator.ts` | Cron | Auto-generates dues invoices for the upcoming cycle |
| `jobs/processStripePayment.ts` | Called by webhook processor | Idempotent Stripe payment application |
| `jobs/reminderProcessor.ts` | Cron | Sends dues reminder emails |
| `jobs/webhookRetryProcessor.ts` | Called by stripeWebhook | Idempotent event dispatch with retry semantics |

## 4. TypeSpec source
`specs/api/src/modules/dues-custom.tsp` — covers payment token models (`PaymentTokenValidation`, `PaymentCheckoutResponse`) and the officer-facing dashboard endpoint.

> **Note**: Some dues endpoints may also be covered in the main association module TypeSpec. Cross-reference `specs/api/src/modules/` for `dues` references.

## 5. Database schema
`services/api-ts/src/handlers/dues/repos/`:
- `dues.schema.ts` — `dues_config_status` enum (active/retired), `dues_invoice_status` enum (generated/sent/paid/overdue/cancelled/writtenOff), `FundAllocation` JSONB shape, `DuesInvoiceAllocation` JSONB shape
- `payment-token.schema.ts` — `payment_token` table: `token_hash` (HMAC-SHA256, never raw), `person_id` FK, `organization_id` FK, `invoice_id`, `amount` (cents), `currency` (default PHP), `expires_at` (72h), `used_at`
- `dues-payments.repo.ts` — canonical dues repo (imported from `association:member/repos/dues-payments.repo.ts`)
- `payment-token.repo.ts` — payment token lookup + mark-used operations

## 6. Cross-module dependencies
- **Emits domain events**: none.
- **Consumes events from**: none.
- **Calls into**:
  - `association:member/repos/dues-payments.repo.ts` (`DuesRepository`) — all invoice/payment queries.
  - `billing` — `billing.verifyWebhookSignature()` in `stripeWebhook.ts`.
  - `core/audit/audit-action.ts` — called directly in `stripeWebhook.ts` (hand-wired; cannot use `@extension`).

## 7. Test coverage status
- Unit tests: Multiple test files with significant coverage:
  - `checkoutPaymentToken.test.ts`, `downloadReceipt.test.ts`, `validatePaymentToken.test.ts`, `sendPaymentLink.test.ts`, `getDuesDashboard.test.ts`, `stripeWebhook.test.ts`, `stripeWebhook.integration.test.ts`, `dues-config.test.ts`, `bulkRecordPayments.test.ts`
  - Plus job tests: `jobs/autoInvoiceGenerator.test.ts`, `jobs/index.test.ts`, `jobs/processStripePayment.test.ts`
  - **~8/8 handlers** have coverage (stripeWebhook has both unit + integration tests).
- Contract scenarios: `dues-dashboard-flow.hurl`, `dues-flow.hurl`, `assoc-dues-configs-flow.hurl`, `assoc-dues-gateway-flow.hurl`, `assoc-dues-invoices-flow.hurl`, `assoc-dues-payments-flow.hurl`, `assoc-dues-reporting-flow.hurl` — **7 Hurl files** covering dues domain.
- E2E: Extensive — `member/dues.spec.ts`, `member/payments.spec.ts`, `officer/dues-reminders.spec.ts`, `officer/payments.spec.ts`, `officer/payment-expiry.spec.ts`, `officer/payment-refund.spec.ts`, `officer/payment-correction.spec.ts`, `states/dues-states.spec.ts`, `actions/dues-actions.spec.ts`, `cross-persona/treasurer-records-dues-member-sees-receipt.spec.ts` — **10 E2E specs**.

## 8. Hand-wired routes (if any)
Four handlers are hand-wired in `app.ts` (per lines 96–114):
- `downloadReceipt` — wired separately (likely auth + streaming concerns)
- `stripeWebhook` — must be wired BEFORE auth middleware (Stripe raw body + signature)
- `validatePaymentToken` — public, no auth (token is its own credential)
- `checkoutPaymentToken` — public, no auth

**Allowed reason for stripeWebhook**: middleware ordering (raw body must be read before any JSON parsing). For the token routes: public unauthenticated paths.

See `docs/quality/HAND_WIRED_ROUTES.yaml` — verify these entries exist.

## 9. Known gotchas
- **Token is single-use**: `checkoutPaymentToken` marks `used_at` on checkout initiation, not on payment confirmation. If the Stripe checkout is abandoned, the token is consumed — member needs a new link.
- **Token hash only**: `payment_token` table stores HMAC-SHA256 hash, never the raw token. The raw token travels only in the email link. `getPaymentTokenSecret()` from `utils/payment-token.ts` must be configured via env var.
- **Currency default PHP**: Hardcoded default in schema. Multi-currency not currently supported.
- **stripeWebhook idempotency**: Events are dispatched through `webhookRetryProcessor` which provides idempotency via `idempotencyKey = event.id`. Do not bypass this processor.
- **DuesRepository cross-import**: `dues/` handlers import `DuesRepository` from `association:member/repos/dues-payments.repo.ts`. The deprecated `dues/repos/dues.repo.ts` was removed (per `app.ts` comment line 493).

## 10. AI extension checklist

To add a new endpoint to this module:
1. `specs/api/src/modules/dues-custom.tsp` — declare operation + `@extension`s (or main assoc module if org-scoped)
2. `services/api-ts/src/handlers/dues/<verbResource>.ts` — handler impl
3. `services/api-ts/src/handlers/dues/<verbResource>.test.ts` — unit test
4. `specs/api/tests/contract/dues-<verb>-flow.hurl` — contract scenario
5. Run: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`
6. Frontend hook auto-generated; no manual SDK edits

**Special case — public/unauthenticated routes**: If adding a route with no auth (like payment token endpoints), it MUST be hand-wired in `app.ts` BEFORE the auth middleware block. Document the reason in `HAND_WIRED_ROUTES.yaml`.

Forbidden:
- Editing `services/api-ts/src/generated/**`
- Importing `DuesRepository` from anywhere other than `association:member/repos/dues-payments.repo.ts`
- Storing raw payment tokens (always hash with HMAC-SHA256)
- Verb prefixes `new*`/`make*`/`do*`/`process*`
