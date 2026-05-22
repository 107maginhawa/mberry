import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteAssociationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { AssociationRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteAssociation
 *
 * Path: DELETE /admin/associations/{associationId}
 * OperationId: deleteAssociation
 */
export async function deleteAssociation(
  ctx: ValidatedContext<never, never, DeleteAssociationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { associationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AssociationRepository(db, logger);

  const existing = await repo.findById(associationId);
  if (!existing) {
    throw new NotFoundError('Association not found');
  }

  await repo.delete(associationId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'association',
    resourceId: associationId,
    description: `Association "${existing.name}" deleted`,
  });

  return ctx.body(null, 204);
}