import type { Context } from 'hono';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { CommunicationsRepository } from './repos/communication.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { auditAction } from '@/utils/audit';
import type { Session } from '@/types/auth';

export async function scheduleAnnouncement(ctx: Context): Promise<Response> {
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;

  const id = ctx.req.param('id')!;
  const body = await ctx.req.json();

  const db = ctx.get('database');
  const repo = new CommunicationsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Announcement');

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft announcements can be scheduled', 'ANNOUNCEMENT_NOT_DRAFT');
  }

  const scheduledAt = new Date(body.scheduledAt);
  if (scheduledAt <= new Date()) {
    throw new BusinessLogicError('Scheduled time must be in the future', 'SCHEDULE_IN_PAST');
  }

  const updated = await repo.updateStatus(id, 'scheduled', { scheduledAt });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'announcement',
    resourceId: id,
    description: `Scheduled announcement for ${scheduledAt.toISOString()}`,
  });

  return ctx.json({ data: updated }, 200);
}
