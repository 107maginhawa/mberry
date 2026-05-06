import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateMessageTemplateBody } from '@/generated/openapi/validators';
import { MessageTemplateRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * createMessageTemplate
 *
 * Path: POST /association/message-templates
 * OperationId: createMessageTemplate
 */
export async function createMessageTemplate(
  ctx: ValidatedContext<CreateMessageTemplateBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageTemplateRepository(db, logger);

  const template = await repo.create({
    organizationId: orgId,
    name: body.name,
    channel: body.channel,
    subject: body.subject ?? null,
    body: body.body,
    mergeFields: body.mergeFields,
    category: body.category,
    isTransactional: body.isTransactional,
    status: 'draft',
    createdBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'message-template',
    resourceId: template.id,
    description: `Message template "${body.name}" created`,
  });

  return ctx.json(template, 201);
}
