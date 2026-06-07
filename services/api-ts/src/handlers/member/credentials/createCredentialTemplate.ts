import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateCredentialTemplateBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';

/**
 * createCredentialTemplate
 *
 * Path: POST /association/member/credential-templates
 * OperationId: createCredentialTemplate
 */
export async function createCredentialTemplate(
  ctx: ValidatedContext<CreateCredentialTemplateBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CredentialTemplateRepository(db, logger);

  const template = await repo.createOne({
    organizationId: orgId,
    name: body.name,
    type: body.type,
    design: body.design ?? null,
    validityPeriod: body.validityPeriod ?? null,
    status: body.status ?? 'active',
  });

  ctx.set('auditResourceId', template.id);
  ctx.set('auditDescription', `Credential template "${body.name}" created`);

  return ctx.json(template, 201);
}
