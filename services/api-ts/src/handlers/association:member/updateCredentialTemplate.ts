import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCredentialTemplateBody, UpdateCredentialTemplateParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { CredentialTemplateRepository } from './repos/credentials.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateCredentialTemplate
 *
 * Path: PATCH /association/member/credential-templates/{templateId}
 * OperationId: updateCredentialTemplate
 */
export async function updateCredentialTemplate(
  ctx: ValidatedContext<UpdateCredentialTemplateBody, never, UpdateCredentialTemplateParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { templateId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const orgId = ctx.get('organizationId') as string | undefined;
  const repo = new CredentialTemplateRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(templateId);
  if (!existing) throw new NotFoundError('Credential template');

  if (orgId && (existing as any).organizationId && (existing as any).organizationId !== orgId) {
    throw new ForbiddenError('Access denied to this credential template');
  }

  const updated = await repo.updateOneById(templateId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'credential-template',
    resourceId: templateId,
    description: `Credential template updated${orgId ? ` (org: ${orgId})` : ''}`,
  });

  return ctx.json(updated, 200);
}
