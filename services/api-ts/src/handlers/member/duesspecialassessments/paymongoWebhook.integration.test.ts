/**
 * paymongoWebhook — net-new per-org PayMongo webhook settle path (Task 8).
 *
 * The settle side of the login-free pay-link money flow: PayMongo POSTs a signed
 * `…payment.paid` event to `POST /webhooks/paymongo/:organizationId`; we verify the
 * signature with THAT org's OWN webhook secret, validate the event against the
 * recorded pending payment (org + amount + currency), then atomically settle it
 * (payment pending→completed, pay-link token stamped used) so collected dues show
 * up in reports. A redelivery must settle exactly once; a misrouted/tampered event
 * must never settle.
 *
 * These are REAL-Postgres tests (createScratch harness). Idempotency rides on the
 * unique `webhook_retry_log` ledger + the settle short-circuit — both need real
 * transaction semantics, so a mock DB would prove nothing. The PayMongo HTTP
 * boundary is never called here: the webhook verifies the signature locally with
 * the org's webhook secret, so we sign fixtures with the same secret + crypto the
 * adapter (`PayMongoAdapter.verifyWebhook`) expects.
 *
 * Run (REQUIRED — a skipped run is a false green):
 *   DATABASE_URL=postgres://postgres:password@localhost:5433/monobase \
 *     bun test src/handlers/member/duesspecialassessments/paymongoWebhook.integration.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { encryptCredential } from '@/core/gateway';
import {
  duesPayments,
  duesGatewayConfigs,
  webhookRetryLogs,
} from '@/handlers/dues/repos/dues-payments.schema';
import { paymentTokens } from '@/handlers/dues/repos/payment-token.schema';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { paymongoWebhook } from './paymongoWebhook';

// Deterministic secrets pinned for the suite. resolveWebhookAdapter decrypts the
// org's PayMongo webhook secret with config.auth.secret; the adapter then verifies
// the signature with that webhook secret — so we encrypt with AUTH_SECRET and sign
// fixtures with the same WEBHOOK_SECRET we stored.
const AUTH_SECRET = 'webhook-suite-auth-secret-deterministic';
const WEBHOOK_SECRET = 'whsec_test_deterministic_per_org';
const OFFICER = '00000000-0000-4000-8000-00000000d001';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return noopLogger; } } as any;

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch([
    'payment_token',
    'dues_gateway_config',
    'dues_payment',
    'dues_payment_status_history',
    'webhook_retry_log',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

/** Seed a PayMongo gateway config for the org WITH an encrypted webhook secret. */
async function seedGateway(orgId: string): Promise<void> {
  await H.db.insert(duesGatewayConfigs).values({
    organizationId: orgId,
    provider: 'paymongo',
    publicKey: 'pk_test_public',
    encryptedSecret: encryptCredential('sk_test_secret', AUTH_SECRET),
    encryptedWebhookSecret: encryptCredential(WEBHOOK_SECRET, AUTH_SECRET),
    connected: true,
  });
}

/** Seed a pending online dues_payment; returns its id. */
async function seedPayment(
  orgId: string,
  personId: string,
  opts: { amount: number; currency?: string },
): Promise<string> {
  const [row] = await H.db
    .insert(duesPayments)
    .values({
      organizationId: orgId,
      personId,
      invoiceId: null,
      receiptNumber: `RC-${crypto.randomUUID().slice(0, 8)}`,
      amount: opts.amount,
      currency: opts.currency ?? 'PHP',
      paymentMethod: 'online',
      status: 'pending',
    })
    .returning({ id: duesPayments.id });
  return row!.id;
}

/** Seed an active pay-link token; returns its id. */
async function seedToken(orgId: string, personId: string, amount: number): Promise<string> {
  const [row] = await H.db
    .insert(paymentTokens)
    .values({
      tokenHash: `hash-${crypto.randomUUID()}`,
      personId,
      organizationId: orgId,
      amount,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdByOfficer: OFFICER,
    })
    .returning({ id: paymentTokens.id });
  return row!.id;
}

/**
 * Build a PayMongo `…payment.paid` webhook body in the exact nested shape
 * `PayMongoAdapter.verifyWebhook` parses:
 *   data.id                                  → gatewayEventId
 *   data.attributes.type                     → event type
 *   data.attributes.data.attributes.status   → payment status (mapped: 'paid')
 *   data.attributes.data.attributes.amount   → centavos
 *   data.attributes.data.attributes.currency → currency
 *   data.attributes.data.attributes.metadata → { paymentId, paymentTokenId, … }
 */
function paidEventBody(opts: {
  eventId: string;
  sessionId?: string;
  amount: number;
  currency?: string;
  metadata: Record<string, string>;
  status?: string;
}): string {
  return JSON.stringify({
    data: {
      id: opts.eventId,
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          attributes: {
            status: opts.status ?? 'paid',
            amount: opts.amount,
            currency: opts.currency ?? 'PHP',
            checkout_session_id: opts.sessionId ?? 'cs_test',
            metadata: opts.metadata,
          },
        },
      },
    },
  });
}

