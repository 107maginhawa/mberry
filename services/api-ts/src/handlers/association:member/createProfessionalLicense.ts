import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateProfessionalLicenseBody } from '@/generated/openapi/validators';
import { ProfessionalLicenseRepository } from './repos/credits.repo';
import { auditAction } from '@/utils/audit';

/**
 * createProfessionalLicense
 *
 * Path: POST /association/member/licenses
 * OperationId: createProfessionalLicense
 */
export async function createProfessionalLicense(
  ctx: ValidatedContext<CreateProfessionalLicenseBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new ProfessionalLicenseRepository(db, logger);

  const license = await repo.createOne({
    tenantId,
    personId: body.personId,
    licenseType: body.licenseType,
    licenseNumber: body.licenseNumber,
    issuingAuthority: body.issuingAuthority,
    jurisdiction: body.jurisdiction,
    issuedDate: body.issuedDate,
    expirationDate: body.expirationDate,
    status: body.status,
    documentRef: body.documentRef,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'professional-license',
    resourceId: license.id,
    description: 'Professional license created',
  });

  return ctx.json(license, 201);
}
