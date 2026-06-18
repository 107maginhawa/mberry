# C8 — Cross-Module / Contracts Audit (2026-06-16)

Scope: seams only. Reviewed `app.ts`, `core/domain-event-consumers.ts`,
`core/domain-events.ts`, `core/config.ts`, `core/audit/audit-action.ts`,
`core/auth/officer-checks.ts`, `middleware/audit.ts`,
`middleware/per-route-audit.ts`, `core/errors.ts`, plus cross-import grep.

Legend: `file:line` — **[Priority][Cross-Module]** problem → why → fix.

---

## 1. Interface Contracts (spec ↔ handler ↔ SDK ↔ hand-wired routes)

### `services/api-ts/src/core/domain-event-consumers.ts:41` — **[P2][Cross-Module]** certificates schema imported from `@/handlers/member/certificates/...`, not `association:member/`.
CLAUDE.md documents certificates as "re-exported from `association:member/`". Reality: there are **two parallel member trees** — `handlers/member/` (certificates, chapters, credentials, credits, directory, governance, membership, duesspecialassessments) AND `handlers/association:member/`. The cascade pulls `certificates` from `member/certificates` but `creditEntries`, `directoryProfiles`, `chapterAffiliations`, `digitalCredentials` from `association:member/`. Two directories own overlapping domains; doc says one.
Why it matters: ambiguous ownership = duplicate schemas, drift, and a future split (P1-11) that touches the wrong tree. A handler editing `association:member/chapters` may not be the one the cascade deletes from.
Fix: reconcile the two trees. Either fold `handlers/member/*` into `association:member/` (re-export shim for back-compat) or update CLAUDE.md + ROADMAP to document both as distinct bounded contexts and which owns each table. Verify cascade imports point at the canonical table, not a stale copy.

### `services/api-ts/src/middleware/feature-flag-gate.ts` (mounted `app.ts`, marketplace only) — **[P2][Cross-Module]** feature-flag gate is opt-in on ONE prefix; modules with no flag row **fail open**.
Why: staged rollout by design, but the "fail open on missing row" default means any module that *thinks* it's gated but never added `featureFlagGate('<module>')` silently serves traffic. Contract drift between "flag exists in DB" and "flag enforced on route."
Fix: keep fail-open (intentional) but add a registry test asserting which module prefixes have the gate mounted, so removing it is caught. Document the opt-in list in one place.

### Hand-wired public paths in `app.ts` — **[P2][Cross-Module]** auth-ordering correct, but no contract test covers them.
`/invite/validate/:token` (public, no auth), `/invite/claim/*` (auth), `unsubscribeEmail` (public before `/email/*` auth, RFC 8058), paymongo webhook (public, HMAC-verified in handler). Ordering is correct in source, but these bypass the generated per-route auth registry — a future refactor of middleware order silently exposes/locks them with no failing test.
Fix: add Hurl contract cases asserting 200-without-auth for the public trio and 401-without-auth for `/invite/claim` (see §Testing).

---

## 2. Domain Event Bus (`person.deleted` cascade)

### `services/api-ts/src/core/domain-events.ts:emit()` — **[OK]** error isolation is real.
`emit()` uses `Promise.allSettled(handlers.map(...))`; each subscriber also wraps its body in try/catch + structured log. One failing subscriber cannot block others. Verified by test `person.deleted — subscriber failure in one module does not block others`. Good.

### `services/api-ts/src/core/domain-event-consumers.ts` — **[P1][Cross-Module]** orphaned rows: modules with `personId`/`reviewerId` FKs NOT subscribed to `person.deleted`.
Confirmed schemas referencing a deleted person but absent from the 10 `person.deleted` subscribers:
- `handlers/reviews/repos/review.schema.ts` (NPS reviews keyed to person)
- `handlers/advertising/repos/advertising.schema.ts` (personId FK)
- `handlers/comms/repos/comms.schema.ts` (chat room members / DMs — `createDefaultChannels`/`autoJoinOrgChannels` add the person to channels, nothing removes them)
- `handlers/person/repos/data-export.schema.ts` (GDPR export requests retain `personId` — arguably correct to keep, but undocumented)
- `association:operations/repos/committee.schema.ts` (committee membership personId)
Why: after account deletion (DPA 2012), these tables still map a real person to rows. comms is the worst — a deleted user remains a visible chat/DM member. Either a compliance leak (PII retained) or an FK integrity risk if person is later hard-deleted (FKs may be `restrict`).
Fix: add subscribers for reviews (anonymize `reviewerId → null`, retain score per BR-32), advertising, comms (remove channel/DM membership), committee. Example:
```ts
domainEvents.on('person.deleted', async ({ personId }) => {
  try {
    await deps.db.delete(chatRoomMembers).where(eq(chatRoomMembers.personId, personId));
    await deps.db.update(reviews).set({ reviewerId: null, updatedBy: SYSTEM_USER_ID })
      .where(eq(reviews.reviewerId, personId));
  } catch (err) {
    logger.error({ error: err, personId }, '[consumer] person.deleted comms/reviews cascade failed');
  }
});
```

