import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteMessageTemplateParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { MessageTemplateRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteMessageTemplate
 *
 * Path: DELETE /association/message-templates/{templateId}
 * OperationId: deleteMessageTemplate
 */
export async function deleteMessageTemplate(
  ctx: ValidatedContext<never, never, DeleteMessageTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageTemplateRepository(db, logger);

  const existing = await repo.findById(params.templateId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Message template not found');
  }

  await repo.delete(params.templateId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'message-template',
    resourceId: params.templateId,
    description: `Message template "${existing.name}" deleted`,
  });

  return ctx.body(null, 204);
}
