/**
 * checkoutPaymentToken — initiate a PayMongo checkout for a one-tap dues link.
 *
 * POST /pay/:token/checkout
 * Auth: NONE (public endpoint — the member taps the link from email/SMS).
 *
 * This is the core money path. It must hold two invariants under a login-free,
 * double-tappable page:
 *   1. EXACTLY ONE PayMongo checkout session per token (no double charge), even
 *      when two taps race — enforced by an atomic claim-then-call mutex.
 *   2. A PayMongo failure leaves the token ACTIVE and retryable (the lease is
 *      released; the next tap re-wins).
 *
 * Flow (claim-then-call):
 *   token gate (invalid 400 / revoked 410 / used 409 / expired 410)
 *   → resolve the org's OWN PayMongo adapter (not configured → 400 via middleware)
 *   → reuse a live session, or remint if PayMongo expired it
 *   → claimForCheckout (atomic single-winner mutex, mints a per-attempt idem key)
 *      · winner: create the pending ledger row → createCheckout → attachSession → 200
 *      · loser : briefly wait for the winner's session, return the SAME url (200) or 202
 *   → on a PayMongo error: clearCheckoutClaim (retryable) → 502
 *
 * `usedAt` is NOT set here — it is stamped (CAS) only when the webhook settles a
 * real payment, so a started-but-unpaid checkout never burns the link.
 */

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { Config } from '@/core/config';
import type { DatabaseInstance } from '@/core/database';
import type { GatewayAdapter } from '@/handlers/association:member/utils/gateway-adapter';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import type { PaymentToken } from '@/handlers/dues/repos/payment-token.schema';
import { DuesRepository } from '@/handlers/dues/repos/dues-payments.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { resolveCheckoutAdapter } from '@/handlers/dues/utils/resolve-gateway';
import { formatReceiptNumber } from '@/handlers/association:member/utils/receipt-number';
import {
  hashPaymentToken,
  isPaymentTokenExpired,
  getPaymentTokenSecret,
} from './utils/payment-token';