### `services/api-ts/src/core/domain-event-consumers.ts` (surveys subscriber) — **[P2][Cross-Module]** ordering comment contradicts concurrent bus.
Surveys subscriber comment: "responder_id FK is onDelete:'restrict', so this MUST run before any hard person delete." But `emit()` runs all `person.deleted` handlers **concurrently** (allSettled) — there is no ordering between subscribers, and no subscriber actually hard-deletes the person row (the emitter `accountDeletionCascade.ts` is emit-only). So today the assumption holds by accident (nobody hard-deletes person here). If a future `person` subscriber adds a hard delete, the restrict FK will throw and the survey anonymization may not have run first.
Fix: either (a) document that no `person.deleted` subscriber may hard-delete the person row, or (b) move any future person-row hard-delete to a *separate, later* event (`person.purged`) emitted only after `person.deleted` settles.

### `executeCascadeDeletion` / `emit('person.deleted')` — **[P2][Cross-Module]** idempotency: safe, but unverified on re-emit.
All subscribers use `delete ... where eq(personId)` or `update ... set(...)` — naturally idempotent (re-running deletes zero rows, re-sets same values). No `ON CONFLICT` needed. But there's **no test** that emitting `person.deleted` twice is a no-op the second time. Low risk, document + add a regression test.

### `accountDeletionCascade.ts` — **[P1][Cross-Module]** emit is fire-and-forget; caller gets `{emitted:true}` before cleanup runs.
`emit()` awaits allSettled, so by the time `executeCascadeDeletion` returns the subscribers *have* run — BUT all subscriber errors are swallowed (caught+logged inside each, plus allSettled). The HTTP caller receives success even if every cleanup step failed. There is no aggregate "N of M subscribers failed" signal surfaced to the deletion handler or to an audit row.
Why: a DPA 2012 deletion can silently leave PII behind and the user/officer is told "deleted." No retry, no dead-letter.
Fix: have `emit` (or a wrapper) collect rejected results and, on any failure, write a single `audit` row + enqueue a retry job. Minimal: surface count.
```ts
const results = await Promise.allSettled(...);
const failed = results.filter(r => r.status === 'rejected').length;
if (failed) await audit.logEvent({ action:'delete', resourceType:'person', outcome:'failure',
  description:`${failed} cascade subscribers failed`, resource: personId });
```

---

## 3. Shared Deps (circular / duplicate)

### `handlers/dues/repos/dues-payments.repo.ts` — **[OK / P3][Cross-Module]** circular dep already broken.
`dues` schema imports `person`, `platformadmin`, `association:member` schemas (one-directional: dues → member). The known Financial↔Membership cycle (BCI-01) was resolved by **moving** `dues-payments.repo` into `dues/` and re-exporting from `association:member` for back-compat (`export * from '@/handlers/dues/repos/dues-payments.repo'`). Good. Residual risk: the re-export means two import paths for one repo — keep until the split, then collapse.

### `core/domain-event-consumers.ts:18-49` — **[P3][Cross-Module]** consumers file imports schemas + repos from ~12 handler modules.
This is the central cross-module hub by design (the event bus seam), but it creates a single file that, if any imported module's schema export name changes, breaks the whole cascade at boot. Acceptable for an in-process bus; flag for the P1-11 split (each module should register its own subscriber via a `registerXConsumers(bus)` hook instead of one mega-file).

---

## 4. State Consistency

### `core/domain-event-consumers.ts` (membership/dues subscribers) — **[P2][Cross-Module]** read-modify-write on membership expiry has no row lock.
`dues.payment.recorded` → `membershipRepo.findByPersonAndOrg` then `updateOneBy` to set `newExpiryDate`. Two concurrent payments (or a payment racing a manual officer edit) read-modify-write the same membership row with no `SELECT ... FOR UPDATE` / optimistic version. Last-writer-wins on expiry date.
Why: double-payment or concurrent renewal could set a stale expiry. Low frequency, real money.
Fix: wrap in a transaction with row lock, or make the update conditional (`WHERE expiry < newExpiry`).

### Event-published / election bulk-notify subscribers — **[P3][Cross-Module]** read members list then bulk-insert notifications, no dedup.
If `event.published` fires twice (retry), members get duplicate notifications (no idempotency key on `notifications`). Cosmetic; note for a future notification-dedup key.

---

## 5. Error Propagation

### `services/api-ts/src/middleware/per-route-audit.ts:13,59,84` — **[P1][Cross-Module]** generated x-audit middleware writes ONLY `outcome:'success'` and skips on 4xx/5xx.
Single-event mode (line 84) logs only when `handlerError === undefined && status < 400`, always `outcome:'success'` (line 105). Multi-event mode same (line 68). So **denied/forbidden mutation attempts on x-audit routes produce NO audit row.** Meanwhile the *global* `middleware/audit.ts:` after-middleware DOES log `outcome:'failure'` for status>=400. Result: two audit paths with **opposite** behavior on failure — a route with `@extension("x-audit")` loses its failure trail, a route relying on global audit keeps it.
Why (compliance): for a healthcare AMS, "who *attempted* to delete/modify and was denied" is exactly what an audit trail must capture (failed-authz, tampering attempts). The generated path drops it.
Fix: in per-route-audit, on `status >= 400` (or `handlerError`) emit a row with `outcome:'failure'` instead of skipping. Keep skipping pure validation 422s if desired, but 401/403/409 on a mutation should be audited.
```ts
const outcome = (handlerError !== undefined || ctx.res.status >= 400) ? 'failure' : 'success';
// emit even on failure; only skip 422 validation-shape errors
```

