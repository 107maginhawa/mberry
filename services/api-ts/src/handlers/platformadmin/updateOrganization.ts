import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateOrganizationBody, UpdateOrganizationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { requireAdminTier, SUPER_ONLY } from '@/core/auth/admin-tier';

/**
 * updateOrganization
 *
 * Path: PATCH /admin/organizations/{organizationId}
 * OperationId: updateOrganization
 */
export async function updateOrganization(
  ctx: ValidatedContext<UpdateOrganizationBody, never, UpdateOrganizationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  // FIX-008 (G1) / Q1: patching an organization is a super-only mutation.
  const denied = requireAdminTier(ctx, SUPER_ONLY);
  if (denied) return denied;

  const { organizationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OrganizationRepository(db, logger);

  const existing = await repo.findById(organizationId);
  if (!existing) {
    throw new NotFoundError('Organization not found');
  }

  const updated = await repo.update(organizationId, body);

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', `Organization "${existing.name}" updated`);

  return ctx.json(updated, 200);
}