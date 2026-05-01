import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetAssociationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { AssociationRepository } from './repos/platform-admin.repo';

/**
 * getAssociation
 *
 * Path: GET /admin/associations/{associationId}
 * OperationId: getAssociation
 */
export async function getAssociation(
  ctx: ValidatedContext<never, never, GetAssociationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { associationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AssociationRepository(db, logger);

  const association = await repo.findById(associationId);
  if (!association) {
    throw new NotFoundError('Association not found');
  }

  return ctx.json(association, 200);
}