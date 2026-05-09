import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ArchiveAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

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

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status === 'archived') {
    throw new BusinessLogicError('Announcement is already archived', 'ANNOUNCEMENT_ALREADY_ARCHIVED');
  }

  const archived = await repo.updateStatus(params.id, 'archived');

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'announcement',
    resourceId: params.id,
    description: `Archived announcement`,
    details: { transition: 'archived' },
  });

  return ctx.json({ data: archived }, 200);
}
