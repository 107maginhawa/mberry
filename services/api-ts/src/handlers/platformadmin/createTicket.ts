/**
 * createTicket
 *
 * Path: POST /support/tickets
 * Any authenticated user can create a support ticket.
 * SLA deadlines are computed from priority at creation time.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { domainEvents } from '@/core/domain-events';
import { supportTickets } from './repos/platform-admin.schema';

// SLA matrix: [firstResponseHours, resolutionHours]
const SLA_HOURS: Record<string, [number, number]> = {
  critical: [2, 12],
  high: [4, 24],
  standard: [8, 72],
  low: [16, 168],
};

export async function createTicket(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const body = await ctx.req.json();
  const { subject, description, category, priority, organizationId } = body;

  // subject + description presence guaranteed by zValidator in app.ts

  const resolvedPriority: string = priority ?? 'standard';
  const resolvedCategory: string = category ?? 'general';

  const slaEntry: [number, number] = SLA_HOURS[resolvedPriority] ?? SLA_HOURS['standard'] ?? [8, 72];
  const firstResponseHours = slaEntry[0];
  const resolutionHours = slaEntry[1];
  const now = new Date();
  const slaFirstResponseDeadline = new Date(now.getTime() + firstResponseHours * 60 * 60 * 1000);
  const slaResolutionDeadline = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);

  const userId: string = (session as any).userId ?? (session as any).user?.id;

  const [ticket] = await db.insert(supportTickets).values({
    organizationId: organizationId ?? null,
    reportedBy: userId,
    subject,
    description,
    category: resolvedCategory as any,
    priority: resolvedPriority as any,
    status: 'open',
    slaFirstResponseDeadline,
    slaResolutionDeadline,
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  if (!ticket) {
    logger.error('Failed to insert support ticket');
    return ctx.json({ error: 'Failed to create ticket' }, 500);
  }

  await domainEvents.emit('ticket.created', {
    ticketId: ticket.id,
    organizationId: ticket.organizationId ?? null,
    reportedBy: ticket.reportedBy,
    priority: ticket.priority,
    subject: ticket.subject,
  });

  logger.info({ ticketId: ticket.id, priority: ticket.priority }, 'Support ticket created');

  return ctx.json({ data: ticket }, 201);
}
