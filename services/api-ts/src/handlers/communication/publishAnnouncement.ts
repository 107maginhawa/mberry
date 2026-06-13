import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { PublishAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { domainEvents } from '@/core/domain-events';

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

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  // FIX-007 (tenant isolation): scope the fetch to the caller's org so an officer
  // of org A cannot publish org B's announcement by id (the position gate resolves
  // org from the caller header, not the record).
  const orgId = ctx.get('organizationId');
  const existing = await repo.get(params.id, orgId);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    throw new BusinessLogicError('Only draft or scheduled announcements can be published', 'ANNOUNCEMENT_CANNOT_PUBLISH');
  }

  const published = await repo.updateStatus(params.id, 'sent', {
    publishedAt: new Date(),
  }, orgId);

  await domainEvents.emit('announcement.published', {
    announcementId: params.id,
    organizationId: orgId ?? '',
    publishedBy: session.user.id,
  });

  ctx.set('auditResourceId', params.id);
  ctx.set('auditDescription', `Published announcement`);
  ctx.set('auditDetails', { transition: 'published' });

  return ctx.json({ data: published }, 200);
}
