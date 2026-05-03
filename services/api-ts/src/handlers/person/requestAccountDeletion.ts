/**
 * requestAccountDeletion
 *
 * Initiates account deletion with 30-day grace period per DPA 2012 / M-25.
 * No data is destroyed immediately — person can cancel during grace period.
 *
 * Path: POST /persons/me/delete
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { PersonRepository } from './repos/person.repo';

const GRACE_PERIOD_DAYS = 30;

export async function requestAccountDeletion(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | null;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(user.id);
  if (!person) return ctx.json({ error: 'Person not found' }, 404);

  // Already requested?
  if (person.deletionRequestedAt && !person.deletionCompletedAt) {
    return ctx.json({ error: 'Deletion already requested', deletionScheduledAt: person.deletionScheduledAt }, 409);
  }

  const now = new Date();
  const scheduledAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await repo.updateOneById(user.id, {
    deletionRequestedAt: now,
    deletionScheduledAt: scheduledAt,
    updatedBy: user.id,
  });

  // Audit
  const audit = ctx.get('audit');
  if (audit) {
    try {
      await audit.logEvent({
        eventType: 'data-modification',
        category: 'privacy',
        action: 'delete-request',
        outcome: 'success',
        user: user.id,
        userType: 'client' as const,
        resourceType: 'person',
        resource: user.id,
        description: 'Account deletion requested',
        details: { gracePeriodDays: GRACE_PERIOD_DAYS, scheduledAt: scheduledAt.toISOString() },
      });
    } catch (e) {
      logger?.error({ error: e }, 'Failed to log deletion request audit');
    }
  }

  logger?.info({ personId: user.id, scheduledAt }, 'Account deletion requested');

  return ctx.json({
    deletionScheduledAt: scheduledAt.toISOString(),
    gracePeriodDays: GRACE_PERIOD_DAYS,
  }, 200);
}
