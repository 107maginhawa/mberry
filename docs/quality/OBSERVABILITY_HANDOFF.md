# Observability Handoff — Wave 4.5

Branch: feature/codebase-hardening
Date: 2026-06-06

## Context
Wave 4.5 fixed the top 3 worst-offending handlers as proof-of-concept.
This document lists the remaining 17 worst offenders and the broader
migration plan for full observability coverage.

## Pattern established (use this for all remaining fixes)

```typescript
// At handler top — creates child logger bound with traceId + module
const baseLogger = ctx.get('logger');
const traceId = ctx.get('requestId');       // requestId = correlation anchor
const logger = baseLogger?.child?.({ traceId, module: '<module-name>' }) ?? baseLogger;

// Every log call adds action (child logger inherits traceId + module)
logger?.info({ action: '<handler>.<step>', userId: user.id }, 'message');
logger?.error({ action: '<handler>.<step>', error, invoiceId }, 'message');
```

Test pattern (characterization test for log fields):
```typescript
function makeCapturingLogger(calls: any[]) {
  function makeChild(inherited: Record<string, any>) {
    return {
      debug: (obj: any, msg?: string) => calls.push({ level: 'debug', ...inherited, ...obj, msg }),
      info:  (obj: any, msg?: string) => calls.push({ level: 'info',  ...inherited, ...obj, msg }),
      warn:  (obj: any, msg?: string) => calls.push({ level: 'warn',  ...inherited, ...obj, msg }),
      error: (obj: any, msg?: string) => calls.push({ level: 'error', ...inherited, ...obj, msg }),
      child: (bindings: Record<string, any>) => makeChild({ ...inherited, ...bindings }),
    };
  }
  return makeChild({});
}

test('all log calls carry traceId and module', async () => {
  const calls: any[] = [];
  const ctx = makeCtx({ logger: makeCapturingLogger(calls), requestId: 'trace-001', ... });
  await myHandler(ctx);
  for (const call of calls) {
    expect(call.traceId).toBe('trace-001');
    expect(call.module).toBe('<module>');
  }
});
```

## Remaining 17 worst offenders (by score)

| Rank | Score | None logs | Total logs | Handler file |
|---|---|---|---|---|
| 1 | 10 | 5 | 5 | email/templates/initializer.ts |
| 2 | 8 | 4 | 4 | dues/stripeWebhook.ts |
| 3 | 8 | 4 | 4 | booking/updateBookingEvent.ts |
| 4 | 8 | 4 | 4 | storage/uploadFile.ts |
| 5 | 8 | 4 | 5 | storage/getFile.ts |
| 6 | 8 | 4 | 5 | billing/payInvoice.ts |
| 7 | 6 | 3 | 3 | booking/confirmBooking.ts |
| 8 | 6 | 3 | 3 | booking/cancelBooking.ts |
| 9 | 6 | 3 | 3 | booking/utils/ownership.ts |
| 10 | 6 | 3 | 3 | booking/rejectBooking.ts |
| 11 | 6 | 3 | 3 | comms/sendChatMessage.ts |
| 12 | 6 | 3 | 3 | comms/leaveVideoCall.ts |
| 13 | 6 | 3 | 3 | association:operations/cancelEventRegistration.ts |
| 14 | 6 | 3 | 3 | billing/voidInvoice.ts |
| 15 | 6 | 3 | 3 | billing/refundInvoicePayment.ts |
| 16 | 4 | 2 | 2 | booking/createBookingEvent.ts |
| 17 | 4 | 2 | 2 | booking/listEventSlots.ts |

### Notes on specific files

- **email/templates/initializer.ts** — initializer runs at startup, not per-request; no `ctx` available.
  Recommendation: pass a module-level logger created at startup with `{ module: 'email' }` binding.
  No `traceId` is appropriate here (not a request-scoped operation).

- **dues/stripeWebhook.ts** — same webhook-handler pattern as billing/handleStripeWebhook;
  apply identical child-logger fix.

- **booking/** handlers — `ctx.get('logger')` already used; just add `child({traceId, module: 'booking'})`
  + `action` field on each call site.

- **storage/** handlers — `ctx.get('requestId')` not yet forwarded; add child-logger pattern.

- **comms/** handlers — WebSocket context may have different `ctx` type; verify Variables compatibility
  before adding `ctx.get('requestId')`.

- **association:operations/cancelEventRegistration.ts** — check if orgId/tenantId is available
  to add as `tenantId` field.

## Broader migration effort estimate

| Scope | Files | Effort |
|---|---|---|
| Remaining top-17 worst offenders | 17 | ~2h (pattern is templated) |
| Mid-tier handlers (score 2–3) | ~60 files | ~6h |
| Low-tier (score 0–1, partial coverage) | ~30 files | ~3h |
| Add `tenantId` where `organizationId` available | ~40 files | ~2h |
| **Total** | **~147 files** | **~13h** |

## Raw throw new Error migration

The audit script (which excludes `jobs/` and `repos/` subdirs) found 2 raw `throw new Error`
sites in scanned handler code. The actual production locations are:

| File | Context | Notes |
|---|---|---|
| association:member/utils/membership-status-middleware.ts:112 | Internal invariant guard | Low-risk — internal assertion, never user-facing |
| dues/jobs/processStripePayment.ts | jobs/ subdir (excluded from audit scope) | 4 sites; job context, error triggers retry logic |
| surveys/repos/survey.repo.ts | repos/ subdir (excluded from audit scope) | 1 site; repo-layer guard |

All production handler files (non-jobs, non-repos) already use typed errors from `core/errors.ts`.
Full typed-error taxonomy ADR is planned for Wave 6.5 — that ADR will cover the jobs + repos cleanup.

## Re-audit after completing remaining fixes

```bash
bun run scripts/audit-observability.ts
```

Target: full coverage ≥ 80% (from 0% baseline at Wave 4.5 start).
