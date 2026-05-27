/**
 * addTicketComment
 *
 * Path: POST /admin/tickets/:id/comments
 * Admin/super OR the ticket creator can comment.
 * isInternal=true only allowed for admins.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';
import { ValidationError } from '@/core/errors';
import { supportTickets, ticketComments } from './repos/platform-admin.schema';

export async function addTicketComment(ctx: Context): Promise<Response> {
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

  if (!admin && ticket.reportedBy !== userId) {
    return ctx.json({ error: 'Forbidden' }, 403);
  }

  const body = await ctx.req.json();
  const { content, isInternal } = body;

  if (!content) throw new ValidationError('content is required');

  if (isInternal && !admin) {
    return ctx.json({ error: 'Only admins can post internal notes' }, 403);
  }

  const [comment] = await db.insert(ticketComments).values({
    ticketId,
    authorId: userId,
    content,
    isInternal: isInternal === true && !!admin,
  }).returning();

  return ctx.json({ data: comment }, 201);
}
