import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CancelEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRegistrationRepository, WaitlistEntryRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * cancelEventRegistration
 *
 * Path: POST /association/events/registrations/{registrationId}/cancel
 * OperationId: cancelEventRegistration
 */
export async function cancelEventRegistration(
  ctx: ValidatedContext<never, never, CancelEventRegistrationParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById((params as any).registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  if (existing.status === 'cancelled') {
    throw new BusinessLogicError('Registration is already cancelled', 'ALREADY_CANCELLED');
  }

  const cancelled = await repo.updateOneById((params as any).registrationId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  } as any);

  // [BR-27] Promote next waitlisted entry if a confirmed registration was cancelled
  if (existing.status === 'confirmed') {
    try {
      const waitlistRepo = new WaitlistEntryRepository(db, logger);
      const promoted = await waitlistRepo.promoteNext(existing.eventId);
      if (promoted) {
        await repo.createOne({
          eventId: existing.eventId,
          personId: (promoted as any).personId,
          organizationId: existing.organizationId,
          status: 'confirmed',
        } as any);
      }
    } catch (err) {
      logger?.warn({ error: err, eventId: existing.eventId }, 'Failed to promote waitlist entry after cancellation');
    }
  }

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event-registration',
    resourceId: cancelled.id,
    description: 'Event registration cancelled',
  });

  return ctx.json(cancelled, 200);
}
