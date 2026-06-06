import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SendMessageParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';
import { domainEvents } from '@/core/domain-events';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { eq, inArray, and } from 'drizzle-orm';
import type { MessageRecipient } from './repos/communication.schema';

/** Membership statuses that must not receive messages */
const SUPPRESSED_STATUSES = ['deceased', 'suspended', 'removed'] as const;

/**
 * sendMessage
 *
 * Path: POST /association/messages/{messageId}/send
 * OperationId: sendMessage
 *
 * Transitions message to 'sending', sets sentAt, then marks as 'sent'.
 * Filters out deceased/suspended/removed recipients before sending.
 */
export async function sendMessage(
  ctx: ValidatedContext<never, never, SendMessageParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  const existing = await repo.findById(params.messageId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Message not found');
  }

  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    throw new BusinessLogicError(
      `Cannot send a message with status "${existing.status}". Only draft or scheduled messages can be sent.`,
      'MESSAGE_CANNOT_SEND'
    );
  }

  // [EF-M07] Filter out deceased/suspended/removed recipients before sending
  const recipients = (existing.recipients ?? []) as MessageRecipient[];
  if (recipients.length > 0) {
    const personIds = recipients.map((r) => r.personId);
    const suppressedRows = await db
      .select({ personId: memberships.personId })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, orgId),
          inArray(memberships.personId, personIds),
          inArray(memberships.status, [...SUPPRESSED_STATUSES]),
        ),
      );
    const suppressedIds = new Set(suppressedRows.map((r) => r.personId));

    if (suppressedIds.size > 0) {
      const filtered = recipients.filter((r) => !suppressedIds.has(r.personId));
      if (filtered.length === 0) {
        throw new BusinessLogicError(
          'All recipients are deceased, suspended, or removed. Message cannot be sent.',
          'ALL_RECIPIENTS_SUPPRESSED'
        );
      }
      // Update message with filtered recipients
      await repo.update(params.messageId, {
        recipients: filtered,
        updatedBy: user.id,
      });
      logger?.info(
        { messageId: params.messageId, suppressed: suppressedIds.size, remaining: filtered.length },
        'Filtered suppressed recipients from message',
      );
    }
  }

  // Transition to 'sending'
  await repo.update(params.messageId, {
    status: 'sending',
    updatedBy: user.id,
  });

  // Mark as 'sent' with sentAt timestamp
  const updated = await repo.update(params.messageId, {
    status: 'sent',
    sentAt: new Date(),
    updatedBy: user.id,
  });

  await domainEvents.emit('message.sent', {
    messageId: params.messageId,
    organizationId: orgId,
    sentBy: user.id,
    channel: existing.channel,
    recipientCount: (updated?.recipients as MessageRecipient[] | null)?.length ?? 0,
  });

  ctx.set('auditResourceId', params.messageId);
  ctx.set('auditDescription', 'Message sent');

  return ctx.json(updated, 200);
}
