import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateAssociationBody, UpdateAssociationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { AssociationRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateAssociation
 *
 * Path: PATCH /admin/associations/{associationId}
 * OperationId: updateAssociation
 */
export async function updateAssociation(
  ctx: ValidatedContext<UpdateAssociationBody, never, UpdateAssociationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { associationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AssociationRepository(db, logger);

  const existing = await repo.findById(associationId);
  if (!existing) {
    throw new NotFoundError('Association not found');
  }

  const updated = await repo.update(associationId, body);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'association',
    resourceId: associationId,
    description: `Association "${existing.name}" updated`,
  });

  return ctx.json(updated, 200);
}