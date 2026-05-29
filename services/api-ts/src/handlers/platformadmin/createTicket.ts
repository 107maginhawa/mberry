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
import {
  supportTickets,
  ticketCategoryEnum,
  ticketPriorityEnum,
} from './repos/platform-admin.schema';

type TicketCategory = typeof ticketCategoryEnum.enumValues[number];
type TicketPriority = typeof ticketPriorityEnum.enumValues[number];

// SLA matrix: [firstResponseHours, resolutionHours]
const SLA_HOURS: Record<TicketPriority, [number, number]> = {
  critical: [2, 12],
  high: [4, 24],
  standard: [8, 72],
  low: [16, 168],
};

interface SessionLike {
  userId?: string;
  user?: { id?: string };
}

export async function createTicket(ctx: Context): Promise<Response> {
  const session = ctx.get('session') as SessionLike | null;
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const body = await ctx.req.json();
  const { subject, description, category, priority, organizationId } = body;

  // subject + description presence guaranteed by zValidator in app.ts

  const isPriority = (v: unknown): v is TicketPriority =>
    typeof v === 'string' && (ticketPriorityEnum.enumValues as readonly string[]).includes(v);
  const isCategory = (v: unknown): v is TicketCategory =>
    typeof v === 'string' && (ticketCategoryEnum.enumValues as readonly string[]).includes(v);

  const resolvedPriority: TicketPriority = isPriority(priority) ? priority : 'standard';
  const resolvedCategory: TicketCategory = isCategory(category) ? category : 'general';

  const slaEntry = SLA_HOURS[resolvedPriority];
  const firstResponseHours = slaEntry[0];
  const resolutionHours = slaEntry[1];
  const now = new Date();
  const slaFirstResponseDeadline = new Date(now.getTime() + firstResponseHours * 60 * 60 * 1000);
  const slaResolutionDeadline = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);

  const userId = session.userId ?? session.user?.id ?? '';

  const [ticket] = await db.insert(supportTickets).values({
    organizationId: organizationId ?? null,
    reportedBy: userId,
    subject,
    description,
    category: resolvedCategory,
    priority: resolvedPriority,
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
