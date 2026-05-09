import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateAnnouncementBody, UpdateAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateAnnouncement
 *
 * Path: PATCH /communications/announcements/{id}
 * OperationId: updateAnnouncement
 */
export async function updateAnnouncement(
  ctx: ValidatedContext<UpdateAnnouncementBody, never, UpdateAnnouncementParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(params.id);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft announcements can be updated', 'ANNOUNCEMENT_NOT_DRAFT');
  }

  const updated = await repo.update(params.id, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'announcement',
    resourceId: params.id,
    description: `Updated announcement`,
    details: { fields: Object.keys(body) },
  });

  return ctx.json({ data: updated }, 200);
}
