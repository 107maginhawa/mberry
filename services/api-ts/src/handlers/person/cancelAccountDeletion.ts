/**
 * cancelAccountDeletion
 *
 * Cancels a pending account deletion during the 30-day grace period.
 *
 * Path: POST /persons/me/cancel-delete
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { PersonRepository } from './repos/person.repo';

export async function cancelAccountDeletion(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | null;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(user.id);
  if (!person) return ctx.json({ error: 'Person not found' }, 404);

  // Already executed — cannot undo
  if (person.deletionCompletedAt) {
    return ctx.json({ error: 'Deletion already completed — cannot cancel' }, 410);
  }

  // No deletion pending
  if (!person.deletionRequestedAt) {
    return ctx.json({ error: 'No deletion request pending' }, 400);
  }

  await repo.updateOneById(user.id, {
    deletionRequestedAt: null,
    deletionScheduledAt: null,
    updatedBy: user.id,
  });

  const audit = ctx.get('audit');
  if (audit) {
    try {
      await audit.logEvent({
        eventType: 'data-modification',
        category: 'privacy',
        action: 'delete-cancel',
        outcome: 'success',
        organizationId: ctx.get('organizationId'),
        user: user.id,
        userType: 'client' as const,
        resourceType: 'person',
        resource: user.id,
        description: 'Account deletion cancelled',
      });
    } catch (e) {
      logger?.error({ error: e }, 'Failed to log deletion cancel audit');
    }
  }

  logger?.info({ personId: user.id }, 'Account deletion cancelled');

  return ctx.json({ cancelled: true }, 200);
}
