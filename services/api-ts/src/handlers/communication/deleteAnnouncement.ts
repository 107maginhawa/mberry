import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteAnnouncement
 *
 * Path: DELETE /communications/announcements/{id}
 * OperationId: deleteAnnouncement
 */
export async function deleteAnnouncement(
  ctx: ValidatedContext<never, never, DeleteAnnouncementParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft announcements can be deleted', 'ANNOUNCEMENT_NOT_DRAFT');
  }

  await repo.delete(params.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'announcement',
    resourceId: params.id,
    description: `Deleted draft announcement`,
  });

  return ctx.json({ success: true }, 200);
}