/** Sign the body the way PayMongo does: `Paymongo-Signature: t=<ts>,te=<hmac>`. */
function signBody(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},te=${sig}`;
}

/** Minimal Hono-style ctx for the public webhook route (param + raw text + header). */
function webhookCtx(orgId: string, body: string, signature: string): any {
  const vars: Record<string, any> = {
    database: H.db,
    config: { auth: { secret: AUTH_SECRET } },
    logger: noopLogger,
    user: null,
    session: null,
  };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      param: (k: string) => (k === 'organizationId' ? orgId : ''),
      text: async () => body,
      header: (name: string) =>
        name?.toLowerCase() === 'paymongo-signature' ? signature : undefined,
    },
    json: (b: any, s: number) => ({ status: s, body: b }) as any,
  };
}

async function webhookLogCount(orgId: string): Promise<number> {
  const rows = await H.db.select().from(webhookRetryLogs).where(eq(webhookRetryLogs.organizationId, orgId));
  return rows.length;
}

describe('POST /webhooks/paymongo/:organizationId (per-org verify + validate + settle)', () => {
  test('settles a valid signed paid event and moves it into reports', async () => {
    if (!H.dbReachable) return;
    const ORG = crypto.randomUUID();
    const PERSON = crypto.randomUUID();
    await seedGateway(ORG);
    const tokenId = await seedToken(ORG, PERSON, 250000);
    const paymentId = await seedPayment(ORG, PERSON, { amount: 250000 });

    const body = paidEventBody({
      eventId: `evt_${crypto.randomUUID()}`,
      amount: 250000,
      currency: 'PHP',
      metadata: { paymentId, paymentTokenId: tokenId },
    });
    const res = await paymongoWebhook(webhookCtx(ORG, body, signBody(body, WEBHOOK_SECRET)));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('processed');

    const duesRepo = new DuesRepository(H.db as any);
    const payment = await duesRepo.getPayment(paymentId);
    expect(payment?.status).toBe('completed');
    expect(payment?.paidAt).toBeInstanceOf(Date);

    // Collected dues now show in the dashboard (regression for the lost-money bug).
    const stats = await duesRepo.getDashboardStats(ORG);
    expect(stats.totalCollected).toBe(250000);

    // The pay-link token is stamped used (markUsedCas inside the settle tx).
    const [tok] = await H.db.select().from(paymentTokens).where(eq(paymentTokens.id, tokenId));
    expect(tok!.usedAt).toBeInstanceOf(Date);
  });

  test('rejects a bad signature with 400 and changes no state', async () => {
    if (!H.dbReachable) return;
    const ORG = crypto.randomUUID();
    const PERSON = crypto.randomUUID();
    await seedGateway(ORG);
    const paymentId = await seedPayment(ORG, PERSON, { amount: 250000 });

    const body = paidEventBody({
      eventId: `evt_${crypto.randomUUID()}`,
      amount: 250000,
      metadata: { paymentId },
    });
    // Signed with the WRONG secret → HMAC mismatch → verifyWebhook returns null.
    const res = await paymongoWebhook(webhookCtx(ORG, body, signBody(body, 'wrong-secret')));

    expect(res.status).toBe(400);

    const payment = await new DuesRepository(H.db as any).getPayment(paymentId);
    expect(payment?.status).toBe('pending');
    // Claim happens only AFTER signature verification → no ledger row written.
    expect(await webhookLogCount(ORG)).toBe(0);
  });

  test('dedupes a redelivery via webhook_retry_log (exactly one settlement)', async () => {
    if (!H.dbReachable) return;
    const ORG = crypto.randomUUID();
    const PERSON = crypto.randomUUID();
    await seedGateway(ORG);
    const tokenId = await seedToken(ORG, PERSON, 250000);
    const paymentId = await seedPayment(ORG, PERSON, { amount: 250000 });

    const body = paidEventBody({
      eventId: `evt_${crypto.randomUUID()}`,
      amount: 250000,
      metadata: { paymentId, paymentTokenId: tokenId },
    });
    const sig = signBody(body, WEBHOOK_SECRET);

    const first = await paymongoWebhook(webhookCtx(ORG, body, sig));
    const second = await paymongoWebhook(webhookCtx(ORG, body, sig));

    expect(first.body.action).toBe('processed');
    expect(second.body.action).toBe('duplicate');

    // One ledger row, one completed payment, money counted once (not doubled).
    expect(await webhookLogCount(ORG)).toBe(1);
    const stats = await new DuesRepository(H.db as any).getDashboardStats(ORG);
    expect(stats.totalCollected).toBe(250000);
    expect(stats.completedCount).toBe(1);
  });

  test('returns 409 when the event amount does not match the recorded payment', async () => {
    if (!H.dbReachable) return;
    const ORG = crypto.randomUUID();
    const PERSON = crypto.randomUUID();
    await seedGateway(ORG);
    const paymentId = await seedPayment(ORG, PERSON, { amount: 250000 });

    const body = paidEventBody({
      eventId: `evt_${crypto.randomUUID()}`,
      amount: 999999, // != recorded 250000
      metadata: { paymentId },
    });
    const res = await paymongoWebhook(webhookCtx(ORG, body, signBody(body, WEBHOOK_SECRET)));

    expect(res.status).toBe(409);
    const payment = await new DuesRepository(H.db as any).getPayment(paymentId);
    expect(payment?.status).toBe('pending');
  });

  test('rejects an event for the wrong org (verified with org A secret, payment of org B)', async () => {
    if (!H.dbReachable) return;
    const ORG_A = crypto.randomUUID();
    const ORG_B = crypto.randomUUID();
    const PERSON = crypto.randomUUID();
    await seedGateway(ORG_A); // only A has a webhook secret
    const paymentB = await seedPayment(ORG_B, PERSON, { amount: 250000 });

    // Event routed to A, signed with A's secret, but points at B's payment.
    const body = paidEventBody({
      eventId: `evt_${crypto.randomUUID()}`,
      amount: 250000,
      metadata: { paymentId: paymentB },
    });
    const res = await paymongoWebhook(webhookCtx(ORG_A, body, signBody(body, WEBHOOK_SECRET)));

    expect(res.status).toBe(409);
    const payment = await new DuesRepository(H.db as any).getPayment(paymentB);
    expect(payment?.status).toBe('pending');
  });
});
