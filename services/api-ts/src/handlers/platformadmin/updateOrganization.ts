import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateOrganizationBody, UpdateOrganizationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { OrganizationRepository } from './repos/platform-admin.repo';

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