import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateMessageBody } from '@/generated/openapi/validators';
import type { MessageRecipient } from './repos/communication.schema';
import { MessageRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * createMessage
 *
 * Path: POST /association/messages
 * OperationId: createMessage
 *
 * BR-28 deduplication: skips recipients who already received the same
 * channel message today (does not fail the whole message).
 */
export async function createMessage(
  ctx: ValidatedContext<CreateMessageBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  // BR-28: deduplicate recipients who already received same channel today
  const dedupedRecipients: MessageRecipient[] = [];
  for (const personId of body.recipientPersonIds) {
    const dup = await repo.findDuplicateSentToday(orgId, body.channel, personId);
    if (dup) {
      logger?.info({ personId, channel: body.channel }, 'BR-28: skipping duplicate recipient');
      continue;
    }
    dedupedRecipients.push({ personId, deliveryStatus: 'pending' });
  }

  const message = await repo.create({
    organizationId: orgId,
    templateId: body.templateId ?? null,
    channel: body.channel,
    senderId: body.senderId,
    recipients: dedupedRecipients,
    subject: body.subject ?? null,
    body: body.body,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as unknown as string) : null,
    status: body.scheduledAt ? 'scheduled' : 'draft',
    createdBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'message',
    resourceId: message.id,
    description: `Message created (${dedupedRecipients.length} recipients, ${body.recipientPersonIds.length - dedupedRecipients.length} deduplicated)`,
  });

  return ctx.json(message, 201);
}
