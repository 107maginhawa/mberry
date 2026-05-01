import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetCredentialTemplateParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { CredentialTemplateRepository } from './repos/credentials.repo';

/**
 * getCredentialTemplate
 *
 * Path: GET /association/member/credential-templates/{templateId}
 * OperationId: getCredentialTemplate
 */
export async function getCredentialTemplate(
  ctx: ValidatedContext<never, never, GetCredentialTemplateParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CredentialTemplateRepository(db, ctx.get('logger'));

  const template = await repo.findOneById((params as any).templateId);
  if (!template) throw new NotFoundError('Credential template');

  return ctx.json(template, 200);
}
