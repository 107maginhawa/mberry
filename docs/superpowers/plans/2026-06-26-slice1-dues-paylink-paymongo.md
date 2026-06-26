# Slice-1 Dues Pay-link (PayMongo, instant rail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make online dues payment work end-to-end for PH orgs: officer creates a pay-link, member taps a login-free page, pays via PayMongo (GCash/Maya/card) into the org's own account, and the payment reconciles correctly — fixing a latent bug where collected money never shows in reports.

**Architecture:** Consolidate the existing half-wired PayMongo code onto one live checkout route (`/pay/:token/checkout`, re-pointed off Stripe) plus one net-new per-org webhook route (`/webhooks/paymongo/:orgId`). Per-org PayMongo secret is decrypted per request; settlement is one atomic transaction over the real `duesPayments` ledger row; idempotency is a single-winner DB claim plus a per-attempt PayMongo Idempotency-Key.

**Tech Stack:** Hono + Drizzle (Postgres), TypeSpec→OpenAPI→generated routes/validators, Bun test, `createScratch` real-PG harness, PayMongo Checkout Sessions API.

**Spec:** `docs/superpowers/specs/2026-06-26-slice1-dues-paylink-instant-design.md` (rev3, reviewer verdict ship-the-plan).

## Global Constraints

- **Additive only.** The api-ts engine is FROZEN: do NOT break existing handlers/schemas/tests. New code behind the existing seam. (CLAUDE.md)
- **Module diet deferred.** Do NOT delete the orphan handlers (`handlePaymentWebhook`, `initiateOnlinePayment`, `generatePaymentLink`, `validatePaymentLink`, dues `stripeWebhook`). They are already off every route. (CLAUDE.md)
- **Spec-first loop:** edit TypeSpec → `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → implement handler to match generated validators → `bun run --filter @monobase/sdk-ts generate`. NEVER edit generated files. (CLAUDE.md)
- **Migrations:** edit `*.schema.ts` → `cd services/api-ts && bun run db:generate` → review SQL → applies on start. Additive only (no `DELETE`). Migration PR references `docs/security/MIGRATION_SAFETY_CHECKLIST.md`. (CLAUDE.md)
- **Currency:** PHP, minor units (centavos), `integer`. ISO-4217 3-char codes.
- **Money paths get real-PG tests** via `createScratch`. (VERTICAL_TDD.md)
- **No `/api` prefix** in route registration. Restart API after new route registrations (no hot-reload for routes). (CLAUDE.md)
- **Encryption:** per-org secrets via `encryptCredential`/`decryptCredential` from `@/core/gateway`, key = `config.auth.secret`.
- **Settlement transitions:** `duesPaymentStatusEnum` `pending → completed` (guard `DUES_PAYMENT_VALID_TRANSITIONS`); `duesInvoiceStatusEnum` `generated|sent → paid` (no `pending` invoice status exists).

---

## File Structure

**Migrations / schema (Task 1):**
- Modify `services/api-ts/src/handlers/dues/repos/payment-token.schema.ts` — add `revokedAt`, `paymongoSessionId`, `checkoutStartedAt`, `idempotencyKey`.
- Modify `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts` — add `encryptedWebhookSecret` to `duesGatewayConfigs`.
- Modify `services/api-ts/src/handlers/.../dues.schema.ts` (`duesInvoices`) — add `currency`.

**Repos (Tasks 3-4):**
- Modify `services/api-ts/src/handlers/dues/repos/payment-token.repo.ts` — `claimForCheckout`, `attachSession`, `releaseExpiredSession`, `clearCheckoutClaim`, CAS `markUsed`, `revoke`.
- Modify `services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts` — `settleOnlinePayment` (one-tx settle by paymentId).
- Modify `services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts` `getGatewayConfig` already returns the row (no change; consumers read `encryptedSecret`/`encryptedWebhookSecret`/`provider`).

**Adapter (Task 5):**
- Modify `services/api-ts/src/handlers/association:member/utils/paymongo.adapter.ts` — accept an `Idempotency-Key` on `createCheckout`.

**Provider helper (Task 2):**
- Create `services/api-ts/src/handlers/dues/utils/resolve-gateway.ts` — decrypt org secrets, build the adapter, branch on `provider`.

**TypeSpec (Task 6):**
- Modify `specs/api/src/modules/dues-custom.tsp` — re-doc checkout, add `paymongoWebhook` + `revokePaymentLink` ops + `PayMongoWebhookAck` / 202 response.

**Handlers (Tasks 7-9):**
- Modify `services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.ts` — re-point to PayMongo via the claim/idempotency flow.
- Create `services/api-ts/src/handlers/member/duesspecialassessments/paymongoWebhook.ts` — per-org verify + validate + settle.
- Create `services/api-ts/src/handlers/member/duesspecialassessments/revokePaymentLink.ts` — officer revoke.

**Coverage (Task 10):**
- Modify `docs/ver-3/business/br-registry.json`, `scripts/br-coverage.ts` (KNOWN_INCOMPLETE), `docs/product/WORKFLOW_MAP.md`, `scripts/audit/coverage-matrix.ts`.

---

## Task 1: Schema migration (additive columns)

**Files:**
- Modify: `services/api-ts/src/handlers/dues/repos/payment-token.schema.ts:19-52`
- Modify: `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts:149-160`
- Modify: `services/api-ts/src/handlers/association:member/repos/dues.schema.ts` (`duesInvoices` table)
- Generated: `services/api-ts/src/db/migrations/*` (via `db:generate`)

**Interfaces:**
- Produces: `paymentTokens.revokedAt`, `.paymongoSessionId`, `.checkoutStartedAt`, `.idempotencyKey`; `duesGatewayConfigs.encryptedWebhookSecret`; `duesInvoices.currency`.

- [ ] **Step 1: Add columns to `payment_token`**

In `payment-token.schema.ts`, inside the `paymentTokens` table object after `usedAt` (line 44), add:

```typescript
  /** Officer revocation timestamp (null = not revoked) */
  revokedAt: timestamp('revoked_at', { withTimezone: true }),

  /** PayMongo checkout session id for the active attempt (null = none yet) */
  paymongoSessionId: varchar('paymongo_session_id', { length: 255 }),

  /** Lease marker: when the current checkout attempt was claimed (null = unclaimed) */
  checkoutStartedAt: timestamp('checkout_started_at', { withTimezone: true }),

  /** Per-attempt PayMongo Idempotency-Key; regenerated on each claim/remint */
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
```

- [ ] **Step 2: Add `encrypted_webhook_secret` to `dues_gateway_config`**

In `dues-payments.schema.ts`, inside `duesGatewayConfigs` after `encryptedSecret` (line 154), add:

```typescript
  encryptedWebhookSecret: text('encrypted_webhook_secret'),
