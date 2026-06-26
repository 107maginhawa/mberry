/**
 * paymongoWebhook — receive a PayMongo webhook for ONE org and reconcile the
 * matching payment. This is the settle side of the login-free pay-link money path.
 *
 * POST /webhooks/paymongo/{organizationId}
 * Auth: NONE (public; the signature is verified with the org's OWN webhook secret).
 *
 * Invariants:
 *   1. The signature is verified with THIS org's webhook secret — never a platform
 *      key. resolveWebhookAdapter builds an adapter from the per-org decrypted
 *      webhook secret; a bad/absent secret means we can't trust the event → reject.
 *   2. The event is validated against the recorded pending payment: same org (the
 *      URL org must own the payment), same amount, same currency. A
 *      misrouted/tampered event must never settle (409).
 *   3. Settlement is atomic + idempotent. We claim the event id in the unique
 *      `webhook_retry_log` ledger BEFORE settling (a redelivery conflicts → acked
 *      as a duplicate, never settled twice), and settleOnlinePayment itself
 *      short-circuits on an already-`completed` payment — so a double-settle is
 *      impossible from either direction.
 */

import type { ValidatedContext } from '@/types/app';
import type { PaymongoWebhookParams } from '@/generated/openapi/validators';
import type { Config } from '@/core/config';
import type { DatabaseInstance } from '@/core/database';
import { resolveWebhookAdapter } from '@/handlers/dues/utils/resolve-gateway';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { webhookRetryLogs } from '@/handlers/dues/repos/dues-payments.schema';

