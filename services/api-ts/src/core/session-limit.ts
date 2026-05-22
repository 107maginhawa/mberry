/**
 * Session limit enforcement for Better-Auth
 *
 * V-15: Concurrent session limits — default 5 sessions per user.
 * When the limit is exceeded, the oldest session is automatically revoked.
 *
 * Better-Auth (v1.3.x) does not have native session limits, so this is
 * implemented at the databaseHooks.session.create.after level.
 */

import { eq, asc } from 'drizzle-orm';
import * as schema from '@/generated/better-auth/schema';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';

/** Default maximum concurrent sessions per user */
export const DEFAULT_SESSION_LIMIT = 5;

/**
 * Enforce session limit for a user.
 *
 * Called after a new session is created. If the user now has more sessions
 * than `limit`, the oldest sessions are deleted until the count equals the
 * limit.
 *
 * @returns Number of sessions revoked (0 if under limit)
 */
export async function enforceSessionLimit(
  database: DatabaseInstance,
  userId: string,
  limit: number,
  logger?: Logger,
): Promise<number> {
  if (limit < 1) {
    logger?.warn({ userId, limit }, 'Session limit must be >= 1; skipping enforcement');
    return 0;
  }

  // Fetch all active sessions for the user, ordered oldest-first
  const sessions = await database
    .select({ id: schema.session.id, createdAt: schema.session.createdAt })
    .from(schema.session)
    .where(eq(schema.session.userId, userId))
    .orderBy(asc(schema.session.createdAt));

  const excessCount = sessions.length - limit;
  if (excessCount <= 0) {
    return 0;
  }

  // Delete the oldest sessions that exceed the limit
  const toRevoke = sessions.slice(0, excessCount);
  const revokeIds = toRevoke.map(s => s.id);

  for (const sessionId of revokeIds) {
    await database
      .delete(schema.session)
      .where(eq(schema.session.id, sessionId));
  }

  logger?.info(
    { userId, sessionsRevoked: revokeIds.length, limit, totalBefore: sessions.length },
    'V-15: Oldest sessions revoked — concurrent session limit exceeded',
  );

  return revokeIds.length;
}