```

(Nullable: existing rows predate per-org webhooks; checkout/webhook handlers treat a missing secret as "not configured".)

- [ ] **Step 3: Add `currency` to `dues_invoices`**

In `dues.schema.ts`, inside the `duesInvoices` table, add (mirror the existing `varchar(currency)` columns elsewhere):

```typescript
  currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
```

- [ ] **Step 4: Generate the migration**

Run: `cd services/api-ts && bun run db:generate`
Expected: a new `src/db/migrations/NNNN_*.sql` adding the columns. **Open it and confirm:** only `ALTER TABLE ... ADD COLUMN`, no `DROP`, no `DELETE`.

- [ ] **Step 5: Apply + smoke**

Run: `cd services/api-ts && bun run db:migrate` (or start the API which applies on boot).
Expected: migration applies clean; `\d payment_token` shows the 4 new columns.

- [ ] **Step 6: Commit**

```bash
git add services/api-ts/src/handlers/dues/repos/payment-token.schema.ts \
        services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts \
        services/api-ts/src/handlers/association:member/repos/dues.schema.ts \
        services/api-ts/src/db/migrations/
git commit -m "feat(dues): slice-1 schema — pay-link claim/session/revoke cols, per-org webhook secret, invoice currency"
```

---

## Task 2: Per-org gateway resolver

**Files:**
- Create: `services/api-ts/src/handlers/dues/utils/resolve-gateway.ts`
- Test: `services/api-ts/src/handlers/dues/utils/resolve-gateway.test.ts`

**Interfaces:**
- Consumes: `getGatewayConfig(orgId)` → row with `provider`, `encryptedSecret`, `encryptedWebhookSecret`, `connected`; `decryptCredential(ciphertext, key)` from `@/core/gateway`; `config.auth.secret`.
- Produces:
  - `resolveCheckoutAdapter(db, orgId): Promise<GatewayAdapter>` — throws `GatewayNotConfiguredError` if `!connected` or no secret.
  - `resolveWebhookAdapter(db, orgId): Promise<GatewayAdapter | null>` — null if org/secret missing (caller returns 400/404 without leaking).

- [ ] **Step 1: Write the failing test**

```typescript
// resolve-gateway.test.ts
import { describe, it, expect } from 'bun:test';
import { createScratch } from '@/test/scratch'; // adjust to the repo's harness import
import { resolveCheckoutAdapter } from './resolve-gateway';
import { encryptCredential } from '@/core/gateway';
import { config } from '@/core/config';

