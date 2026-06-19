import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { GetAnnouncementParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';

/**
 * getAnnouncement
 *
 * Path: GET /communications/announcements/detail/{id}
 * OperationId: getAnnouncement
 */
export async function getAnnouncement(
  ctx: ValidatedContext<never, never, GetAnnouncementParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const announcement = await repo.get(params.id);
  if (!announcement) throw new NotFoundError('Announcement');

  return ctx.json(announcement, 200);
}