export async function paymongoWebhook(
  ctx: ValidatedContext<never, never, PaymongoWebhookParams>
): Promise<Response> {
  const orgId = ctx.req.param('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization is required' }, 400);

  const db = ctx.get('database') as DatabaseInstance;
  const config = ctx.get('config') as Config;
  const logger = ctx.get('logger');

  // Raw body is required for HMAC verification — read it verbatim, never re-encode.
  const body = await ctx.req.text();
  const signature = ctx.req.header('paymongo-signature') || '';

  // Per-org adapter built from the decrypted webhook secret. Null when the org has
  // no webhook secret registered yet → we cannot verify, so reject (400).
  const adapter = await resolveWebhookAdapter(db, orgId, config.auth.secret);
  if (!adapter) return ctx.json({ error: 'Payment gateway not configured' }, 400);

  const event = adapter.verifyWebhook(body, signature);
  if (!event) return ctx.json({ error: 'Invalid webhook signature' }, 400);
  // NOTE: bad signature / no adapter rejected ABOVE, OUTSIDE the transaction and
  // BEFORE any ledger write — an attacker cannot persist a dedupe row with unsigned
  // junk (that would let forged event ids suppress a later genuine redelivery).

  // ── One transaction for claim + settle (mirrors handleStripeWebhook FIX-WEBHOOK-IDEMP) ──
  // The dedupe-claim INSERT and ALL settlement side effects share ONE tx. A
  // deliberate rejection (duplicate / non-paid / tamper-409) RETURNS normally so
  // the tx commits and the claim sticks → the provider's redelivery is not
  // reprocessed. An unexpected throw mid-settle propagates OUT of the tx, rolling
  // the claim back WITH the side effects → the redelivery reprocesses cleanly
  // (closing the crash-between-commits reconcile hole where money sat pending
  // forever). settleOnlinePayment opens its own tx → nests as a SAVEPOINT here.
  const outcome = await db.transaction(async (tx: DatabaseInstance) => {
    // Durable idempotency: claim the event id in the unique webhook_retry_log
    // ledger BEFORE settling. A redelivery conflicts on the unique key → ack as a
    // duplicate and do NOT settle again. Tx-bound so the claim commits/rolls back
    // atomically with settlement.
    const claimed = await insertWebhookLogOnce(tx, {
      idempotencyKey: event.gatewayEventId,
      provider: 'paymongo',
      eventType: event.type,
      payload: safeParse(body),
      organizationId: orgId,
    });
    if (!claimed) return { action: 'duplicate' as const };

    // Only a paid/settled event moves money. Anything else is acked + noted.
    if (event.status !== 'paid') return { action: 'noted' as const };

    // The webhook settles by `paymentId` — the load-bearing metadata field set at checkout.
    const paymentId = event.metadata['paymentId'];
    if (!paymentId) return { action: 'ignored' as const };

    const duesRepo = new DuesRepository(tx);
    const payment = await duesRepo.getPayment(paymentId);
    if (!payment) return { action: 'unknown_payment' as const };

    // ── Inbound validation (B4): org + amount + currency must match the record ──
    // A deliberate rejection — RETURN (do not throw) so the claim COMMITS and a
    // forged event is not reprocessed on redelivery. Mirrors Stripe's split:
    // deliberate rejections commit, only unexpected crashes roll back.
    // The URL org must own the payment (a misrouted/cross-org event must not settle).
    if (payment.organizationId !== orgId) return { action: 'tamper' as const, error: 'Organization mismatch' };
    // Amount + currency are validated against the recorded dues_payment (which carries
    // both columns) — a tampered/incorrect event amount must never settle.
    if (event.amount !== payment.amount) return { action: 'tamper' as const, error: 'Amount mismatch' };
    if (event.currency !== payment.currency) return { action: 'tamper' as const, error: 'Currency mismatch' };

    // Atomic settle: payment pending→completed, invoice→paid (when present), pay-link
    // token stamped used (markUsedCas inside the tx). invoiceId derives from the
    // recorded payment, not caller input — a cross-invoice settle is impossible.
    const tokenId = event.metadata['paymentTokenId'] ?? '';
    const res = await duesRepo.settleOnlinePayment({
      paymentId,
      tokenId,
      invoiceId: payment.invoiceId,
      gatewayEventId: event.gatewayEventId,
      paidAt: new Date(),
    });
    // Invariant guard: a real settlement with no paymentTokenId means the pay-link
    // token was NOT burned (markUsedCas got '') → the paid link stays re-usable, a
    // latent double-charge break. Safe in practice (checkout always writes paymentId
    // AND paymentTokenId into the same metadata object) but must be observable.
    if (res.settled && !tokenId) {
      logger.warn(
        { action: 'paymongoWebhook.settledWithoutTokenId', paymentId, gatewayEventId: event.gatewayEventId },
        'Settled a PayMongo pay-link payment with no paymentTokenId in metadata — token not burned (link remains re-usable)',
      );
    }
    return { action: res.settled ? ('processed' as const) : ('already_settled' as const), paymentId };
  });

  // A tamper mismatch is a deliberate 409 (the claim already committed above).
  if (outcome.action === 'tamper') return ctx.json({ error: outcome.error }, 409);

  if (outcome.action === 'processed' || outcome.action === 'already_settled') {
    ctx.set('auditResourceId', outcome.paymentId);
    ctx.set('auditDescription', `Online payment via PayMongo: ${event.gatewayEventId}`);
  }
  return ctx.json({ received: true, action: outcome.action }, 200);
}

/**
 * Claim an event id in the unique `webhook_retry_log` ledger, returning false when
 * the id was already present (a redelivery). Lifts handleStripeWebhook's
 * onConflictDoNothing insert-once pattern: the unique `idempotency_key` constraint
 * serializes concurrent redeliveries at the DB, so exactly one caller wins.
 */
async function insertWebhookLogOnce(
  db: DatabaseInstance,
  values: {
    idempotencyKey: string;
    provider: string;
    eventType: string;
    payload: Record<string, unknown>;
    organizationId: string;
  },
): Promise<boolean> {
  const claimed = await db
    .insert(webhookRetryLogs)
    .values({ ...values, status: 'completed' })
    .onConflictDoNothing({ target: webhookRetryLogs.idempotencyKey })
    .returning({ id: webhookRetryLogs.id });
  return claimed.length > 0;
}

/** Parse the raw body for the audit ledger payload; never throw on a malformed body. */
function safeParse(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}