describe('resolveCheckoutAdapter', () => {
  it('builds a PayMongo adapter from the org-specific decrypted secret', async () => {
    const { db, orgId } = await createScratch();
    await db.insert(/* duesGatewayConfigs */).values({
      organizationId: orgId, provider: 'paymongo', publicKey: 'pk_test_x',
      encryptedSecret: encryptCredential('sk_test_ORGSECRET', config.auth.secret),
      encryptedWebhookSecret: encryptCredential('whsec_org', config.auth.secret),
      connected: true, createdBy: orgId, updatedBy: orgId,
    });
    const adapter = await resolveCheckoutAdapter(db, orgId);
    expect(adapter.name).toBe('paymongo');
    // secret is private; assert via a behavior that depends on it, or expose a test-only getter.
  });

  it('throws when the org is not connected', async () => {
    const { db, orgId } = await createScratch();
    await expect(resolveCheckoutAdapter(db, orgId)).rejects.toThrow(/not configured/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/dues/utils/resolve-gateway.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// resolve-gateway.ts
import type { DatabaseInstance } from '@/core/database';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { PayMongoAdapter } from '@/handlers/association:member/utils/paymongo.adapter';
import type { GatewayAdapter } from '@/handlers/association:member/utils/gateway-adapter';
import { decryptCredential } from '@/core/gateway';
import { config } from '@/core/config';
import { BadRequestError } from '@/core/errors';

export class GatewayNotConfiguredError extends BadRequestError {
  constructor() { super('Online payment is not configured for this organization'); }
}

function buildAdapter(provider: string, secret: string, webhookSecret: string): GatewayAdapter {
  switch (provider) {
    case 'paymongo': return new PayMongoAdapter(secret, webhookSecret);
    default: throw new GatewayNotConfiguredError(); // stripe-on-dues not supported in lean
  }
}

export async function resolveCheckoutAdapter(db: DatabaseInstance, orgId: string): Promise<GatewayAdapter> {
  const cfg = await new DuesRepository(db).getGatewayConfig(orgId);
  if (!cfg || !cfg.connected || !cfg.encryptedSecret) throw new GatewayNotConfiguredError();
  const secret = decryptCredential(cfg.encryptedSecret, config.auth.secret);
  const webhookSecret = cfg.encryptedWebhookSecret
    ? decryptCredential(cfg.encryptedWebhookSecret, config.auth.secret) : '';
  return buildAdapter(cfg.provider, secret, webhookSecret);
}

export async function resolveWebhookAdapter(db: DatabaseInstance, orgId: string): Promise<GatewayAdapter | null> {
  const cfg = await new DuesRepository(db).getGatewayConfig(orgId);
  if (!cfg || !cfg.encryptedWebhookSecret) return null;
  const secret = cfg.encryptedSecret ? decryptCredential(cfg.encryptedSecret, config.auth.secret) : '';
  const webhookSecret = decryptCredential(cfg.encryptedWebhookSecret, config.auth.secret);
  return buildAdapter(cfg.provider, secret, webhookSecret);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/dues/utils/resolve-gateway.test.ts`
Expected: PASS. (If asserting the secret needs visibility, add a test-only `__secretForTest` getter on the adapter behind `if (process.env.NODE_ENV === 'test')`, or assert by stubbing `fetch` and reading the Authorization header.)

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/dues/utils/resolve-gateway.ts services/api-ts/src/handlers/dues/utils/resolve-gateway.test.ts
git commit -m "feat(dues): per-org PayMongo gateway resolver (decrypt secret, build adapter)"
```

---

## Task 3: Payment-token repo — claim/session/revoke/CAS

**Files:**
- Modify: `services/api-ts/src/handlers/dues/repos/payment-token.repo.ts`
- Test: `services/api-ts/src/handlers/dues/repos/payment-token.repo.test.ts` (extend)

**Interfaces:**
- Produces on `PaymentTokenRepository`:
  - `claimForCheckout(id: string, idempotencyKey: string): Promise<PaymentToken | null>` — single-winner; null if not claimable.
  - `attachSession(id: string, sessionId: string): Promise<void>`
  - `releaseExpiredSession(id: string, expiredSessionId: string): Promise<void>`
  - `clearCheckoutClaim(id: string): Promise<void>`
  - `markUsedCas(id: string): Promise<boolean>` — true iff this call set `usedAt`.
  - `revoke(id: string): Promise<boolean>`

- [ ] **Step 1: Write failing tests**

```typescript
// payment-token.repo.test.ts (append)
describe('claimForCheckout (single-winner mutex)', () => {
  it('only one of two concurrent claims wins', async () => {
    const { db } = await createScratch();
    const repo = new PaymentTokenRepository(db);
    const id = await seedActiveToken(db); // helper: inserts an active, unused, unexpired token
    const [a, b] = await Promise.all([repo.claimForCheckout(id, 'key-a'), repo.claimForCheckout(id, 'key-b')]);
    expect([a, b].filter(Boolean).length).toBe(1);
  });

  it('reclaims a stale claim (checkout_started_at older than 2 min, no session)', async () => {
    const { db } = await createScratch();
    const repo = new PaymentTokenRepository(db);
    const id = await seedActiveToken(db, { checkoutStartedAt: new Date(Date.now() - 3 * 60_000) });
    expect(await repo.claimForCheckout(id, 'key')).not.toBeNull();
  });

  it('does NOT claim once a session is attached', async () => {
    const { db } = await createScratch();
    const repo = new PaymentTokenRepository(db);
    const id = await seedActiveToken(db, { paymongoSessionId: 'cs_test_1', checkoutStartedAt: new Date() });
    expect(await repo.claimForCheckout(id, 'key')).toBeNull();
  });
});

describe('markUsedCas', () => {
  it('returns true once, false on the second call', async () => {
    const { db } = await createScratch();
    const repo = new PaymentTokenRepository(db);
    const id = await seedActiveToken(db);
    expect(await repo.markUsedCas(id)).toBe(true);
    expect(await repo.markUsedCas(id)).toBe(false);
  });
});

describe('revoke', () => {
  it('sets revokedAt and blocks future claims', async () => {
    const { db } = await createScratch();
    const repo = new PaymentTokenRepository(db);
    const id = await seedActiveToken(db);
    expect(await repo.revoke(id)).toBe(true);
    expect(await repo.claimForCheckout(id, 'key')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd services/api-ts && bun test src/handlers/dues/repos/payment-token.repo.test.ts`
Expected: FAIL (methods undefined).

- [ ] **Step 3: Implement the repo methods**

```typescript
// payment-token.repo.ts — add to PaymentTokenRepository. Imports: sql, and, eq, isNull, gt, lt, or.
async claimForCheckout(id: string, idempotencyKey: string): Promise<PaymentToken | null> {
  const staleCutoff = sql`now() - interval '2 minutes'`;
  const [row] = await this.db.update(paymentTokens)
    .set({ checkoutStartedAt: new Date(), idempotencyKey })
    .where(and(
      eq(paymentTokens.id, id),
      isNull(paymentTokens.usedAt),
      isNull(paymentTokens.revokedAt),
      gt(paymentTokens.expiresAt, sql`now()`),
      isNull(paymentTokens.paymongoSessionId),
      or(isNull(paymentTokens.checkoutStartedAt), lt(paymentTokens.checkoutStartedAt, staleCutoff)),
    ))
    .returning();
  return row ?? null;
}

async attachSession(id: string, sessionId: string): Promise<void> {
  await this.db.update(paymentTokens).set({ paymongoSessionId: sessionId }).where(eq(paymentTokens.id, id));
}

async releaseExpiredSession(id: string, expiredSessionId: string): Promise<void> {
  await this.db.update(paymentTokens)
    .set({ paymongoSessionId: null, checkoutStartedAt: null })
    .where(and(eq(paymentTokens.id, id), eq(paymentTokens.paymongoSessionId, expiredSessionId)));
}

async clearCheckoutClaim(id: string): Promise<void> {
  await this.db.update(paymentTokens)
    .set({ checkoutStartedAt: null })
    .where(and(eq(paymentTokens.id, id), isNull(paymentTokens.paymongoSessionId)));
}

async markUsedCas(id: string): Promise<boolean> {
  const [row] = await this.db.update(paymentTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(paymentTokens.id, id), isNull(paymentTokens.usedAt)))
    .returning({ id: paymentTokens.id });
  return !!row;
}

async revoke(id: string): Promise<boolean> {
  const [row] = await this.db.update(paymentTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(paymentTokens.id, id), isNull(paymentTokens.usedAt), isNull(paymentTokens.revokedAt)))
    .returning({ id: paymentTokens.id });
  return !!row;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd services/api-ts && bun test src/handlers/dues/repos/payment-token.repo.test.ts`
Expected: PASS (all, including the concurrent-claim test).

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/dues/repos/payment-token.repo.ts services/api-ts/src/handlers/dues/repos/payment-token.repo.test.ts
git commit -m "feat(dues): pay-link token claim mutex, CAS markUsed, revoke, session attach/release"
```

---

## Task 4: Settle online payment in one transaction

**Files:**
- Modify: `services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts`
- Test: `services/api-ts/src/handlers/dues/repos/dues-payments.settle.test.ts` (new)

**Interfaces:**
- Consumes: `updatePaymentStatus` + `DUES_PAYMENT_VALID_TRANSITIONS`; `DuesInvoiceRepository.markPaid(id, version, gatewayEventId, paidAt)`.
- Produces: `settleOnlinePayment(args): Promise<{ settled: boolean }>` where
  `args = { paymentId, tokenId, invoiceId?, gatewayEventId, paidAt }`.
  Idempotent: returns `{ settled: false }` if the payment is already `completed`.

- [ ] **Step 1: Write the failing test**

```typescript
// dues-payments.settle.test.ts
describe('settleOnlinePayment', () => {
  it('moves payment pending→completed, invoice→paid, in one tx, and reflects in reports', async () => {
    const { db, orgId } = await createScratch();
    const { paymentId, tokenId, invoiceId } = await seedPendingOnlinePayment(db, orgId, { amount: 50000 });
    const duesRepo = new DuesRepository(db);
    const res = await duesRepo.settleOnlinePayment({ paymentId, tokenId, invoiceId, gatewayEventId: 'evt_1', paidAt: new Date() });
    expect(res.settled).toBe(true);
    const stats = await duesRepo.getFullDashboardStats(orgId);
    expect(stats.totalCollected).toBeGreaterThanOrEqual(50000); // regression for the lost-money bug
  });

  it('is idempotent — second settle is a no-op', async () => {
    const { db, orgId } = await createScratch();
    const { paymentId, tokenId, invoiceId } = await seedPendingOnlinePayment(db, orgId, { amount: 50000 });
    const duesRepo = new DuesRepository(db);
    await duesRepo.settleOnlinePayment({ paymentId, tokenId, invoiceId, gatewayEventId: 'evt_1', paidAt: new Date() });
    const second = await duesRepo.settleOnlinePayment({ paymentId, tokenId, invoiceId, gatewayEventId: 'evt_1', paidAt: new Date() });
    expect(second.settled).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/dues/repos/dues-payments.settle.test.ts`
Expected: FAIL (method undefined).

- [ ] **Step 3: Implement `settleOnlinePayment`**

```typescript
// dues-payments.repo.ts — add to DuesRepository
async settleOnlinePayment(args: {
  paymentId: string; tokenId: string; invoiceId?: string | null;
  gatewayEventId: string; paidAt: Date;
}): Promise<{ settled: boolean }> {
  return this.db.transaction(async (tx) => {
    const txRepo = new DuesRepository(tx);
    const payment = await txRepo.getPaymentById(args.paymentId); // existing getter; add if missing
    if (!payment) return { settled: false };
    if (payment.status === 'completed') return { settled: false }; // idempotent
    await txRepo.updatePaymentStatus(args.paymentId, payment.status, 'completed',
      { paidAt: args.paidAt, gatewayEventId: args.gatewayEventId }, payment.personId);
    if (args.invoiceId) {
      const invoiceRepo = new DuesInvoiceRepository(tx);
      const invoice = await invoiceRepo.findOneById(args.invoiceId);
      if (invoice && invoice.status !== 'paid') {
        await invoiceRepo.markPaid(invoice.id, invoice.version, args.gatewayEventId, args.paidAt);
      }
    }
    await new PaymentTokenRepository(tx).markUsedCas(args.tokenId);
    return { settled: true };
  });
}
```

(If `getPaymentById` / `gatewayEventId` column don't exist, add the trivial getter and confirm the column on `duesPayments`; the existing `updatePaymentStatus` already accepts an `extra` partial.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/dues/repos/dues-payments.settle.test.ts`
Expected: PASS (both, including the report-regression assertion).

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts services/api-ts/src/handlers/dues/repos/dues-payments.settle.test.ts
git commit -m "fix(dues): settle online payment atomically (payment→completed + invoice→paid + token used) — closes lost-money bug"
```

---

## Task 5: Adapter — per-attempt Idempotency-Key

**Files:**
- Modify: `services/api-ts/src/handlers/association:member/utils/paymongo.adapter.ts:28-53`
- Test: `services/api-ts/src/handlers/association:member/utils/paymongo.adapter.test.ts` (extend)

**Interfaces:**
- Changes: `createCheckout(opts: CheckoutOpts, idempotencyKey?: string)` — when provided, sends `Idempotency-Key: <key>` header. (Backward compatible: optional arg.)

- [ ] **Step 1: Write the failing test**

```typescript
// paymongo.adapter.test.ts (append) — stub global fetch, assert header
it('sends the Idempotency-Key header when provided', async () => {
  let seen: Record<string,string> = {};
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: any) => {
    seen = init.headers;
    return new Response(JSON.stringify({ data: { id: 'cs_1', attributes: { checkout_url: 'https://x' } } }), { status: 200 });
  }) as any;
  try {
    const a = new PayMongoAdapter('sk_test', 'whsec');
    await a.createCheckout({ amount: 1000, currency: 'PHP', description: 'd', email: 'm@x.com', metadata: {}, successUrl: 's', cancelUrl: 'c' }, 'idem-123');
    expect(seen['Idempotency-Key']).toBe('idem-123');
  } finally { globalThis.fetch = orig; }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/association:member/utils/paymongo.adapter.test.ts`
Expected: FAIL (header undefined / arg ignored).

- [ ] **Step 3: Implement**

Change the `createCheckout` signature and header block:

```typescript
async createCheckout(opts: CheckoutOpts, idempotencyKey?: string): Promise<CheckoutResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST', headers, body: JSON.stringify({ /* unchanged */ }),
  });
  // ...rest unchanged
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/association:member/utils/paymongo.adapter.test.ts`
Expected: PASS (new + existing tests).

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/association:member/utils/paymongo.adapter.ts services/api-ts/src/handlers/association:member/utils/paymongo.adapter.test.ts
git commit -m "feat(paymongo): optional Idempotency-Key header on createCheckout"
```

---

## Task 6: TypeSpec — webhook + revoke ops, 202 on checkout

**Files:**
- Modify: `specs/api/src/modules/dues-custom.tsp`
- Generated (do NOT edit): `specs/api/dist/...`, `services/api-ts/src/generated/openapi/*`, `packages/sdk-ts/src/generated/*`

**Interfaces:**
- Produces ops: `paymongoWebhook` (`POST /webhooks/paymongo/{organizationId}`, public), `revokePaymentLink` (`POST /org/{organizationId}/payments/{tokenId}/revoke`, officer). Checkout gains a 202 response.

- [ ] **Step 1: Add models + ops to `dues-custom.tsp`**

Add a webhook ack model near the other payment models:

```typespec
@doc("Acknowledgement of a payment gateway webhook")
model PaymentWebhookAck {
  received: boolean;
  action: string;
}
```

In `interface PaymentTokenEndpoints`, add a `202` variant to `checkoutPaymentToken` and update its doc to PayMongo:

```typespec
    @doc("Initiate PayMongo checkout for a payment token. Single-use, idempotent (one active session per token; double-tap returns the same URL or 202 while a session is being created).")
    @operationId("checkoutPaymentToken")
    @post
    @route("/pay/{token}/checkout")
    checkoutPaymentToken(
      @path token: string,
    ): ApiOkResponse<PaymentCheckoutResponse>
      | { @statusCode statusCode: 202; @body body: PaymentCheckoutResponse }
      | ApiBadRequestResponse;
```

Add the public webhook interface:

```typespec
  @doc("Public PayMongo webhook — per-org URL; signature verified with the org's webhook secret. No bearer auth.")
  interface PayMongoWebhookEndpoints {
    @doc("Receive a PayMongo webhook for one org and reconcile the matching payment.")
    @operationId("paymongoWebhook")
    @post
    @route("/webhooks/paymongo/{organizationId}")
    paymongoWebhook(
      @path organizationId: UUID,
    ): ApiOkResponse<PaymentWebhookAck> | ApiBadRequestResponse;
  }
```

Add the officer revoke op into `interface PaymentLinkManagement`:

```typespec
    @doc("Revoke an unused payment link. Officer only.")
    @operationId("revokePaymentLink")
    @post
    @route("/org/{organizationId}/payments/{tokenId}/revoke")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-officer", true)
    revokePaymentLink(
      @path organizationId: string,
      @path tokenId: string,
    ): ApiOkResponse<{ revoked: boolean }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
```

- [ ] **Step 2: Build TypeSpec + generate**

Run:
```bash
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```
Expected: new `paymongoWebhook` / `revokePaymentLink` entries appear in `src/generated/openapi/registry.ts` + `routes.ts`; checkout op now declares 202. No manual edits to generated files.

- [ ] **Step 3: Regenerate the SDK**

Run: `bun run --filter @monobase/sdk-ts generate`
Expected: SDK types include the two new operations. (CI git-diff gate requires this.)

- [ ] **Step 4: Typecheck**

Run: `cd services/api-ts && bun run typecheck`
Expected: FAILS — `registry.ts` now imports `paymongoWebhook` + `revokePaymentLink` handlers that don't exist yet. This is expected; Tasks 7-9 add them. (Do not commit a broken typecheck; commit happens after the handlers land. If the generator stubs missing handlers, proceed; otherwise continue to Task 7 before committing.)

- [ ] **Step 5: Commit (spec + generated only; handlers follow)**

Defer the commit to the end of Task 8 so the tree typechecks. (Or, if the team prefers, commit spec+generated now and accept a transient red typecheck on this single commit.)

---

## Task 7: Re-point checkout handler to PayMongo

**Files:**
- Modify: `services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.ts` (full rewrite of the body)
- Test: `services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.integration.test.ts` (new/extend)

**Interfaces:**
- Consumes: `resolveCheckoutAdapter`, `PaymentTokenRepository.{findByTokenHash, claimForCheckout, attachSession, releaseExpiredSession, clearCheckoutClaim}`, `DuesRepository.createPayment`, adapter `createCheckout(opts, idemKey)` + `getPaymentStatus`.
- Produces: `POST /pay/:token/checkout` → 200 `{ checkoutUrl }` | 202 `{ checkoutUrl }` (empty/placeholder while starting) | 400 | 409 | 410 | 502.

- [ ] **Step 1: Write failing real-PG tests**

```typescript
// checkoutPaymentToken.integration.test.ts
describe('POST /pay/:token/checkout (PayMongo)', () => {
  it('creates exactly one PayMongo session under concurrent double-tap', async () => {
    // seed a paymongo-connected org + active token; stub the adapter fetch to count calls
    // tap twice concurrently; assert createCheckout called once and both responses share the checkout_url
  });
  it('returns 410 for an expired token', async () => { /* ... */ });
  it('returns 410 for a revoked token', async () => { /* ... */ });
  it('returns 409 for a used token', async () => { /* ... */ });
  it('remints a fresh session when the stored session is expired at PayMongo', async () => { /* ... */ });
  it('keeps the token claimable (retryable) after a PayMongo 502', async () => { /* ... */ });
});
```

Write the bodies against the real harness (mirror `public-payment-link.integration.test.ts` for setup). Each asserts behavior, not just status.

- [ ] **Step 2: Run to verify they fail**

Run: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/checkoutPaymentToken.integration.test.ts`
Expected: FAIL (handler still Stripe / new behavior absent).

- [ ] **Step 3: Rewrite the handler**

```typescript
// checkoutPaymentToken.ts — PayMongo, claim-then-call. Imports: crypto.randomUUID, resolveCheckoutAdapter,
// PaymentTokenRepository, DuesRepository, formatReceiptNumber, hashPaymentToken/getPaymentTokenSecret/isPaymentTokenExpired.
export async function checkoutPaymentToken(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const rawToken = ctx.req.param('token');
  if (!rawToken) return ctx.json({ error: 'Token is required' }, 400);
  const db = ctx.get('database');
  const tokenRepo = new PaymentTokenRepository(db);
  const token = await tokenRepo.findByTokenHash(hashPaymentToken(rawToken, getPaymentTokenSecret()));
  if (!token) return ctx.json({ error: 'Payment link is invalid' }, 400);
  if (token.revokedAt) return ctx.json({ error: 'This payment link was revoked' }, 410);
  if (token.usedAt) return ctx.json({ error: 'This payment has already been processed' }, 409);
  if (isPaymentTokenExpired(token.expiresAt)) return ctx.json({ error: 'This payment link has expired' }, 410);

  const adapter = await resolveCheckoutAdapter(db, token.organizationId); // throws → 400 via error middleware

  // Reuse an existing live session (idempotent double-tap), remint if expired.
  if (token.paymongoSessionId) {
    const status = await adapter.getPaymentStatus(token.paymongoSessionId);
    if (status.status === 'expired' || status.status === 'failed') {
      await tokenRepo.releaseExpiredSession(token.id, token.paymongoSessionId);
    } else {
      const url = await sessionUrl(adapter, token.paymongoSessionId); // re-fetch checkout_url
      return ctx.json({ checkoutUrl: url }, 200);
    }
  }

  const idemKey = randomUUID();
  const claimed = await tokenRepo.claimForCheckout(token.id, idemKey);
  if (!claimed) {
    const fresh = await tokenRepo.findByTokenHash(token.tokenHash);
    if (fresh?.paymongoSessionId) return ctx.json({ checkoutUrl: await sessionUrl(adapter, fresh.paymongoSessionId) }, 200);
    return ctx.json({ checkoutUrl: '' }, 202); // another tap is creating the session; retry
  }

  // Create the pending ledger row (kept from FIX-001) and carry paymentId in metadata.
  const duesRepo = new DuesRepository(db);
  const pending = await createPendingPayment(duesRepo, token); // factored helper; mirrors existing FIX-001 block
  try {
    const publicUrl = process.env['SERVER_PUBLIC_URL'] || process.env['PUBLIC_URL'] || 'http://localhost:3004';
    const result = await adapter.createCheckout({
      amount: token.amount, currency: token.currency,
      description: `Dues payment - ${token.currency} ${(token.amount / 100).toFixed(2)}`,
      email: await memberEmail(db, token.personId),
      successUrl: `${publicUrl}/pay/${rawToken}?status=success`,
      cancelUrl: `${publicUrl}/pay/${rawToken}?status=cancelled`,
      metadata: { paymentId: pending.id, paymentTokenId: token.id, orgId: token.organizationId },
    }, claimed.idempotencyKey ?? idemKey);
    await tokenRepo.attachSession(token.id, result.sessionId);
    return ctx.json({ checkoutUrl: result.checkoutUrl }, 200);
  } catch {
    await tokenRepo.clearCheckoutClaim(token.id); // release lease → retryable; harmless-orphan note (spec)
    return ctx.json({ error: 'Failed to create checkout session. Please try again.' }, 502);
  }
}
```

Add the small helpers (`sessionUrl`, `createPendingPayment`, `memberEmail`) in the same file or a `utils/` sibling. NOTE the harmless-duplicate-unpaid-session comment per the spec.

- [ ] **Step 4: Run to verify they pass**

Run: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/checkoutPaymentToken.integration.test.ts`
Expected: PASS (all six, including concurrent single-session + reclaim).

- [ ] **Step 5: Commit** (after Task 8 if typecheck depends on the webhook handler; otherwise now)

```bash
git add services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.ts services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.integration.test.ts
git commit -m "feat(dues): re-point /pay/:token/checkout to PayMongo with claim-then-call idempotency"
```

---

## Task 8: PayMongo webhook handler (per-org verify + validate + settle)

**Files:**
- Create: `services/api-ts/src/handlers/member/duesspecialassessments/paymongoWebhook.ts`
- Test: `services/api-ts/src/handlers/member/duesspecialassessments/paymongoWebhook.integration.test.ts`

**Interfaces:**
- Consumes: `resolveWebhookAdapter(db, orgId)`, `webhookRetryLogs` (idempotency insert, mirror `handleStripeWebhook.ts:79-127`), `DuesRepository.{getPaymentById, settleOnlinePayment}`, `PaymentTokenRepository`.
- Produces: `POST /webhooks/paymongo/:organizationId` → 200 `{ received, action }` | 400 (bad sig) | 409 (mismatch).

- [ ] **Step 1: Write failing real-PG tests**

```typescript
// paymongoWebhook.integration.test.ts
describe('POST /webhooks/paymongo/:orgId', () => {
  it('settles a valid signed paid event and moves reports', async () => { /* sign fixture with org secret; assert duesPayments completed + totalCollected moved */ });
  it('rejects a bad signature with 400 and no state change', async () => { /* ... */ });
  it('dedupes redelivery via webhookRetryLogs (one settlement)', async () => { /* ... */ });
  it('returns 409 when event amount != token amount', async () => { /* ... */ });
  it('rejects an event for the wrong org (verified with org A secret, payment of org B)', async () => { /* ... */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/paymongoWebhook.integration.test.ts`
Expected: FAIL (handler missing).

- [ ] **Step 3: Implement**

```typescript
// paymongoWebhook.ts
export async function paymongoWebhook(ctx: ValidatedContext<never, never, never>): Promise<Response> {
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.text();
  const signature = ctx.req.header('paymongo-signature') || '';
  const db = ctx.get('database');

  const adapter = await resolveWebhookAdapter(db, orgId);
  if (!adapter) return ctx.json({ error: 'Payment gateway not configured' }, 400);
  const event = adapter.verifyWebhook(body, signature);
  if (!event) return ctx.json({ error: 'Invalid webhook signature' }, 400);

  // Idempotency: insert-once on the event id; mirror handleStripeWebhook.ts:79-127.
  const claimed = await insertWebhookLogOnce(db, { idempotencyKey: event.gatewayEventId, provider: 'paymongo', eventType: event.type, payload: JSON.parse(body), organizationId: orgId });
  if (!claimed) return ctx.json({ received: true, action: 'duplicate' });

  if (event.status !== 'paid') return ctx.json({ received: true, action: 'noted' });

  const paymentId = event.metadata['paymentId'];
  if (!paymentId) return ctx.json({ received: true, action: 'ignored' });
  const duesRepo = new DuesRepository(db);
  const payment = await duesRepo.getPaymentById(paymentId);
  if (!payment) return ctx.json({ received: true, action: 'unknown_payment' });

  // Inbound validation (B4): amount + currency + org must match.
  if (payment.organizationId !== orgId) return ctx.json({ error: 'org mismatch' }, 409);
  if (event.amount !== payment.amount || event.currency !== payment.currency) return ctx.json({ error: 'amount mismatch' }, 409);

  const tokenId = event.metadata['paymentTokenId'];
  const res = await duesRepo.settleOnlinePayment({ paymentId, tokenId, invoiceId: payment.invoiceId, gatewayEventId: event.gatewayEventId, paidAt: new Date() });
  ctx.set('auditResourceId', paymentId);
  ctx.set('auditDescription', `Online payment via PayMongo: ${event.gatewayEventId}`);
  return ctx.json({ received: true, action: res.settled ? 'processed' : 'already_settled' });
}
```

Implement `insertWebhookLogOnce` by lifting the `onConflictDoNothing` pattern from `handleStripeWebhook.ts:79-127` (returns false when the key already existed).

- [ ] **Step 4: Run to verify they pass**

Run: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/paymongoWebhook.integration.test.ts`
Expected: PASS (all five).

- [ ] **Step 5: Typecheck the generated wiring**

Run: `cd services/api-ts && bun run typecheck`
Expected: PASS — `registry.ts` resolves `paymongoWebhook` + (Task 9) `revokePaymentLink`. If `revokePaymentLink` still missing, do Task 9 before this passes.

- [ ] **Step 6: Restart API + live smoke**

Restart `bun dev` (routes need a restart). Hit `POST /webhooks/paymongo/<org>` with a signed fixture; expect `processed`.

- [ ] **Step 7: Commit**

```bash
git add specs/api/src/modules/dues-custom.tsp services/api-ts/src/generated packages/sdk-ts/src/generated \
        services/api-ts/src/handlers/member/duesspecialassessments/paymongoWebhook.ts services/api-ts/src/handlers/member/duesspecialassessments/paymongoWebhook.integration.test.ts \
        services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.ts services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.integration.test.ts
git commit -m "feat(dues): net-new per-org PayMongo webhook (verify+validate+atomic settle) + checkout re-point + spec/sdk regen"
```

---

## Task 9: Officer revoke handler

**Files:**
- Create: `services/api-ts/src/handlers/member/duesspecialassessments/revokePaymentLink.ts`
- Test: `services/api-ts/src/handlers/member/duesspecialassessments/revokePaymentLink.test.ts`

**Interfaces:**
- Consumes: `PaymentTokenRepository.revoke(tokenId)`; the generated validator for `revokePaymentLink` (org context + officer role enforced by the generated middleware via the TypeSpec `@extension`s).
- Produces: `POST /org/:organizationId/payments/:tokenId/revoke` → 200 `{ revoked: true }` | 404 (already used / not found / wrong org).

- [ ] **Step 1: Write failing test**

```typescript
// revokePaymentLink.test.ts
it('revokes an unused token', async () => {
  const { db, orgId } = await createScratch();
  const tokenId = await seedActiveToken(db, { organizationId: orgId });
  const res = await callRevoke(db, orgId, tokenId); // helper invoking the handler with officer ctx
  expect(res.status).toBe(200);
  expect(await new PaymentTokenRepository(db).claimForCheckout(tokenId, 'k')).toBeNull();
});
it('404s a token from another org', async () => { /* ensure org scoping */ });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/revokePaymentLink.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// revokePaymentLink.ts
export async function revokePaymentLink(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const orgId = ctx.req.param('organizationId');
  const tokenId = ctx.req.param('tokenId');
  const db = ctx.get('database');
  const repo = new PaymentTokenRepository(db);
  const token = await repo.findById(tokenId); // add trivial getById if absent
  if (!token || token.organizationId !== orgId) return ctx.json({ error: 'Not found' }, 404);
  const ok = await repo.revoke(tokenId);
  if (!ok) return ctx.json({ error: 'Link already used or revoked' }, 404);
  return ctx.json({ revoked: true }, 200);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/revokePaymentLink.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/src/handlers/member/duesspecialassessments/revokePaymentLink.ts services/api-ts/src/handlers/member/duesspecialassessments/revokePaymentLink.test.ts
git commit -m "feat(dues): officer revoke payment link"
```

---

## Task 10: BRs, WORKFLOW_MAP, coverage ratchet

**Files:**
- Modify: `docs/ver-3/business/br-registry.json`
- Modify: `scripts/br-coverage.ts` (KNOWN_INCOMPLETE)
- Modify: `docs/product/WORKFLOW_MAP.md`
- Modify: `scripts/audit/coverage-matrix.ts`

**Interfaces:**
- Produces: registered BRs for the slice, lean workflow entries, removed waivers for the BRs this slice now covers.

- [ ] **Step 1: Extract + register BRs**

Use `/br-extract` (or hand-add) the 8 BRs from the spec's "Business rules" section into `br-registry.json`, each with `backend`/`contract`/`e2e` test refs pointing at the tests written in Tasks 3-9 (single-use, TTL, revocable, idempotent, webhook signature trust boundary, inbound amount/org validation, per-org settlement, PHP currency). Archive (don't delete) any superseded old-product BRs.

- [ ] **Step 2: Re-point WORKFLOW_MAP to the lean flow**

In `WORKFLOW_MAP.md`, update the dues-online workflow entries (e.g. WF "Pay Dues Online") to reference the lean route set (`/pay/:token/checkout`, `/webhooks/paymongo/:orgId`, `/org/:org/payments/send-link`, `/revoke`) and the new tests. Remove references to deleted-app e2e.

- [ ] **Step 3: Ratchet the waivers**

In `scripts/br-coverage.ts`, remove from `KNOWN_INCOMPLETE` the BR ids this slice now fully covers (backend+contract+test). Leave the rest for later slices.

- [ ] **Step 4: Run the coverage gates**

Run:
```bash
cd /Users/elad-mini/Desktop/memberry
bun run test:br
bun run scripts/audit/coverage-matrix.ts   # or the documented coverage-matrix command
```
Expected: green; the ratcheted BRs now COMPLETE; no regression on others.

- [ ] **Step 5: Commit**

```bash
git add docs/ver-3/business/br-registry.json scripts/br-coverage.ts docs/product/WORKFLOW_MAP.md scripts/audit/coverage-matrix.ts
git commit -m "test(dues): register slice-1 BRs, re-point WORKFLOW_MAP lean, ratchet KNOWN_INCOMPLETE"
```

---

## Task 11: Full gate + ship

- [ ] **Step 1: Regenerate-drift check**

Run: `bun run --filter @monobase/sdk-ts generate && git diff --exit-code packages/sdk-ts/src/generated`
Expected: no diff (SDK already regenerated in Task 6/8).

- [ ] **Step 2: Full engine suite + typecheck**

Run:
```bash
cd services/api-ts && bun test
cd /Users/elad-mini/Desktop/memberry && bun run typecheck
```
Expected: all green; no pre-existing tests broken (additive-only honored).

- [ ] **Step 3: Contract suite**

Run: `bun run test:contract`
Expected: green (add Hurl cases for the new ops if the contract scaffold requires; mirror existing dues payment Hurl files).

- [ ] **Step 4: Ship**

Invoke `/ship`. The DoD (spec) must be green: one live checkout + one webhook, per-org keys, atomic settlement with the report-regression test, concurrent-double-tap single-session, amount/org validation, migration reviewed, BRs ratcheted, SDK no-drift.

---

## Self-Review

**Spec coverage:** B1 per-org keys → Task 2 + Task 1 (`encrypted_webhook_secret`) + Task 8 (per-org verify). B2 route consolidation → Task 6 (re-doc) + Task 7 (re-point) + Task 8 (net-new webhook); orphans untouched per Global Constraints. B3 settlement → Task 4. B4 inbound validation → Task 8. R1/R2/R3 idempotency → Task 3 (claim/CAS/release) + Task 7 (claim-then-call, remint, reclaim) + Task 5 (per-attempt key). R5 binding → Task 8 (`metadata.paymentId`) + the adapter contract test (Task 7/5 fetch stub). Schema gap (`duesInvoices.currency`) → Task 1. BRs + ratchet → Task 10. Tests 1-9 from the spec map onto Tasks 3/4/7/8. ✓

**Placeholder scan:** Handler bodies show real code; test bodies for the integration tests are described with explicit assertions to write against the real harness (mirror named existing files) rather than invented harness internals — acceptable because the exact `createScratch` seed helpers are repo-specific and must match existing usage. Implementer: copy setup from `public-payment-link.integration.test.ts`.

**Type consistency:** `claimForCheckout`/`attachSession`/`releaseExpiredSession`/`clearCheckoutClaim`/`markUsedCas`/`revoke` (Task 3) are the exact names used in Tasks 7/9. `settleOnlinePayment` args match between Task 4 and Task 8. `resolveCheckoutAdapter`/`resolveWebhookAdapter` (Task 2) match Tasks 7/8. `createCheckout(opts, idempotencyKey?)` (Task 5) matches the Task 7 call. ✓

**Open implementer confirmations (cheap, do at task start):** `getPaymentById` getter + `gatewayEventId`/`currency` columns on `duesPayments` exist or are trivially added (Task 4); `findById` on the token repo (Task 9); the exact `createScratch` import path + seed helpers; whether the generator tolerates a missing handler between Task 6 and Task 8 (if not, fold Task 6's commit into Task 8 as noted).
