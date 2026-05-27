/**
 * updateTicketStatus
 *
 * Path: PUT /admin/tickets/:id
 * Admin/super only.
 * Enforces valid status transitions and sets timestamp fields.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { ValidationError } from '@/core/errors';
import { supportTickets } from './repos/platform-admin.schema';

// Valid transitions: from → set of allowed to
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['waiting_customer', 'resolved', 'closed'],
  waiting_customer: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

export async function updateTicketStatus(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const admin = ctx.get('platformAdmin');
  if (!admin) return ctx.json({ error: 'Platform admin access required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const ticketId = ctx.req.param('id') as string;
  const userId: string = admin.userId;

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) return ctx.json({ error: 'Ticket not found' }, 404);

  const body = await ctx.req.json();
  const { status, assignedTo } = body;

  if (status) {
    const allowed = VALID_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ValidationError(
        `Invalid transition: ${ticket.status} → ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
  }

  const now = new Date();
  const updates: Partial<typeof supportTickets.$inferInsert> = {
    updatedBy: userId,
    updatedAt: now,
  };

  if (status) updates.status = status;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;

  // Set firstRespondedAt on first move out of open
  if (status && ticket.status === 'open' && !ticket.firstRespondedAt) {
    updates.firstRespondedAt = now;
  }

  if (status === 'resolved') updates.resolvedAt = now;
  if (status === 'closed') updates.closedAt = now;

  const [updated] = await db
    .update(supportTickets)
    .set(updates)
    .where(eq(supportTickets.id, ticketId))
    .returning();

  logger.info({ ticketId, oldStatus: ticket.status, newStatus: status }, 'Ticket status updated');

  return ctx.json({ data: updated });
}
