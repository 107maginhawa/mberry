import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteAssociationParams } from '@/generated/openapi/validators';
import { NotFoundError, ConflictError } from '@/core/errors';
import { AssociationRepository, OrganizationRepository } from './repos/platform-admin.repo';

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

  // [EM-M03-9a3e7b12] Only super admins can delete associations
  const callerAdmin = ctx.get('platformAdmin') as { role: string } | undefined;
  if (!callerAdmin || callerAdmin.role !== 'super') {
    return ctx.json({ error: 'Super admin access required' }, 403);
  }

  const { associationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AssociationRepository(db, logger);

  const existing = await repo.findById(associationId);
  if (!existing) {
    throw new NotFoundError('Association not found');
  }

  // Cannot delete an association that still owns organizations (API_CONTRACTS: 409).
  const orgRepo = new OrganizationRepository(db, logger);
  const orgs = await orgRepo.findByAssociation(associationId);
  if (orgs.length > 0) {
    throw new ConflictError(`Association has ${orgs.length} active organization(s) and cannot be deleted`);
  }

  await repo.delete(associationId);

  ctx.set('auditResourceId', associationId);
  ctx.set('auditDescription', `Association "${existing.name}" deleted`);

  return ctx.body(null, 204);
}