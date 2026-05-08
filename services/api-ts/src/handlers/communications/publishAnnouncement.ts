import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { CommunicationsRepository } from './repos/communications.repo';
import { requireOfficerTerm } from '@/utils/officer-check';
import type { BaseContext } from '@/types/app';

export async function publishAnnouncement(ctx: Context): Promise<Response> {
  const denied = await requireOfficerTerm(ctx as unknown as BaseContext);
  if (denied) return denied;

  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Announcement not found');

  const updated = await repo.updateStatus(id, 'sent', { publishedAt: new Date() });
  return ctx.json({ data: updated }, 200);
}
