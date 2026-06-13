import { sql } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import type { SearchChatMessagesQuery } from '@/generated/openapi/validators';
import { chatMessages, chatRooms } from './repos/comms.schema';

/**
 * searchChatMessages
 *
 * Path: GET /comms/messages/search?q=...
 *
 * Searches text messages across all chat rooms the authenticated user
 * participates in. Case-insensitive substring match on message text.
 * Returns up to 50 most-recent matches, ordered desc by timestamp.
 *
 * Empty/short query (< 2 chars) returns empty result.
 */
export async function searchChatMessages(
  ctx: ValidatedContext<never, SearchChatMessagesQuery, never>
): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) {
    throw new ValidationError('Valid user ID required');
  }

  const query = ctx.req.valid('query') as { q: string };
  const q = (query.q ?? '').trim();

  if (q.length < 2) {
    return ctx.json({ data: [] }, 200);
  }

  const db = ctx.get('database') as DatabaseInstance;

  // FIX-008 (G4 read-path): when the caller's org context is known, scope the
  // search to messages in that org's rooms OR DM rooms (org-agnostic, PD-2).
  // orgId derives from ctx.get('organizationId'); module-local, no shared
  // middleware change. When absent (no org context on the request) the search
  // keeps its prior participant-only scope.
  const callerOrgId = ctx.get('organizationId') as string | undefined;
  const orgScope = callerOrgId
    ? sql` AND (${chatRooms.organizationId} = ${callerOrgId} OR ${chatRooms.roomType} = 'dm')`
    : sql``;

  const rows = await db
    .select({
      id: chatMessages.id,
      message: chatMessages.message,
      sender: chatMessages.sender,
      chatRoom: chatMessages.chatRoom,
      timestamp: chatMessages.timestamp,
    })
    .from(chatMessages)
    .innerJoin(chatRooms, sql`${chatMessages.chatRoom} = ${chatRooms.id}`)
    .where(sql`${chatRooms.participants} @> ${JSON.stringify([user.id])}::jsonb
               AND ${chatMessages.messageType} = 'text'
               AND ${chatMessages.message} ILIKE ${'%' + q + '%'}${orgScope}`)
    .orderBy(sql`${chatMessages.timestamp} DESC`)
    .limit(50);

  const data = rows.map((r) => ({
    id: r.id,
    message: (r.message ?? '').slice(0, 200),
    sender: r.sender,
    chatRoom: r.chatRoom,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  }));

  return ctx.json({ data }, 200);
}
