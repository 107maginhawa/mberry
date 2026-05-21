import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { PublishAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * publishAnnouncement
 *
 * Path: POST /communications/announcements/{id}/publish
 * OperationId: publishAnnouncement
 */
export async function publishAnnouncement(
  ctx: ValidatedContext<never, never, PublishAnnouncementParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // M7: Only president/secretary can publish announcements
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    throw new BusinessLogicError('Only draft or scheduled announcements can be published', 'ANNOUNCEMENT_CANNOT_PUBLISH');
  }

  const published = await repo.updateStatus(params.id, 'sent', {
    publishedAt: new Date(),
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'announcement',
    resourceId: params.id,
    description: `Published announcement`,
    details: { transition: 'published' },
    eventSubType: 'content.announcement-published',
  });

  return ctx.json({ data: published }, 200);
}
