import type { Context } from 'hono';
import { CommunicationsRepository } from './repos/communications.repo';
import { ForbiddenError, NotFoundError } from '@/core/errors';

export async function deleteAnnouncement(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Announcement not found');
  if (existing.status !== 'draft') throw new ForbiddenError('Only draft announcements can be deleted');

  await repo.delete(id);
  return new Response(null, { status: 204 });
}
