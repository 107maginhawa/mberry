import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateDunningTemplateBody } from '@/generated/openapi/validators';
import { DunningTemplateRepository } from '@/handlers/association:member/repos/dunning.repo';

/**
 * createDunningTemplate
 *
 * Path: POST /association/member/dunning/templates
 * OperationId: createDunningTemplate
 */
export async function createDunningTemplate(
  ctx: ValidatedContext<CreateDunningTemplateBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DunningTemplateRepository(db, logger);

  const template = await repo.createOne({
    organizationId: orgId,
    name: body.name,
    stage: body.stage,
    daysAfterDue: body.daysAfterDue,
    channel: body.channel,
    subject: body.subject ?? null,
    body: body.body,
    status: body.status ?? 'active',
    createdBy: user.id,
  });

  return ctx.json(template, 201);
}
