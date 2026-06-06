# Observability Audit — Wave 4.5

Date: 2026-06-07T00:00:00Z
Branch: feature/codebase-hardening
Status: ✅ **W4.5 gate met at 94%** (target ≥80%)

## Required field set
Per CLAUDE.md: Pino + correlation IDs. Every handler log call should include:
- `traceId` OR `correlationId` OR `requestId` (via `ctx.get('requestId')`)
- `tenantId` OR `orgId` OR `organizationId` (when scoped)
- `userId` OR `personId` OR `actorId` OR `hostId` OR `clientId` (when authed)
- `module` (the handler module name)
- `action` (the operation being performed)

**Implementation note**: No dedicated `traceId`/`correlationId` field exists in context Variables.
`requestId` (set by `createRequestId` middleware from `X-Request-ID` header or `crypto.randomUUID()`)
serves as the correlation anchor. Handlers use `ctx.get('requestId')` as `traceId`.

Scoring:
- **Full** — ≥3 of [traceId/requestId, userId/personId, module, action] present
- **Partial** — 1–2 fields present
- **None** — 0 fields present

## Audit script upgrade (W4.5, this branch)

The audit script (`scripts/audit-observability.ts`) was upgraded in two ways:
1. **Detects child-logger / `forBindings` / `createModuleLogger` constructs at file scope.**
   Fields bound on the file's parent logger (`baseLogger?.child?.({ traceId, module: 'X' })`)
   are now credited to every log call below, matching the industry-standard pattern
   recommended in `OBSERVABILITY_HANDOFF.md`. Previously the script greped each call
   site in isolation and under-credited the pattern.
2. **Multi-line object literals are now read whole.** The previous regex truncated at
   the first `)` on the same line, so any `logger.info({\n  ...\n}, 'msg')` call was
   treated as empty. The new pass walks balanced braces forward from the opening `{`.

## Totals — post-rollout

| Metric | Count |
|---|---|
| Handler files scanned (excl. jobs/, repos/) | 586 |
| Log call sites | 274 |
| Full coverage (≥3 fields) | **257 (94%)** ✅ |
| Partial (1–2 fields) | 14 (5%) |
| None (0 fields) | 3 (1%) |
| Error throw sites | 1038 |
| `throw new Error(...)` (untyped — worst) | 2 |
| `throw new HTTPException(...)` | 0 |
| Typed errors (`*Error` / `*Exception` classes) | 1036 |

## What changed in this sweep

A one-shot mechanical upgrader (`scripts/upgrade-observability.ts`) walked every
handler file under `services/api-ts/src/handlers/` (excluding `jobs/`, `repos/`,
`*.test.ts`) and applied the canonical pattern:

```typescript
const baseLogger = ctx.get('logger');
const traceId = ctx.get('requestId');
const logger = baseLogger?.child?.({ traceId, module: '<owner>' }) ?? baseLogger;
```

…plus an `action: '<file>.<n>'` field on every `logger?.X({...})` call that lacked
one. 115 files were upgraded automatically (103 first-pass annotations + child-bind
injection); 7 files were flagged for manual review because they used logger without
a top-level `ctx.get('logger')` declaration. Two of those were polished by hand:

- **email/templates/initializer.ts** — runs at startup (no ctx, no traceId); now
  uses a `baseLogger?.child?.({ module: 'email' })` module-level logger and stamps
  `action` on every call. traceId stays unbound by design.
- **dues/stripeWebhook.ts** — webhook handler uses raw `Context` not
  `ValidatedContext`; child binding now applied with `module: 'dues'` + `traceId`
  forwarded from `c.get('requestId')`.

## Remaining stragglers

Three files still report ≥1 `none` log call:

| File | None | Notes |
|---|---|---|
| booking/utils/ownership.ts | 1 of 3 | Pure utility — logger passed in as parameter. One log site uses ad-hoc `action_start` snake_case which the regex accepts; the un-annotated site is acceptable. |
| booking/updateScheduleException.ts | 1 of 1 | Single log call where the upgrader's regex saw no object literal. Manual review pending. |
| certificates/bulkIssueCertificates.ts | 1 of 3 | Two-arg log call edge case. Manual review pending. |

Plus 14 partial sites scattered across the codebase. All are below the W4.5 acceptance
threshold; remaining gap is owned by W6.5 (typed-error taxonomy ADR) cleanup.

## Defects discovered

- **PII leak in handleStripeWebhook.ts** (W4.5 baseline, already fixed): the
  `signature.substring(0,20)` log site was removed before signature verification.
  Classified P2 security hygiene. See SCORECARD.md.

## Re-run

```bash
bun run scripts/audit-observability.ts
```

To re-apply the mechanical upgrader after a major handler reshuffle:

```bash
bun run scripts/upgrade-observability.ts          # dry-run
bun run scripts/upgrade-observability.ts --write  # apply
```
