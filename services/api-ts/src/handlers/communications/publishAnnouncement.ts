import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { CommunicationsRepository } from './repos/communications.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { BaseContext } from '@/types/app';

export async function publishAnnouncement(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx as unknown as BaseContext, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database');
  const orgId = ctx.get('orgId') as string;
  const id = ctx.req.param('id');
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(id, orgId);
  if (!existing) throw new NotFoundError('Announcement not found');

  const updated = await repo.updateStatus(id, 'sent', { publishedAt: new Date() }, orgId);
  return ctx.json({ data: updated }, 200);
}
