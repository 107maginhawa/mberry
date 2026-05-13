import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function getDuesConfig(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('duesConfigId');
  const repo = new DuesRepository(db);

  const config = await repo.getConfig(orgId);
  if (!config) {
    return ctx.json({ data: null }, 200);
  }

  const overrides = await repo.getCategoryOverrides(config.id);
  const reminders = await repo.getReminderSchedules(config.id);

  return ctx.json({
    data: {
      ...config,
      categoryOverrides: overrides,
      reminderSchedules: reminders,
    },
  }, 200);
}
