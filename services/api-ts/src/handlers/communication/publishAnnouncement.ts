import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { PublishAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from '../communications/repos/communications.repo';
import { auditAction } from '@/utils/audit';

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
  });

  return ctx.json({ data: published }, 200);
}
