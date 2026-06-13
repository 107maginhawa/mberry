import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ArchiveAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { requirePosition } from '@/core/auth/officer-checks';

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

  // Org context + authorization (CONTINUE-53). Id-only route, so resolve org
  // from the record (the :id path UUID would otherwise be mistaken for
  // organizationId by the org-context middleware) and gate on President/Secretary
  // in that org. Preserves tenant isolation: an officer of org A holds no term in
  // org B → requirePosition returns 403.
  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  ctx.set('organizationId', existing.organizationId);

  const denied = await requirePosition(ctx, ['President', 'Secretary']);
  if (denied) return denied;

  if (existing.status !== 'sent') {
    throw new BusinessLogicError('Only sent announcements can be archived', 'ANNOUNCEMENT_CANNOT_ARCHIVE');
  }

  const archived = await repo.updateStatus(params.id, 'archived', undefined, existing.organizationId);

  ctx.set('auditResourceId', params.id);
  ctx.set('auditDescription', `Archived announcement`);
  ctx.set('auditDetails', { transition: 'archived' });

  return ctx.json({ data: archived }, 200);
}
