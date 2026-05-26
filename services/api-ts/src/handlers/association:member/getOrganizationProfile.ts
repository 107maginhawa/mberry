import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { GetOrganizationProfileParams } from '@/generated/openapi/validators';
import { eq } from 'drizzle-orm';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

/**
 * getOrganizationProfile
 *
 * Path: GET /association/member/org-profile/{organizationId}
 * OperationId: getOrganizationProfile
 */
export async function getOrganizationProfile(
  ctx: ValidatedContext<never, never, GetOrganizationProfileParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const rows = await db.select().from(organizations).where(eq(organizations.id, params.organizationId)).limit(1);
  if (!rows.length) throw new NotFoundError('Organization');

  return ctx.json(rows[0], 200);
}