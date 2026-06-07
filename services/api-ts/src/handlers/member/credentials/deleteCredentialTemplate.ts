import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteCredentialTemplateParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';

/**
 * deleteCredentialTemplate
 *
 * Path: DELETE /association/member/credential-templates/{templateId}
 * OperationId: deleteCredentialTemplate
 */
export async function deleteCredentialTemplate(
  ctx: ValidatedContext<never, never, DeleteCredentialTemplateParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { templateId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CredentialTemplateRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(templateId);
  if (!existing) throw new NotFoundError('Credential template');

  await repo.deleteOneById(templateId);

  ctx.set('auditResourceId', templateId);
  ctx.set('auditDescription', 'Credential template deleted');

  return ctx.body(null, 204);
}
