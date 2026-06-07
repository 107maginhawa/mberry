import type { ValidatedContext } from '@/types/app';
import type { CredentialTemplate } from '@/handlers/association:member/repos/credentials.schema';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateCredentialTemplateBody, UpdateCredentialTemplateParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';

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

  const existingRecord = existing as Record<string, unknown>;
  if (orgId && existingRecord['organizationId'] && existingRecord['organizationId'] !== orgId) {
    throw new ForbiddenError('Access denied to this credential template');
  }

  const updated = await repo.updateOneById(templateId, body as Partial<CredentialTemplate>);

  ctx.set('auditResourceId', templateId);
  ctx.set('auditDescription', `Credential template updated${orgId ? ` (org: ${orgId})` : ''}`);

  return ctx.json(updated, 200);
}
