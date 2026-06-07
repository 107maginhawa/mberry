import type { ValidatedContext } from '@/types/app';
import type { ProfessionalLicense } from '@/handlers/association:member/repos/credentials.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { UpdateProfessionalLicenseBody, UpdateProfessionalLicenseParams } from '@/generated/openapi/validators';
import { ProfessionalLicenseRepository } from '@/handlers/association:member/repos/credits.repo';

/**
 * updateProfessionalLicense
 *
 * Path: PATCH /association/member/licenses/{licenseId}
 * OperationId: updateProfessionalLicense
 */
export async function updateProfessionalLicense(
  ctx: ValidatedContext<UpdateProfessionalLicenseBody, never, UpdateProfessionalLicenseParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { licenseId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new ProfessionalLicenseRepository(db, logger);

  const existing = await repo.findOneById(licenseId);
  if (!existing) throw new NotFoundError('ProfessionalLicense');

  const updated = await repo.updateOneById(licenseId, body as Partial<ProfessionalLicense>);

  ctx.set('auditResourceId', licenseId);
  ctx.set('auditDescription', 'Professional license updated');

  return ctx.json(updated, 200);
}
