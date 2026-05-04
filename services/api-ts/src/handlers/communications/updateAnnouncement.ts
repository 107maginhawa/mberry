import type { Context } from 'hono';
import { CommunicationsRepository } from './repos/communications.repo';
import { ForbiddenError, NotFoundError } from '@/core/errors';

export async function updateAnnouncement(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const body: any = await ctx.req.json();
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Announcement not found');
  if (existing.status !== 'draft') throw new ForbiddenError('Only draft announcements can be edited');

  const updated = await repo.update(id, {
    title: body.title ?? existing.title,
    content: body.content ?? existing.content,
    audienceType: body.audienceType ?? existing.audienceType,
    channelPush: body.channelPush ?? existing.channelPush,
    channelEmail: body.channelEmail ?? existing.channelEmail,
    visibility: body.visibility ?? existing.visibility,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : existing.scheduledAt,
  });

  return ctx.json({ data: updated }, 200);
}
