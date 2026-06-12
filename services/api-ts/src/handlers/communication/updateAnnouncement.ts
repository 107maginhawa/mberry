import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateAnnouncementBody, UpdateAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';

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

  // FIX-007 (tenant isolation): scope the fetch + write to the caller's org so an
  // officer of org A cannot update org B's announcement by id.
  const orgId = ctx.get('organizationId');
  const existing = await repo.get(params.id, orgId);
  if (!existing) throw new NotFoundError('Announcement');
  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft announcements can be updated', 'ANNOUNCEMENT_NOT_DRAFT');
  }

  const updated = await repo.update(params.id, body as Record<string, unknown>, orgId);

  ctx.set('auditResourceId', params.id);
  ctx.set('auditDescription', `Updated announcement`);
  ctx.set('auditDetails', { fields: Object.keys(body) });

  return ctx.json({ data: updated }, 200);
}
