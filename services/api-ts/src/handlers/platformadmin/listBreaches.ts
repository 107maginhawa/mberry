/**
 * listBreaches
 *
 * Path: GET /admin/breaches
 * Lists all breach incidents ordered by createdAt desc, with urgency colour.
 * urgency: 'green' (>24h), 'yellow' (1-24h), 'red' (<1h) to NPC deadline.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { desc } from 'drizzle-orm';
import { breachIncidents, type BreachIncident } from './repos/platform-admin.schema';

function computeUrgency(notificationDeadline: Date): 'green' | 'yellow' | 'red' {
  const hoursRemaining = (notificationDeadline.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursRemaining < 1) return 'red';
  if (hoursRemaining <= 24) return 'yellow';
  return 'green';
}

export async function listBreaches(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const admin = ctx.get('platformAdmin');
  if (!admin) return ctx.json({ error: 'Platform admin access required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;

  const rows = await db
    .select()
    .from(breachIncidents)
    .orderBy(desc(breachIncidents.createdAt))
    .limit(200);

  const data = rows.map((breach: BreachIncident) => ({
    ...breach,
    urgency: computeUrgency(breach.notificationDeadline),
    hoursRemaining: Math.max(
      0,
      (breach.notificationDeadline.getTime() - Date.now()) / (1000 * 60 * 60),
    ),
  }));

  return ctx.json({ data }, 200);
}
