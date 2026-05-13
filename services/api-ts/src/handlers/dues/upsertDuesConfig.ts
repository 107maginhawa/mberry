import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import type { Session } from '@/types/auth';

export async function upsertDuesConfig(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('duesConfigId');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const config = await repo.upsertConfig(orgId, {
    defaultAmount: body.defaultAmount,
    currency: body.currency ?? 'PHP',
    billingFrequency: body.billingFrequency ?? 'annual',
    dueDateMonth: body.dueDateMonth,
    dueDateDay: body.dueDateDay ?? 1,
    gracePeriodDays: body.gracePeriodDays ?? 30,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  if (body.categoryOverrides) {
    await repo.replaceCategoryOverrides(config.id, body.categoryOverrides, orgId);
  }

  if (body.reminderSchedules) {
    await repo.replaceReminderSchedules(config.id, body.reminderSchedules, orgId);
  }

  return ctx.json({ data: config }, 200);
}
