import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteAssociationParams } from '@/generated/openapi/validators';
import { NotFoundError, ConflictError } from '@/core/errors';
import { AssociationRepository, OrganizationRepository } from './repos/platform-admin.repo';
import { requireAdminTier, SUPER_ONLY } from '@/core/auth/admin-tier';

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

  // FIX-008 (G1) / Q1: deleting an association is a super-only mutation.
  const denied = requireAdminTier(ctx, SUPER_ONLY);
  if (denied) return denied;

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