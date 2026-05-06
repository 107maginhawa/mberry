import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { GetProfessionalLicenseParams } from '@/generated/openapi/validators';
import { ProfessionalLicenseRepository } from './repos/credits.repo';

/**
 * getProfessionalLicense
 *
 * Path: GET /association/member/licenses/{licenseId}
 * OperationId: getProfessionalLicense
 */
export async function getProfessionalLicense(
  ctx: ValidatedContext<never, never, GetProfessionalLicenseParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { licenseId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new ProfessionalLicenseRepository(db, logger);

  const license = await repo.findOneById(licenseId);
  if (!license) throw new NotFoundError('ProfessionalLicense');

  return ctx.json(license, 200);
}
