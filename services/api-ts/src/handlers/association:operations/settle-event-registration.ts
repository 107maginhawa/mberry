import type { DatabaseInstance } from '@/core/database';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';

export type SettleEventOutcome =
  | { action: 'processed' }
  | { action: 'ignored' }
  | { action: 'unknown_registration' }
  | { action: 'tamper'; error: string };

/**
 * Settle a paid-event registration from a verified PayMongo webhook (the money-critical seam,
 * extracted so it is unit-testable on real-PG the way the Stripe rail's createProcessPayment is).
 *
 * Invariants:
 *  - org must own the registration (a misrouted/cross-org event must never settle) → tamper.
 *  - the settled amount must equal the event fee (a tampered amount must never settle) → tamper.
 *  - idempotent: only stamps paid_at when null; a redelivery is also blocked by the webhook ledger.
 */
export async function settleEventRegistrationPayment(
  db: DatabaseInstance,
  args: { registrationId: string | undefined; orgId: string; amount: number; currency?: string },
): Promise<SettleEventOutcome> {
  if (!args.registrationId) return { action: 'ignored' };
  const regRepo = new EventRegistrationRepository(db);
  const reg = await regRepo.findOneById(args.registrationId);
  if (!reg) return { action: 'unknown_registration' };
  if (reg.organizationId !== args.orgId) return { action: 'tamper', error: 'Organization mismatch' };
  // The event MUST exist to validate the amount — a missing event must not bypass the check.
  const ev = await new EventRepository(db).findOneById(reg.eventId);
  if (!ev) return { action: 'unknown_registration' };
  if (Number(ev.registrationFee ?? 0) !== args.amount) return { action: 'tamper', error: 'Amount mismatch' };
  // Currency parity with the dues settle (per-org PayMongo is PHP, but match the invariant).
  if (args.currency != null && (ev.currency ?? 'PHP') !== args.currency) return { action: 'tamper', error: 'Currency mismatch' };
  if (!reg.paidAt) {
    await regRepo.updateOneById(args.registrationId, { paidAt: new Date(), updatedBy: reg.personId });
  }
  return { action: 'processed' };
}
