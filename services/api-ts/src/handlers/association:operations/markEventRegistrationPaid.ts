import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ValidationError, ConflictError } from '@/core/errors';
import type { MarkEventRegistrationPaidParams } from '@/generated/openapi/validators';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';

/**
 * markEventRegistrationPaid
 *
 * Path: POST /association/events/registrations/{registrationId}/mark-paid
 * OperationId: markEventRegistrationPaid
 *
 * Walk-up cash collected at the door: an officer marks a paid-event registration paid by stamping
 * paid_at (the same signal the PayMongo/Stripe webhook sets). The cash trail is the audit event —
 * there is no per-registration payment-method column (BR-EVT-CASH-5).
 *
 * Money-path guards (BR-EVT-CASH-1..4):
 *  - officer of the OWNING org only (org mismatch → 404, never leak a cross-org registration);
 *  - paid events only (registrationFee > 0 → 400);
 *  - terminal registrations (cancelled/refunded) cannot be marked paid (→ 409);
 *  - idempotent: a second call returns the already-paid row without re-stamping (double-tap safe).
 */
export async function markEventRegistrationPaid(
  ctx: ValidatedContext<never, never, MarkEventRegistrationPaidParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const regRepo = new EventRegistrationRepository(db, logger);

  const reg = await regRepo.findOneById(params.registrationId);
  // A cross-org registration is reported as not-found so existence never leaks across tenants.
  if (!reg || reg.organizationId !== orgId) throw new NotFoundError('Event registration not found');

  if (reg.status === 'cancelled' || reg.status === 'refunded') {
    throw new ConflictError('Cannot mark a cancelled or refunded registration as paid');
  }

  // Already paid (online webhook or a prior cash mark) → idempotent no-op, return the row.
  if (reg.paidAt) {
    ctx.set('auditResourceId', reg.id);
    ctx.set('auditDescription', 'Event registration already paid (no-op)');
    return ctx.json(reg, 200);
  }

  const event = await new EventRepository(db, logger).findOneById(reg.eventId);
  if (!event) throw new NotFoundError('Event not found');
  if (Number(event.registrationFee ?? 0) <= 0) {
    throw new ValidationError('Cannot record a payment for a free event');
  }

  const updated = await regRepo.updateOneById(params.registrationId, {
    paidAt: new Date(),
    updatedBy: user.id,
  });

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Event registration marked paid (walk-up cash)');

  return ctx.json(updated, 200);
}
