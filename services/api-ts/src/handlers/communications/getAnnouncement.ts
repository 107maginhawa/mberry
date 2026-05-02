import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { CommunicationsRepository } from './repos/communications.repo';

export async function getAnnouncement(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new CommunicationsRepository(db);
  const announcement = await repo.get(id);
  if (!announcement) throw new NotFoundError('Announcement not found');
  return ctx.json({ data: announcement }, 200);
}