### `core/errors.ts:117,155` — **[P3][Cross-Module]** prod error filter strips `path`/`method`/`value` — verify it doesn't mask 500 root cause from logs.
`applySecurity` + `createBaseErrorFields` null out `path`/`method`/`fieldErrors.value` in production responses. Correct for the *client* response, but confirm the full error (incl. path/stack) is still logged server-side via Pino before filtering. If the only record is the filtered response, prod 500s become un-debuggable.
Fix: ensure `app.onError` logs the unfiltered error before `createBaseErrorFields`.

### `core/auth/officer-checks.ts` — **[OK]** fail-closed.
`requireOfficerTerm` returns 401 (no user), 403 (no org / no active term), enforces 2FA on privileged titles. `requirePosition` same. No fail-open path. Tests bind to real `src` primitives (gate-check test). Good.

---

## 6. Config / Secrets

### `core/config.ts` validated accessors — **[OK / P2][Cross-Module]** accessors correct; a few non-config `process.env` reads remain (mostly benign).
`getInviteTokenSecret` / `getUnsubscribeSecret` / `getPaymongoConfig` fail-loud in prod, dev-default outside. Good. Stray `process.env` reads outside `config.ts`:
- `middleware/{validation,rate-limit,require-officer,require-position}.ts`, `core/{errors,feature-flags,auth/officer-checks}.ts` — all read `NODE_ENV` only (benign, not secrets).
- `seed/helpers.ts`, `seed/reset-mutated.ts` — read `DATABASE_URL`/`API_URL` with inline localhost fallbacks (seed-only, acceptable).
- `test-utils/preload-pristine.ts` — sets `AUTH_SECRET` for tests (acceptable).
No **secret** is read outside the validated accessors. **[P3]** fix: centralize `NODE_ENV` behind a `config.isProduction` helper so the ~8 scattered `process.env.NODE_ENV === 'production'` checks can't drift (one already uses `.NODE_ENV` vs `['NODE_ENV']` inconsistently).

---

## Testing — Highest-Value Integration Gaps

Existing: `domain-event-consumers.test.ts` covers each `person.deleted` subscriber individually + one "failure-isolation" test (mock DB, capturing calls). `accountDeletionCascade.test.ts` covers the emit shim. These are **unit** tests against a fake db.

1. **Full `person.deleted` cascade integration test against a real (or transactional) DB** — seed a person with rows in ALL FK-bearing tables (membership, events, training, credits, certificates, documents, invites, billing, surveys, elections, comms, reviews, advertising), emit `person.deleted`, assert zero PII-mapping rows remain (or are anonymized) across every table. Current unit tests mock the db and assert per-table calls — they would **pass even with the orphaned reviews/advertising/comms modules** because those tables aren't in the mock. This test would catch §2's orphan gap.

2. **x-audit failure-trail contract test** — fire a denied mutation (403/409) at an `@extension("x-audit")` route and assert an audit row with `outcome:'failure'` exists. Currently NO test asserts failure auditing on the generated path; §5 P1 bug ships silently.

3. **Hand-wired public-route auth contract tests (Hurl)** — assert `/invite/validate/:token` and `unsubscribeEmail` return 200 without auth, `/invite/claim/*` returns 401 without auth, paymongo webhook rejects bad HMAC. These routes bypass the generated auth registry; a middleware-order refactor in `app.ts` has no failing test today.

---

## Top 3 Critical (C8)

1. **[P1] x-audit drops the failure trail** (`per-route-audit.ts:59,84,105`). Generated audit middleware logs only `outcome:'success'` and skips all 4xx/5xx, so denied/forbidden mutations on TypeSpec routes leave no audit row — while the global path logs failures. Compliance gap for a healthcare AMS (failed-authz/tampering attempts must be auditable). Fix: emit `outcome:'failure'` on error instead of skipping.

2. **[P1] Orphaned PII after account deletion** (`domain-event-consumers.ts`). `reviews`, `advertising`, `comms` (chat/DM membership), and committee tables hold `personId` rows but have NO `person.deleted` subscriber — a deleted user stays mapped/visible. DPA 2012 leak. Fix: add subscribers (anonymize or delete). The unit tests can't catch it because the mock db omits these tables → see test gap #1.

3. **[P1] Cascade failures are silent to the caller** (`accountDeletionCascade.ts` + `domain-events.ts emit`). `allSettled` + per-subscriber try/catch swallow every error; the deletion handler returns `{emitted:true}` even if all cleanup failed. No aggregate failure signal, no retry, no audit row. A "deleted" account can silently retain PII. Fix: count rejected results, write a failure audit row + enqueue retry.
