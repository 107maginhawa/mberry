import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { PersonRepository } from './repos/person.repo';
import { auditAction } from '@/utils/audit';

const GRACE_PERIOD_DAYS = 30;

/**
 * deleteMyAccount
 *
 * Path: DELETE /me
 * OperationId: deleteMyAccount
 *
 * User-initiated account deletion per BR-32 / DPA 2012.
 * Sets a 30-day grace period; actual PII anonymization + payment record
 * scrubbing is deferred to executeAccountDeletion after the grace period.
 * User can cancel during grace via cancelMyAccountDeletion.
 */
export async function deleteMyAccount(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(personId);
  if (!person) throw new UnauthorizedError();

  // Already completed — gone
  if (person.deletionCompletedAt) {
    return ctx.json({ error: 'Account already deleted' }, 410);
  }

  // Already requested — idempotent
  if (person.deletionRequestedAt) {
    return ctx.json({
      message: 'Deletion already requested.',
      requestedAt: person.deletionRequestedAt,
      scheduledAt: person.deletionScheduledAt,
    }, 200);
  }

  const now = new Date();
  const scheduledAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await repo.updateOneById(personId, {
    deletionRequestedAt: now,
    deletionScheduledAt: scheduledAt,
    updatedBy: personId,
  } as any);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'person',
    resourceId: personId,
    description: 'Account deletion initiated by user',
    details: { gracePeriodDays: GRACE_PERIOD_DAYS, scheduledAt: scheduledAt.toISOString() },
  });

  logger?.info({ personId, scheduledAt }, 'Account deletion initiated');

  return ctx.json({
    message: `Deletion scheduled. Your data will be anonymized after ${GRACE_PERIOD_DAYS} days.`,
    requestedAt: now.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
    gracePeriodDays: GRACE_PERIOD_DAYS,
  }, 202);
}
