import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ArchiveAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';

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

  // FIX-007 (tenant isolation): scope the fetch + write to the caller's org so an
  // officer of org A cannot archive org B's announcement by id.
  const orgId = ctx.get('organizationId');
  const existing = await repo.get(params.id, orgId);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'sent') {
    throw new BusinessLogicError('Only sent announcements can be archived', 'ANNOUNCEMENT_CANNOT_ARCHIVE');
  }

  const archived = await repo.updateStatus(params.id, 'archived', undefined, orgId);

  ctx.set('auditResourceId', params.id);
  ctx.set('auditDescription', `Archived announcement`);
  ctx.set('auditDetails', { transition: 'archived' });

  return ctx.json({ data: archived }, 200);
}
