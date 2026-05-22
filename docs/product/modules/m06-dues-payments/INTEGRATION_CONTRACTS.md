<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md M06, ARCHITECTURE.md -->
# Integration Contracts — Dues & Payments (M06)

## 1. Stripe Connect

| Property | Value |
|----------|-------|
| Provider | Stripe |
| API version pinned | `2024-04-10` |
| SDK | `stripe` npm package |
| Auth | API key (`STRIPE_SECRET_KEY`) |
| Test strategy | Stripe test mode (sandbox) |
| Docs | https://docs.stripe.com/api |

### Endpoints Called

| Stripe Endpoint | Purpose | Memberry Trigger |
|----------------|---------|------------------|
| `POST /v1/payment_intents` | Create payment intent | Member initiates dues payment |
| `POST /v1/payment_intents/:id/confirm` | Confirm payment | Payment method attached |
| `POST /v1/refunds` | Process refund | Officer initiates refund |
| `GET /v1/payment_intents/:id` | Check payment status | Webhook verification |
| `POST /v1/customers` | Create customer record | First payment by member |
| `GET /v1/customers/:id` | Retrieve customer | Payment flow lookup |
| `POST /v1/accounts` | Create connected account | Org billing setup (Connect) |
| `POST /v1/account_links` | Generate onboarding link | Org billing onboarding |

### Webhook Events Subscribed

| Event | Handler | Side Effect |
|-------|---------|-------------|
| `payment_intent.succeeded` | `recordPayment` | Update dues_payment status, extend expiry |
| `payment_intent.payment_failed` | `handlePaymentFailed` | Mark payment failed, notify member |
| `charge.refunded` | `handleRefund` | Update payment record, notify member |
| `account.updated` | `handleAccountUpdate` | Update org billing status |

### Error Handling

| Stripe Error | Maps To | User Message |
|-------------|---------|--------------|
| `card_declined` | `M06-006` | Payment method declined |
| `insufficient_funds` | `M06-006` | Payment method declined |
| `rate_limit` | `EXT-001` | Payment provider unavailable |
| `api_connection_error` | `EXT-001` | Payment provider unavailable |
| `api_error` | `EXT-001` | Payment provider unavailable |
| `invalid_request_error` | `INTERNAL-001` | Internal server error (log + alert) |

### Circuit Breaker

| Parameter | Value |
|-----------|-------|
| Failure threshold | 5 consecutive failures |
| Recovery timeout | 60 seconds |
| Fallback | Return 502 with `EXT-001`, queue for retry |
| Health check | `GET /v1/balance` (lightweight) |

### Secret Policy

| Secret | Env Var | Injection | Redaction |
|--------|---------|-----------|-----------|
| API key (secret) | `STRIPE_SECRET_KEY` | Environment variable | Mask all but last 4 chars |
| Webhook signing secret | `STRIPE_WEBHOOK_SECRET` | Environment variable | Never log |
| Publishable key | `STRIPE_PUBLISHABLE_KEY` | Environment variable (frontend) | Public — no redaction needed |
