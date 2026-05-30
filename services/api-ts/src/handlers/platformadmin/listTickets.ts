/**
 * listTickets
 *
 * Path: GET /admin/tickets
 * Admin/super only. Filter by status, priority, assignee.
 * Returns computed slaStatus: 'on_track' | 'at_risk' | 'breached'.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { eq, and, type SQL } from 'drizzle-orm';
import {
  supportTickets,
  ticketStatusEnum,
  ticketPriorityEnum,
} from './repos/platform-admin.schema';

type TicketStatus = typeof ticketStatusEnum.enumValues[number];
type TicketPriority = typeof ticketPriorityEnum.enumValues[number];

const isStatus = (v: string): v is TicketStatus =>
  (ticketStatusEnum.enumValues as readonly string[]).includes(v);
const isPriority = (v: string): v is TicketPriority =>
  (ticketPriorityEnum.enumValues as readonly string[]).includes(v);

const AT_RISK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

function computeSlaStatus(ticket: typeof supportTickets.$inferSelect, now: number): 'on_track' | 'at_risk' | 'breached' {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return 'on_track';

  const resolutionMs = ticket.slaResolutionDeadline.getTime();
  const firstResponseMs = ticket.slaFirstResponseDeadline.getTime();

  const effectiveDeadline = ticket.firstRespondedAt ? resolutionMs : Math.min(firstResponseMs, resolutionMs);

  if (now > effectiveDeadline) return 'breached';
  if (effectiveDeadline - now < AT_RISK_THRESHOLD_MS) return 'at_risk';
  return 'on_track';
}

export async function listTickets(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const admin = ctx.get('platformAdmin');
  if (!admin) return ctx.json({ error: 'Platform admin access required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;

  const { status, priority, assignee } = ctx.req.query() as Record<string, string>;

  const filters: SQL[] = [];
  if (status && isStatus(status)) filters.push(eq(supportTickets.status, status));
  if (priority && isPriority(priority)) filters.push(eq(supportTickets.priority, priority));
  if (assignee) filters.push(eq(supportTickets.assignedTo, assignee));

  const rows = await db
    .select()
    .from(supportTickets)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(supportTickets.createdAt);

  const now = Date.now();
  const data = rows.map(t => ({ ...t, slaStatus: computeSlaStatus(t, now) }));

  return ctx.json({ data });
}
