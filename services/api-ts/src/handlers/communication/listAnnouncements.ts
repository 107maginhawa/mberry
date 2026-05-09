import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ListAnnouncementsQuery, ListAnnouncementsParams } from '@/generated/openapi/validators';
import { CommunicationsRepository } from './repos/communication.repo';

/**
 * listAnnouncements
 *
 * Path: GET /communications/announcements/{orgId}
 * OperationId: listAnnouncements
 */
export async function listAnnouncements(
  ctx: ValidatedContext<never, ListAnnouncementsQuery, ListAnnouncementsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new CommunicationsRepository(db);

  const page = Number(query?.page ?? 1);
  const pageSize = Number(query?.pageSize ?? 20);
  const offset = (page - 1) * pageSize;

  const { data, total } = await repo.list(params.orgId, {
    status: query?.status as string | undefined,
    search: query?.search as string | undefined,
    limit: pageSize,
    offset,
  });

  return ctx.json({ data, total, page, pageSize }, 200);
}
