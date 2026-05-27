/**
 * getTicket
 *
 * Path: GET /admin/tickets/:id
 * Admin/super OR the ticket's creator can access.
 * Comments: internal notes hidden from non-admins.
 * Returns SLA countdown (seconds remaining).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { eq, and, type SQL } from 'drizzle-orm';
import { supportTickets, ticketComments } from './repos/platform-admin.schema';

export async function getTicket(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const admin = ctx.get('platformAdmin');
  const userId: string = (session as any).userId ?? (session as any).user?.id;
  const ticketId = ctx.req.param('id') as string;

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) return ctx.json({ error: 'Ticket not found' }, 404);

  // Access: admin or ticket creator
  if (!admin && ticket.reportedBy !== userId) {
    return ctx.json({ error: 'Forbidden' }, 403);
  }

  // Load comments, filter internal notes for non-admins
  const commentFilter: SQL = admin
    ? eq(ticketComments.ticketId, ticketId)
    : and(eq(ticketComments.ticketId, ticketId), eq(ticketComments.isInternal, false)) as SQL;

  const allComments = await db
    .select()
    .from(ticketComments)
    .where(commentFilter)
    .orderBy(ticketComments.createdAt);

  const now = Date.now();
  const firstResponseSecondsRemaining = Math.max(
    0,
    Math.floor((ticket.slaFirstResponseDeadline.getTime() - now) / 1000),
  );
  const resolutionSecondsRemaining = Math.max(
    0,
    Math.floor((ticket.slaResolutionDeadline.getTime() - now) / 1000),
  );

  return ctx.json({
    data: {
      ...ticket,
      comments: allComments,
      slaCountdown: {
        firstResponseSecondsRemaining,
        resolutionSecondsRemaining,
      },
    },
  });
}
