import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetMessageTemplateParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { MessageTemplateRepository } from './repos/communication.repo';

/**
 * getMessageTemplate
 *
 * Path: GET /association/message-templates/{templateId}
 * OperationId: getMessageTemplate
 */
export async function getMessageTemplate(
  ctx: ValidatedContext<never, never, GetMessageTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageTemplateRepository(db, logger);

  const template = await repo.findById(params.templateId);
  if (!template || template.organizationId !== orgId) {
    throw new NotFoundError('Message template not found');
  }

  return ctx.json(template, 200);
}
