/**
 * Postmark bounce/complaint webhook — auto-suppression (BR-55 / BR-56).
 *
 * Hand-wired route registered BEFORE auth middleware in app.ts (same pattern as
 * the Stripe webhook): a provider posts here unauthenticated-by-session, so it
 * lives outside the auth/CSRF stack and authenticates with a shared secret.
 *
 * BR-55 (hard-bounce auto-suppression) and BR-56 (complaint / CAN-SPAM
 * auto-suppression) were the THEN with no IF: `addSuppression` was only ever
 * called by the unsubscribe handler + tests, so a real provider hard-bounce or
 * spam complaint never suppressed anything. This is that missing trigger.
 *
 * Postmark's deliverability webhooks (Bounce, SpamComplaint) POST a single JSON
 * event. Suppression is org-scoped, but the provider event is account-global, so
 * we suppress the address in every org that has actually mailed it (resolved
 * from email_queue.recipient_email). addSuppression is idempotent, so a repeat
 * event for an already-suppressed address is a no-op.
 *
 * Auth: HTTP Basic (Postmark's native webhook auth — credentials embedded in the
 * configured webhook URL). The password component is compared timing-safely to
 * POSTMARK_WEBHOOK_SECRET. Missing/wrong secret → 401; secret not configured →
 * 503 (the webhook is disabled, mirroring the PayMongo pattern). Any accepted
 * event returns 200 so the provider does not retry.
 */
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { createHash, timingSafeEqual } from 'crypto';
import type { Variables } from '@/types/app';
import { SuppressionRepository } from './repos/suppression.repo';
import type { SuppressionReason } from './repos/suppression.schema';
import { emailQueue } from './repos/email.schema';

/** Postmark hard-bounce `Type`s that warrant permanent suppression (BR-55).
 * Soft/transient bounces (SoftBounce, Transient, DnsError, …) are NOT suppressed. */
const HARD_BOUNCE_TYPES = new Set(['HardBounce', 'BadEmailAddress']);

export interface ParsedSuppressionEvent {
  email: string;
  reason: SuppressionReason;
  /** human label for the suppression `notes` column. */
  label: string;
}

/**
 * Map a Postmark webhook event to a suppression intent, or null for events we
 * deliberately ignore (soft bounces, Delivery/Open/Click, malformed).
 */
export function parsePostmarkEvent(body: unknown): ParsedSuppressionEvent | null {
  if (!body || typeof body !== 'object') return null;
  const rec = body as Record<string, unknown>;

  const email = typeof rec['Email'] === 'string' ? rec['Email'].trim().toLowerCase() : '';
  if (!email) return null;

  const recordType = rec['RecordType'];
  if (recordType === 'SpamComplaint') {
    return { email, reason: 'complaint', label: 'SpamComplaint' };
  }
  if (recordType === 'Bounce') {
    const type = typeof rec['Type'] === 'string' ? rec['Type'] : '';
    if (HARD_BOUNCE_TYPES.has(type)) {
      return { email, reason: 'hard_bounce', label: `Bounce/${type}` };
    }
  }
  return null;
}

/**
 * Verify the HTTP Basic Authorization header's password equals the shared
 * secret, in constant time. Hashes both sides to a fixed 32-byte digest so the
 * comparison never leaks length and never throws on a length mismatch.
 */
export function verifyWebhookBasicAuth(authHeader: string | undefined, secret: string): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  // `user:pass` — the secret is the password; username is ignored.
  const idx = decoded.indexOf(':');
  const provided = idx >= 0 ? decoded.slice(idx + 1) : decoded;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function postmarkWebhookHandler(
  c: Context<{ Variables: Variables }>,
): Promise<Response> {
  const baseLogger = c.get('logger');
  const logger = baseLogger?.child?.({ module: 'email', action: 'postmarkWebhook' }) ?? baseLogger;
  const db = c.get('database');

  const secret = process.env['POSTMARK_WEBHOOK_SECRET'];
  if (!secret) {
    logger?.warn?.('Postmark webhook hit but POSTMARK_WEBHOOK_SECRET is not configured');
    return c.json({ error: 'Postmark webhook not configured' }, 503);
  }

  if (!verifyWebhookBasicAuth(c.req.header('authorization'), secret)) {
    logger?.warn?.('Postmark webhook rejected — bad or missing credentials');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const event = parsePostmarkEvent(body);
  if (!event) {
    // Soft bounce / Delivery / Open / Click / unparseable — accept without action
    // so Postmark does not retry.
    return c.json({ received: true, suppressed: 0 }, 200);
  }

  // Suppression is org-scoped; the provider event is account-global. Suppress in
  // every org that has actually mailed this address.
  const orgs = await db
    .selectDistinct({ organizationId: emailQueue.organizationId })
    .from(emailQueue)
    .where(eq(emailQueue.recipientEmail, event.email));

  const repo = new SuppressionRepository(db, logger);
  let suppressed = 0;
  for (const o of orgs) {
    // email_queue.organization_id is nullable; a null-org row can't be
    // org-scope-suppressed, so skip it rather than 500 on a NOT NULL violation.
    if (!o.organizationId) continue;
    await repo.addSuppression({
      orgId: o.organizationId,
      email: event.email,
      reason: event.reason,
      notes: `Postmark ${event.label}`,
    });
    suppressed++;
  }

  logger?.info?.(
    { email: event.email, reason: event.reason, orgsSuppressed: suppressed },
    'Postmark webhook suppression applied',
  );

  return c.json({ received: true, suppressed, reason: event.reason }, 200);
}
