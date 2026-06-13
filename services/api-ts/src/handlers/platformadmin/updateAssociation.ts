import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateAssociationBody, UpdateAssociationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { AssociationRepository } from './repos/platform-admin.repo';
import { requireAdminTier, SUPER_ONLY } from '@/core/auth/admin-tier';

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

  // FIX-008 (G1) / Q1: patching an association is a super-only mutation.
  const denied = requireAdminTier(ctx, SUPER_ONLY);
  if (denied) return denied;

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

  ctx.set('auditResourceId', associationId);
  ctx.set('auditDescription', `Association "${existing.name}" updated`);

  return ctx.json(updated, 200);
}