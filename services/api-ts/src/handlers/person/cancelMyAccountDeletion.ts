import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { PersonRepository } from './repos/person.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * cancelMyAccountDeletion
 *
 * Path: POST /cancel-delete
 * OperationId: cancelMyAccountDeletion
 */
export async function cancelMyAccountDeletion(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const repo = new PersonRepository(db, logger);

  const person = await repo.findOneById(personId);
  if (!person) throw new UnauthorizedError();

  if (!person.deletionRequestedAt) {
    throw new BusinessLogicError('No pending deletion request', 'NO_DELETION_REQUEST');
  }

  await repo.updateOneById(personId, {
    deletionRequestedAt: null,
    deletionScheduledAt: null,
    updatedBy: personId,
  } as Partial<typeof person>);

  ctx.set('auditResourceId', personId);
  ctx.set('auditDescription', 'Account deletion request cancelled');

  domainEvents.emit('person.deletion.cancelled', { personId }).catch(() => {});

  return ctx.json({ message: 'Deletion request cancelled.' }, 200);
}
