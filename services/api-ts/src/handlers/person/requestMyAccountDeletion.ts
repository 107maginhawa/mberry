import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { PersonRepository } from './repos/person.repo';
import { auditAction } from '@/utils/audit';

/**
 * requestMyAccountDeletion
 *
 * Path: POST /delete
 * OperationId: requestMyAccountDeletion
 *
 * Marks the person record with a deletion request timestamp (BR-32 / DPA 2012).
 * Actual deletion is deferred and executed by a separate admin handler.
 */
export async function requestMyAccountDeletion(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(personId);
  if (!person) throw new UnauthorizedError();

  if (person.deletionRequestedAt) {
    throw new BusinessLogicError('Deletion already requested', 'DELETION_ALREADY_REQUESTED');
  }

  // Schedule deletion 30 days from now
  const now = new Date();
  const scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await repo.updateOneById(personId, {
    deletionRequestedAt: now,
    deletionScheduledAt: scheduledAt,
    updatedBy: personId,
  } as any);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'person',
    resourceId: personId,
    description: 'Account deletion requested',
    details: { scheduledAt: scheduledAt.toISOString() },
  });

  return ctx.json({
    message: 'Deletion request recorded. Your account will be deleted in 30 days.',
    requestedAt: now.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
  }, 202);
}
