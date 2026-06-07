import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDunningTemplateParams } from '@/generated/openapi/validators';
import { DunningTemplateRepository } from '@/handlers/association:member/repos/dunning.repo';

/**
 * getDunningTemplate
 *
 * Path: GET /association/member/dunning/templates/{templateId}
 * OperationId: getDunningTemplate
 */
export async function getDunningTemplate(
  ctx: ValidatedContext<never, never, GetDunningTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DunningTemplateRepository(db, logger);

  const template = await repo.findOneById(params.templateId);
  if (!template) {
    return ctx.json({ error: 'Dunning template not found' }, 404);
  }

  // Ensure template belongs to the caller's organization
  if (template.organizationId !== orgId) {
    return ctx.json({ error: 'Dunning template not found' }, 404);
  }

  return ctx.json(template, 200);
}
