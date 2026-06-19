import type { Context } from 'hono';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { CommunicationsRepository } from './repos/communication.repo';
import type { Session } from '@/types/auth';

export async function getAnnouncementStats(ctx: Context): Promise<Response> {
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const id = ctx.req.param('id')!;
  const db = ctx.get('database');
  const repo = new CommunicationsRepository(db);

  const announcement = await repo.get(id);
  if (!announcement) throw new NotFoundError('Announcement');

  return ctx.json({ id: announcement.id, title: announcement.title, status: announcement.status, stats: announcement.stats }, 200);
}
