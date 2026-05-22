import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { DeleteProfessionalLicenseParams } from '@/generated/openapi/validators';
import { ProfessionalLicenseRepository } from './repos/credits.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteProfessionalLicense
 *
 * Path: DELETE /association/member/licenses/{licenseId}
 * OperationId: deleteProfessionalLicense
 */
export async function deleteProfessionalLicense(
  ctx: ValidatedContext<never, never, DeleteProfessionalLicenseParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { licenseId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new ProfessionalLicenseRepository(db, logger);

  const existing = await repo.findOneById(licenseId);
  if (!existing) throw new NotFoundError('ProfessionalLicense');

  await repo.deleteOneById(licenseId, user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'professional-license',
    resourceId: licenseId,
    description: 'Professional license deleted',
  });

  return new Response(null, { status: 204 });
}
