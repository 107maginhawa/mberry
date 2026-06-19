import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { PublishAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { requirePosition } from '@/core/auth/officer-checks';
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

  // Org context + authorization (CONTINUE-53). This route is id-only
  // (/communications/announcements/:id/publish) so the org-context middleware's
  // UUID-from-path fallback mistakes the announcement :id for organizationId and
  // the x-require-position path-mode gate can't resolve the real org. Resolve org
  // from the record, then enforce the President/Secretary gate against THAT org
  // (mirrors the governance handlers). This also preserves tenant isolation: an
  // officer of org A holds no term in org B, so requirePosition returns 403.
  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  ctx.set('organizationId', existing.organizationId);

  const denied = await requirePosition(ctx, ['President', 'Secretary']);
  if (denied) return denied;

  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    throw new BusinessLogicError('Only draft or scheduled announcements can be published', 'ANNOUNCEMENT_CANNOT_PUBLISH');
  }

  const orgId = existing.organizationId;
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

  return ctx.json(published, 200);
}
