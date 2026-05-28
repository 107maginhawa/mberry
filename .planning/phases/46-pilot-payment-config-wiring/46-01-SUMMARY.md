---
phase: "46"
plan: "01"
subsystem: dues/billing
tags: [stripe, webhooks, payment-processing, job-infrastructure]
dependency-graph:
  requires: [billing-service, settle-payment, webhook-retry-processor]
  provides: [stripe-webhook-endpoint, real-payment-processing]
  affects: [association:member/jobs, dues/jobs, app.ts]
tech-stack:
  added: []
  patterns: [closure-factory, hand-wired-route]
key-files:
  created:
    - services/api-ts/src/handlers/dues/jobs/processStripePayment.ts
    - services/api-ts/src/handlers/dues/stripeWebhook.ts
    - services/api-ts/src/handlers/dues/jobs/processStripePayment.test.ts
    - services/api-ts/src/handlers/dues/stripeWebhook.test.ts
  modified:
    - services/api-ts/src/handlers/association:member/jobs/index.ts
    - services/api-ts/src/handlers/dues/jobs/index.ts
    - services/api-ts/src/app.ts
decisions:
  - "Closure factory pattern for processPayment to inject billing+db+logger dependencies"
  - "Webhook route placed before auth middleware as hand-wired public endpoint"
  - "T2+T3+T4 committed together since registerDuesJobs signature change requires all three"
metrics:
  duration: "7m17s"
  completed: "2026-05-28T10:49:56Z"
  tasks: 6
  files: 7
---

# Phase 46 Plan 01: Payment Job Infrastructure Summary

Wire DeferredScopeError payment stubs to real Stripe settlement logic via closure factory, add /webhooks/stripe endpoint

## What Was Done

### T1: processStripePayment utility (c67e58d4)
Created `createProcessPayment(billing, db, logger)` factory that returns a callback matching the `(payload) => Promise<{ success: boolean }>` signature expected by webhookRetryProcessor. Handles both `payment_intent.succeeded` (settle only) and `requires_capture` (capture via Stripe first, then settle). Validates metadata fields before settlement.

### T2+T3+T4: Wire both job registries + app.ts (067f5899)
- Updated `registerDuesJobs` in both `association:member/jobs/index.ts` (active) and `dues/jobs/index.ts` (dead code) to accept `BillingService` as second parameter
- Replaced `DeferredScopeError('Payment processor')` stubs with `createProcessPayment(billing, context.db, context.logger)`
- Updated `app.ts` call site from `registerDuesJobs(jobs)` to `registerDuesJobs(jobs, app.billing)`

### T5: Stripe webhook endpoint (93e49ce8)
Created `/webhooks/stripe` POST endpoint as hand-wired route before auth middleware. Reads raw body, verifies `stripe-signature` header via `billing.verifyWebhookSignature()`, maps Stripe event to internal `WebhookEvent`, dispatches to `handleIncomingWebhook()` with real `processPayment` callback. Returns 400 on invalid/missing signature, 200 otherwise.

### T6: Unit tests (c135f268)
- `processStripePayment.test.ts`: 6 tests covering succeeded, requires_capture, missing metadata, missing ID, missing fields, error propagation
- `stripeWebhook.test.ts`: 3 tests covering missing signature (400), invalid signature (400), valid event processing (200)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS4111 bracket notation for index signatures**
- Found during: T1
- Issue: TypeScript `noPropertyAccessFromIndexSignature` flag requires bracket notation for `Record<string, unknown>` property access
- Fix: Changed `payload.id` to `payload['id']` etc. throughout processStripePayment.ts
- Files modified: processStripePayment.ts

**2. [Rule 3 - Blocking] app.billing scope reference**
- Found during: T4
- Issue: `billing` local variable is in `createApp()` scope, but `registerDuesJobs` is called in `initializeApp()` scope
- Fix: Changed `billing` to `app.billing` which is available via Object.assign
- Files modified: app.ts

**3. [Rule 3 - Blocking] T2+T3+T4 atomic commit**
- Found during: T2
- Issue: Changing `registerDuesJobs` signature in T2 without updating T4 call site breaks typecheck
- Fix: Committed T2, T3, T4 as single atomic commit
- Files modified: association:member/jobs/index.ts, dues/jobs/index.ts, app.ts

## Self-Check: PASSED
