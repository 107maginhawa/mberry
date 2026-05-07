import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateOrganizationProfileBody, UpdateOrganizationProfileParams } from '@/generated/openapi/validators';
import { eq } from 'drizzle-orm';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { auditAction } from '@/utils/audit';

/**
 * updateOrganizationProfile
 *
 * Path: PUT /association/member/org-profile/{organizationId}
 * OperationId: updateOrganizationProfile
 */
export async function updateOrganizationProfile(
  ctx: ValidatedContext<UpdateOrganizationProfileBody, never, UpdateOrganizationProfileParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const existing = await db.select().from(organizations).where(eq(organizations.id, params.organizationId));
  if (!existing.length) throw new NotFoundError('Organization');

  const updated = await db
    .update(organizations)
    .set({ ...body, updatedAt: new Date() } as any)
    .where(eq(organizations.id, params.organizationId))
    .returning();

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'organization-profile',
    resourceId: params.organizationId,
    description: 'Organization profile updated',
  });

  return ctx.json(updated[0], 200);
}