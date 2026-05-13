import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDunningTemplateBody, UpdateDunningTemplateParams } from '@/generated/openapi/validators';
import { DunningTemplateRepository } from './repos/dunning.repo';

/**
 * updateDunningTemplate
 *
 * Path: PATCH /association/member/dunning/templates/{templateId}
 * OperationId: updateDunningTemplate
 */
export async function updateDunningTemplate(
  ctx: ValidatedContext<UpdateDunningTemplateBody, never, UpdateDunningTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DunningTemplateRepository(db, logger);

  const existing = await repo.findOneById(params.templateId);
  if (!existing || existing.organizationId !== orgId) {
    return ctx.json({ error: 'Dunning template not found' }, 404);
  }

  const b = body as any;
  const updateData: Record<string, any> = { updatedBy: user.id };
  if (b['name'] !== undefined) updateData['name'] = b['name'];
  if (b['daysAfterDue'] !== undefined) updateData['daysAfterDue'] = b['daysAfterDue'];
  if (b['channel'] !== undefined) updateData['channel'] = b['channel'];
  if (b['subject'] !== undefined) updateData['subject'] = b['subject'];
  if (b['body'] !== undefined) updateData['body'] = b['body'];
  if (b['status'] !== undefined) updateData['status'] = b['status'];

  const updated = await repo.updateOneById(params.templateId, updateData);

  return ctx.json(updated, 200);
}
