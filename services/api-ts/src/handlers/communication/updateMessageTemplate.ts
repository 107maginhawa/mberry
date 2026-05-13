import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateMessageTemplateBody, UpdateMessageTemplateParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { MessageTemplateRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateMessageTemplate
 *
 * Path: PATCH /association/message-templates/{templateId}
 * OperationId: updateMessageTemplate
 */
export async function updateMessageTemplate(
  ctx: ValidatedContext<UpdateMessageTemplateBody, never, UpdateMessageTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageTemplateRepository(db, logger);

  const existing = await repo.findById(params.templateId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Message template not found');
  }

  const updated = await repo.update(params.templateId, {
    ...body,
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'message-template',
    resourceId: params.templateId,
    description: `Message template "${existing.name}" updated`,
  });

  return ctx.json(updated, 200);
}