export async function checkoutPaymentToken(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const rawToken = ctx.req.param('token');
  if (!rawToken) {
    return ctx.json({ error: 'Token is required' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const config = ctx.get('config') as Config;
  const logger = ctx.get('logger');
  const tokenRepo = new PaymentTokenRepository(db);
  const tokenHash = hashPaymentToken(rawToken, getPaymentTokenSecret());
  const token = await tokenRepo.findByTokenHash(tokenHash);

  // ── Token gate ────────────────────────────────────────────────────────────
  if (!token) {
    return ctx.json({ error: 'Payment link is invalid or has been revoked' }, 400);
  }
  if (token.revokedAt) {
    return ctx.json({ error: 'This payment link was revoked' }, 410);
  }
  if (token.usedAt) {
    return ctx.json({ error: 'This payment has already been processed' }, 409);
  }
  if (isPaymentTokenExpired(token.expiresAt)) {
    return ctx.json({ error: 'This payment link has expired. Please request a new one.' }, 410);
  }

  // Per-org PayMongo adapter. Throws GatewayNotConfiguredError (AppError 400) when
  // the org has no connected account — let it propagate to the error middleware.
  const adapter = await resolveCheckoutAdapter(db, token.organizationId, config.auth.secret);

  // ── Reuse an existing live session (idempotent re-tap); remint if expired ──
  if (token.paymongoSessionId) {
    const status = await adapter.getPaymentStatus(token.paymongoSessionId);
    if (status.status === 'expired' || status.status === 'failed') {
      // Release the dead session so the claim below can mint a fresh one. No-op
      // unless this exact session is still attached (guards a newer attempt).
      await tokenRepo.releaseExpiredSession(token.id, token.paymongoSessionId);
    } else if (status.checkoutUrl) {
      return ctx.json({ checkoutUrl: status.checkoutUrl }, 200);
    } else {
      // Session live but PayMongo gave us no url — treat as starting; client retries.
      return ctx.json({ checkoutUrl: '' }, 202);
    }
  }

  // ── Single-winner claim mutex ──────────────────────────────────────────────
  const idemKey = randomUUID();
  const claimed = await tokenRepo.claimForCheckout(token.id, idemKey);
  if (!claimed) {
    // Lost the race: another tap holds the lease (or already attached a session).
    // Wait briefly for its session so this tap lands on the SAME checkout url.
    const sharedUrl = await waitForSessionUrl(tokenRepo, adapter, tokenHash);
    if (sharedUrl) return ctx.json({ checkoutUrl: sharedUrl }, 200);
    // Still no session within the window → tell the client to retry shortly.
    return ctx.json({ checkoutUrl: '' }, 202);
  }

  // ── Winner: create the pending ledger row, then the PayMongo session ───────
  // The ledger row is created BEFORE the checkout so the webhook can settle the
  // exact payment by `metadata.paymentId`. Only the claim winner reaches here, so
  // there is no double ledger row / double receipt sequence under a double-tap.
  const pending = await createPendingPayment(db, token);
  try {
    const publicUrl = process.env['SERVER_PUBLIC_URL'] || process.env['PUBLIC_URL'] || 'http://localhost:3004';
    const result = await adapter.createCheckout(
      {
        amount: token.amount,
        currency: token.currency,
        description: `Dues payment - ${token.currency} ${(token.amount / 100).toFixed(2)}`,
        email: await resolveMemberEmail(db, token.personId),
        successUrl: `${publicUrl}/pay/${rawToken}?status=success`,
        cancelUrl: `${publicUrl}/pay/${rawToken}?status=cancelled`,
        metadata: {
          // The webhook settles by `paymentId` — this is the load-bearing field.
          paymentId: pending.id,
          paymentTokenId: token.id,
          personId: token.personId,
          // Both orgId and organizationId for webhook compatibility (it reads either).
          orgId: token.organizationId,
          organizationId: token.organizationId,
          invoiceId: token.invoiceId || '',
        },
      },
      // Per-attempt PayMongo Idempotency-Key: if the response is lost and we
      // retry the SAME attempt, PayMongo returns the same session, not a new one.
      claimed.idempotencyKey ?? idemKey,
    );

    await tokenRepo.attachSession(token.id, result.sessionId);
    return ctx.json({ checkoutUrl: result.checkoutUrl }, 200);
  } catch (err) {
    // Money-path observability: the underlying PayMongo failure is otherwise
    // swallowed by the blanket 502 below — log it before mapping the response.
    logger.error(
      {
        action: 'checkoutPaymentToken.paymongoFailed',
        tokenId: token.id,
        organizationId: token.organizationId,
        error: err instanceof Error ? err.message : String(err),
      },
      'PayMongo checkout creation failed — returning 502 and releasing the claim',
    );
    // PayMongo failed: release the lease so the token stays active and the next
    // tap re-wins (retryable). The pending ledger row is a harmless unpaid orphan
    // — the accepted-residual (duplicate-unpaid-session) note in the spec; it is
    // never settled because no session is attached, and `usedAt` is never set.
    await tokenRepo.clearCheckoutClaim(token.id);
    return ctx.json({ error: 'Failed to create checkout session. Please try again.' }, 502);
  }
}

/**
 * Loser re-tap: poll briefly for the claim winner's session so a double-tap
 * returns the SAME checkout url instead of a bare 202. Bounded so a stranded
 * claim (winner 502'd → claim cleared, no session) returns null promptly and the
 * caller falls back to 202 (the next tap then re-wins the claim).
 */
async function waitForSessionUrl(
  tokenRepo: PaymentTokenRepository,
  adapter: GatewayAdapter,
  tokenHash: string,
  deadlineMs = 1500,
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    const fresh = await tokenRepo.findByTokenHash(tokenHash);
    if (fresh?.paymongoSessionId) {
      const status = await adapter.getPaymentStatus(fresh.paymongoSessionId);
      if (status.checkoutUrl) return status.checkoutUrl;
    }
    // Winner released its lease without attaching a session (it failed) → give up.
    if (fresh && !fresh.paymongoSessionId && !fresh.checkoutStartedAt) return null;
    await new Promise((r) => setTimeout(r, 40));
  }
  return null;
}

/**
 * Create the pending `dues_payment` ledger row for an online checkout (carried
 * into PayMongo metadata as `paymentId`). Mirrors the prior FIX-001 block: an
 * atomic per-org receipt sequence + a `pending` row the webhook later settles.
 */
async function createPendingPayment(db: DatabaseInstance, token: PaymentToken) {
  const duesRepo = new DuesRepository(db);
  const year = new Date().getFullYear();
  const orgPrefix = await duesRepo.getOrgReceiptPrefix(token.organizationId);
  const sequence = await duesRepo.getNextReceiptSequence(token.organizationId, year);
  const receiptNumber = formatReceiptNumber(orgPrefix, year, sequence);

  return duesRepo.createPayment({
    organizationId: token.organizationId,
    personId: token.personId,
    invoiceId: token.invoiceId || null,
    receiptNumber,
    amount: token.amount,
    currency: token.currency,
    paymentMethod: 'online',
    status: 'pending',
    recordedBy: token.personId,
    paidAt: null as unknown as Date,
    createdBy: token.personId,
    updatedBy: token.personId,
  });
}

/** Resolve the member's receipt email from `person.contact_info` (best-effort). */
async function resolveMemberEmail(db: DatabaseInstance, personId: string): Promise<string> {
  const [row] = await db
    .select({ contactInfo: persons.contactInfo })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  return row?.contactInfo?.email ?? '';
}
