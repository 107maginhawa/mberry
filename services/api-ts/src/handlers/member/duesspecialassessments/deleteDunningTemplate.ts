import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteDunningTemplateParams } from '@/generated/openapi/validators';
import { DunningTemplateRepository } from '@/handlers/association:member/repos/dunning.repo';

/**
 * deleteDunningTemplate
 *
 * Path: DELETE /association/member/dunning/templates/{templateId}
 * OperationId: deleteDunningTemplate
 */
export async function deleteDunningTemplate(
  ctx: ValidatedContext<never, never, DeleteDunningTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DunningTemplateRepository(db, logger);

  const existing = await repo.findOneById(params.templateId);
  if (!existing || existing.organizationId !== orgId) {
    return ctx.json({ error: 'Dunning template not found' }, 404);
  }

  await repo.deleteOneById(params.templateId, user.id);

  return ctx.body(null, 204);
}
