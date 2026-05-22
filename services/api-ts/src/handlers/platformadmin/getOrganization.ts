import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetOrganizationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { OrganizationRepository } from './repos/platform-admin.repo';

/**
 * getOrganization
 *
 * Path: GET /admin/organizations/{organizationId}
 * OperationId: getOrganization
 */
export async function getOrganization(
  ctx: ValidatedContext<never, never, GetOrganizationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { organizationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OrganizationRepository(db, logger);

  const org = await repo.findById(organizationId);
  if (!org) {
    throw new NotFoundError('Organization not found');
  }

  return ctx.json(org, 200);
}