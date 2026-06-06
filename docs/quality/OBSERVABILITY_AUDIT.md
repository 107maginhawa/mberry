# Observability Audit — Wave 4.5 Baseline

Date: 2026-06-06T00:00:00Z
Branch: feature/codebase-hardening

## Required field set
Per CLAUDE.md: Pino + correlation IDs. Every handler log call should include:
- `traceId` OR `correlationId` OR `requestId` (available via `ctx.get('requestId')`)
- `tenantId` OR `orgId` OR `organizationId` (when scoped)
- `userId` OR `personId` OR `actorId` OR `hostId` OR `clientId` (when authed)
- `module` (the handler module name)
- `action` (the operation being performed)

**Implementation note**: No dedicated `traceId`/`correlationId` field exists in context Variables.
`requestId` (set by `createRequestId` middleware from `X-Request-ID` header or `crypto.randomUUID()`)
serves as the correlation anchor. Handlers should use `ctx.get('requestId')` as `traceId`.

Scoring:
- **Full** — ≥3 of [traceId/requestId, userId/personId, module, action] present
- **Partial** — 1–2 fields present
- **None** — 0 fields present

## Totals

| Metric | Count |
|---|---|
| Handler files scanned (excl. jobs/, repos/) | 586 |
| Log call sites | 272 |
| Full coverage (≥3 fields) | 0 (0%) |
| Partial (1–2 fields) | 56 (21%) |
| None (0 fields) | 216 (79%) |
| Error throw sites | 1038 |
| `throw new Error(...)` (untyped — worst) | 2 |
| `throw new HTTPException(...)` | 0 |
| Typed errors (`*Error` / `*Exception` classes) | 1036 |

## Key findings

1. **Zero full-coverage log sites.** No handler currently logs all 4 required fields.
   The `module` and `action` fields are universally absent. `requestId` is never forwarded
   from middleware into handler log objects.

2. **Typed error adoption is strong (1036/1038 = 99.8%).** Only 2 raw `throw new Error`
   sites exist — both in `billing/` handlers. All other throws use typed classes from
   `core/errors.ts` (`NotFoundError`, `ForbiddenError`, `BusinessLogicError`, etc.).

3. **PII concern flagged in handleStripeWebhook.ts (line ~36):**
   ```typescript
   logger.info({ signature: signature.substring(0, 20) }, 'Processing Stripe webhook');
   ```
   Even a 20-char prefix of a Stripe webhook signature leaks partial secret material
   to logs. This is a defect — see SCORECARD.md. Fix: remove `signature` field entirely;
   log only the presence/absence boolean or event type after verification.

4. **handleStripeWebhook has 54 bare log calls (score=108).** The handler is a large
   webhook dispatcher (~300 LOC) with many sub-handlers each logging without context.
   All sub-handlers receive `logger` as a plain argument, so `requestId`/`module`/`action`
   must be threaded through or moved to a child logger.

## Error taxonomy goal
Typed error adoption is already at 99.8%. The 2 remaining `throw new Error` sites are
low-priority cleanup — they are inside billing webhook sub-handlers where the error
propagates into Stripe retry logic. Wave 6.5 ADR will codify the error taxonomy formally.
Migration of the 2 raw sites is included in the handoff below.

## Top 20 worst-offending handlers
See `OBSERVABILITY_AUDIT.json` → `worstOffenders` array.

| Rank | Handler | Score | None | Total Logs |
|---|---|---|---|---|
| 1 | billing/handleStripeWebhook.ts | 108 | 54 | 54 |
| 2 | billing/onboardMerchantAccount.ts | 16 | 8 | 9 |
| 3 | email/templates/initializer.ts | 10 | 5 | 5 |
| 4 | billing/captureInvoicePayment.ts | 10 | 5 | 5 |
| 5 | dues/stripeWebhook.ts | 8 | 4 | 4 |
| 6 | booking/updateBookingEvent.ts | 8 | 4 | 4 |
| 7 | storage/uploadFile.ts | 8 | 4 | 4 |
| 8 | storage/getFile.ts | 8 | 4 | 5 |
| 9 | billing/payInvoice.ts | 8 | 4 | 5 |
| 10 | booking/confirmBooking.ts | 6 | 3 | 3 |
| 11 | booking/cancelBooking.ts | 6 | 3 | 3 |
| 12 | booking/utils/ownership.ts | 6 | 3 | 3 |
| 13 | booking/rejectBooking.ts | 6 | 3 | 3 |
| 14 | comms/sendChatMessage.ts | 6 | 3 | 3 |
| 15 | comms/leaveVideoCall.ts | 6 | 3 | 3 |
| 16 | association:operations/cancelEventRegistration.ts | 6 | 3 | 3 |
| 17 | billing/voidInvoice.ts | 6 | 3 | 3 |
| 18 | billing/refundInvoicePayment.ts | 6 | 3 | 3 |
| 19 | booking/createBookingEvent.ts | 4 | 2 | 2 |
| 20 | billing/payInvoice.ts | — | — | — |

## In-wave fixes (this branch)
Top 3 handlers fixed as proof-of-concept.

| Handler | Fix |
|---|---|
| billing/handleStripeWebhook.ts | Added `traceId`, `module`, `action` fields; removed PII leak (`signature` prefix); moved to child logger pattern |
| billing/onboardMerchantAccount.ts | Added `traceId`, `module`, `action` fields to all log sites |
| billing/captureInvoicePayment.ts | Added `traceId`, `module`, `action` fields to all log sites |

## Defects discovered
- **PII leak in handleStripeWebhook.ts**: `signature.substring(0,20)` logged before
  signature verification. Even a truncated HMAC prefix should not appear in logs.
  Classified as P2 security hygiene. Logged in SCORECARD.md.

## Handoff
Remaining 17 worst offenders + broader rollout handed off.
See `docs/quality/OBSERVABILITY_HANDOFF.md`.

## Re-run
```bash
bun run scripts/audit-observability.ts
```
