# Plan 006: Settle Stripe payments using the ledger row's org/person, not webhook metadata

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 23a91932..HEAD -- services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts`
> If either file changed since this plan was written, compare the "Current state"
> excerpts against the live code before editing; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (money-path correctness hardening)
- **Planned at**: commit `23a91932`, 2026-06-19

## Why this matters

When a Stripe payment webhook is processed, `processStripePayment` loads the
authoritative `DuesPayment` ledger row by a validated `paymentId` (a real UUID
written at checkout), but then **settles the payment using `orgId`/`personId`
taken from the webhook event's Stripe `metadata`** rather than from the row it
just loaded. The ledger row is the source of truth: it has notNull
`organizationId` and `personId` columns and is fetched by primary key. Trusting
metadata for the org/person scope when the authoritative values are already in
hand is a latent divergence bug — if metadata and the row ever disagree (a
checkout bug, a re-used/edited PaymentIntent, or future code that sets metadata
loosely), the settlement (fund allocation + membership extension) would be
applied under the wrong organization or extend the wrong member's membership.

This is **defense-in-depth hardening, not a known live exploit** — today the
metadata is set server-side at checkout (`checkoutPaymentToken`) and is not
end-user-editable. The fix removes an entire class of "metadata vs ledger
mismatch" concern for one cheap, low-risk change on the money path. `paymentId`
stays the load-bearing settle key; only the org/person scoping switches to the
loaded row.

## Current state

`services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts`
— builds the `processPayment` callback that the webhook retry processor calls.
The relevant excerpt (lines 32–97):

```ts
  return async (payload: Record<string, unknown>): Promise<{ success: boolean }> => {
    const paymentIntentId = (payload['id'] as string) ?? (payload['payment_intent'] as string);
    if (!paymentIntentId) {
      throw new Error('Missing payment intent ID in webhook payload');
    }

    const metadata = payload['metadata'] as Record<string, string> | undefined;
    if (!metadata) {
      throw new Error('Missing metadata in webhook payload');
    }

    const orgId = metadata['orgId'] ?? metadata['organizationId'];
    const personId = metadata['personId'];
    // [FIX-001] paymentId MUST be the real DuesPayment row id (a UUID) ...
    const paymentId = metadata['paymentId'];

    if (!orgId || !personId) {
      throw new Error(
        `Missing required metadata fields: orgId=${orgId}, personId=${personId}`,
      );
    }
    if (!paymentId) {
      throw new Error(
        'Missing metadata.paymentId — cannot settle online payment without the ledger row id',
      );
    }

    const amount = typeof payload['amount'] === 'number' ? payload['amount'] : 0;
    const status = payload['status'] as string | undefined;

    logger.info(
      { paymentIntentId, orgId, personId, status },
      'Processing Stripe payment webhook',
    );

    // If the payment requires capture (Hold & Decide model), capture first
    if (status === 'requires_capture') {
      const connectedAccountId = metadata['connectedAccountId'];
      if (!connectedAccountId) {
        throw new Error('Missing connectedAccountId in metadata for capture');
      }

      await billing.capturePaymentIntent(paymentIntentId, connectedAccountId);
      logger.info({ paymentIntentId }, 'Payment intent captured');
    }

    // [FIX-001] Load the pending ledger row ...
    const duesRepo = new DuesRepository(db);
    const payment = await duesRepo.getPayment(paymentId);
    if (!payment) {
      throw new Error(`No DuesPayment row found for metadata.paymentId=${paymentId}`);
    }

    // Settle the payment in our database (fund allocation + membership extension)
    await settle({
      db,
      orgId,
      personId,
      paymentId,
      amount: amount || payment.amount,
    });
```

The authoritative row: `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts:75-78`
declares the `duesPayments` table with `organizationId: uuid('organization_id').notNull()`
and `personId: uuid('person_id').notNull()`. `getPayment(id)` returns the full
`DuesPayment` row (`dues-payments.repo.ts:177`), so `payment.organizationId` and
`payment.personId` are guaranteed non-null strings on a found row.

`settle(...)` is `settlePayment` from
`services/api-ts/src/handlers/association:member/utils/settle-payment.ts`; its
input type `SettlePaymentInput` takes `{ db, orgId, personId, paymentId, amount, tx? }`.
It uses `orgId`/`personId` both for the lifecycle settlement and for the
`dues.payment.recorded` domain event payload.

Repo convention: handlers/jobs read the authoritative row and trust DB columns
over request/payload-supplied identifiers — e.g. the existing `[FIX-001]` notes
in this same file already moved `paymentId` to be the load-bearing key for
exactly this reason. This plan extends that same principle to `orgId`/`personId`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 23a91932..HEAD -- services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts` | empty or matching excerpt |
| Confirm row columns | `grep -n "organizationId\|personId" services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts` | shows notNull org + person cols on `dues_payment` |
| Typecheck API | `cd services/api-ts && bun run typecheck` | exit 0 |
| Run dues + payment tests | `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` | all pass |
| Lint | `cd services/api-ts && bun run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts`
  — the settle call's org/person source only.
- A test under `services/api-ts/src/handlers/member/duesspecialassessments/`
  (new or extend an existing `processStripePayment` test).

**Out of scope** (do NOT touch, even though they look related):
- The metadata **presence** validation (`if (!orgId || !personId) throw ...`) —
  keep it. Stripe events that arrive with no org/person metadata are still
  malformed and should still be rejected; this plan only changes which value is
  *used for settlement*, not whether the metadata gates the request.
- `metadata.paymentId` and `metadata.connectedAccountId` handling — `paymentId`
  stays the settle key; `connectedAccountId` is only used for capture and has no
  ledger-row equivalent. Leave both as-is.
- `settle-payment.ts` / `membership-lifecycle.ts` signatures — do not change them.
- `stripeWebhook.ts`, `webhookRetryProcessor.ts` — unchanged.

## Git workflow

- Branch: `fix/006-settle-authoritative-org-person` (off the current branch).
- Commit message: `fix(dues): settle Stripe payments by ledger-row org/person (not webhook metadata)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Switch the settle call to the loaded row's org/person

After the `payment` row is loaded and the `if (!payment)` guard, change the
`settle({...})` call to source `orgId`/`personId` from `payment`. Keep the
metadata-presence checks above unchanged. Target shape:

```ts
    const payment = await duesRepo.getPayment(paymentId);
    if (!payment) {
      throw new Error(`No DuesPayment row found for metadata.paymentId=${paymentId}`);
    }

    // Settle using the authoritative ledger row's org/person — the row is
    // fetched by validated paymentId and its organizationId/personId are the
    // source of truth. The metadata org/person above only gate that the event
    // is well-formed; they are not trusted for scoping the settlement.
    await settle({
      db,
      orgId: payment.organizationId,
      personId: payment.personId,
      paymentId,
      amount: amount || payment.amount,
    });
```

Leave the `metadata`-derived `orgId`/`personId` consts in place for the
presence validation and the existing log line — only the `settle({...})`
arguments change.

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0
(`payment.organizationId` / `payment.personId` are typed non-null strings; no
cast needed. If typecheck reports they could be `undefined`/`null`, STOP — see
STOP conditions.)

### Step 2: Add a regression test

Add a test proving that when the webhook metadata's org/person **disagree** with
the loaded ledger row, settlement uses the **row's** values.

**Important — how the SUT is wired (read before writing the test):** there is no
existing test for this file (`ls services/api-ts/src/handlers/member/duesspecialassessments/`
has no `processStripePayment.test.ts`). Inside the closure the repo is constructed
locally: `const duesRepo = new DuesRepository(db); const payment = await
duesRepo.getPayment(paymentId);`. So stubbing `db` alone will NOT intercept
`getPayment`. Use `spyOn` on the repo prototype instead, and inject the `settle`
spy via the 4th parameter of `createProcessPayment` (it exists for exactly this).

To keep the db stub minimal, craft the returned row so the rest of the closure
skips its other repo calls:
- `status: 'completed'` on the row → skips the `updatePaymentStatus` branch
  (`if (payment.status !== 'completed' && payment.status !== 'confirmed')`).
- `invoiceId: null` on the row → skips the `markPaid` branch (`if (payment.invoiceId)`).
- `payload.status: 'succeeded'` → skips the `requires_capture` capture branch.

That leaves only `getPayment` (spied) and `settle` (injected spy) on the path.

Concrete shape (adjust imports/names to match the repo's test conventions —
`import { test, expect, spyOn, afterEach, mock } from 'bun:test'`):
```ts
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { createProcessPayment } from './processStripePayment';

// Arrange
const row = {
  id: 'PAYMENT-ROW-ID',
  organizationId: 'ORG-REAL',
  personId: 'PERSON-REAL',
  amount: 5000,
  status: 'completed',
  invoiceId: null,
  // ...any other non-null DuesPayment fields the type requires; cast the
  // literal with `as any` ONLY in the test (production code stays cast-free).
};
const getPaymentSpy = spyOn(DuesRepository.prototype, 'getPayment')
  .mockResolvedValue(row as any);
const settleSpy = mock(async () => ({
  fundAllocations: [], membershipExtendedFrom: null, membershipExtendedTo: null,
}));

const billing = {} as any;       // not used on this path (status !== requires_capture)
const db = {} as any;            // getPayment is spied, so db is never dereferenced here
const logger = { info: () => {}, warn: () => {} } as any;
const processPayment = createProcessPayment(billing, db, logger, settleSpy as any);

const payload = {
  id: 'pi_test',
  status: 'succeeded',
  amount: 5000,
  metadata: { orgId: 'ORG-EVIL', personId: 'PERSON-EVIL', paymentId: 'PAYMENT-ROW-ID' },
};

// Act
await processPayment(payload as any);

// Assert: settle scoped by the ROW, not the metadata
expect(settleSpy).toHaveBeenCalledTimes(1);
expect(settleSpy.mock.calls[0][0]).toMatchObject({ orgId: 'ORG-REAL', personId: 'PERSON-REAL' });

// restore
getPaymentSpy.mockRestore();
```
Put a `mockRestore()` (or `afterEach(() => mock.restore())`) so the prototype spy
doesn't leak into other tests. If the `DuesPayment` type demands more non-null
fields than shown, add them to `row` (the `as any` in the TEST keeps it terse —
this does not violate the production no-cast rule).

**Verify**: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` → all pass, including the new test.

## Test plan

- New test (or new case in an existing file) under
  `services/api-ts/src/handlers/member/duesspecialassessments/`:
  - **divergence case** (the regression this plan fixes): metadata org/person ≠
    ledger row org/person → `settle` receives the **row's** org/person.
  - **happy path** (if not already covered): metadata == row → `settle` receives
    those values and returns success.
- Use the injectable `settle` parameter of `createProcessPayment` so no real DB
  settlement runs.
- Verification: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` exits 0; the divergence test passes
- [ ] `grep -nE "orgId:\s*payment\.organizationId" services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts` returns a match (settle now uses the row)
- [ ] `grep -nE "personId:\s*payment\.personId" services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts` returns a match
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] Only `processStripePayment.ts` and the test file changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows the file changed and the "Current state" excerpt no
  longer matches the live code.
- `getPayment`'s return type does not expose `organizationId`/`personId` as
  non-null strings (e.g. the row type is `Partial` or those columns were made
  nullable) — report the contract gap; do not add an `as string` cast to force it.
- An existing test asserts that `settle` is called with the **metadata** org/person
  on purpose (report it before changing the assertion — it may encode a
  deliberate behavior you don't yet understand).
- `spyOn(DuesRepository.prototype, 'getPayment')` does not intercept the call
  (e.g. the repo was refactored so `getPayment` is no longer a prototype method,
  or `createProcessPayment` no longer constructs `new DuesRepository(db)`) — report;
  do not fall back to brittle full-`db`-chain stubbing without flagging it.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- For a future reviewer: the key invariant is that anything scoping a money
  mutation (org, person) should come from a DB row fetched by a validated id, not
  from webhook/request payload — `paymentId` is the only payload-sourced value
  that's allowed to be load-bearing here, and only because it's validated against
  the row's existence.
- Deliberately **not** done in this plan (and why): adding a hard assertion that
  `metadata.orgId === payment.organizationId` and rejecting on mismatch. That
  would surface latent checkout bugs but risks dead-lettering legitimate
  payments during the rollout window; revisit as a follow-up once logs confirm
  metadata and row never diverge in practice.
- `initiateOnlinePayment.ts` and `checkoutPaymentToken.ts` are the writers of
  this metadata; if their metadata shape changes, this handler's presence checks
  (not the settle scoping) are what interacts with it.
