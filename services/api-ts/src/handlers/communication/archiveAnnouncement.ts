import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ArchiveAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * archiveAnnouncement
 *
 * Path: POST /communications/announcements/{id}/archive
 * OperationId: archiveAnnouncement
 */
export async function archiveAnnouncement(
  ctx: ValidatedContext<never, never, ArchiveAnnouncementParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // M7: Only president/secretary can archive announcements
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'sent') {
    throw new BusinessLogicError('Only sent announcements can be archived', 'ANNOUNCEMENT_CANNOT_ARCHIVE');
  }

  const archived = await repo.updateStatus(params.id, 'archived');

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'announcement',
    resourceId: params.id,
    description: `Archived announcement`,
    details: { transition: 'archived' },
    eventSubType: 'content.announcement-archived',
  });

  return ctx.json({ data: archived }, 200);
}
