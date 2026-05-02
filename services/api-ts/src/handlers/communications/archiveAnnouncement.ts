import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { CommunicationsRepository } from './repos/communications.repo';

export async function archiveAnnouncement(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Announcement not found');

  const updated = await repo.updateStatus(id, 'archived');
  return ctx.json({ data: updated }, 200);
}
