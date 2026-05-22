// Business Rules: [BR-26]
/**
 * [BR-26] Session Management — Pure Domain Logic Tests
 *
 * BR-26: Session management rules:
 * - Concurrent sessions are limited per user (default: 5).
 * - Sessions must be revoked on password change (force re-auth).
 * - Session tokens are invalidated immediately on revocation.
 * - Active sessions are identifiable by userId for targeted revocation.
 */

import { describe, test, expect } from 'bun:test';

// ─── Domain types ────────────────────────────────────────────

interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokedReason: 'password_change' | 'logout' | 'limit_exceeded' | null;
}

// ─── Domain helpers (pure, no DB, no HTTP) ──────────────────

const MAX_CONCURRENT_SESSIONS = 5;

/**
 * Returns active (non-revoked) sessions for a user, sorted oldest-first.
 */
function getActiveSessions(userId: string, sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.userId === userId && s.revokedAt === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Determines which sessions to revoke when adding a new one.
 * BR-26: oldest sessions are revoked first when limit is exceeded.
 */
function getSessionsToRevoke(userId: string, sessions: Session[]): Session[] {
  const active = getActiveSessions(userId, sessions);
  if (active.length < MAX_CONCURRENT_SESSIONS) return [];
  // Revoke enough oldest sessions to make room for one new
  const overage = active.length - MAX_CONCURRENT_SESSIONS + 1;
  return active.slice(0, overage);
}

/**
 * Marks all sessions for a user as revoked due to password change.
 * BR-26: password change forces re-auth on all sessions.
 */
function revokeAllSessionsOnPasswordChange(
  userId: string,
  sessions: Session[],
  now: Date,
): Session[] {
  return sessions.map((s) =>
    s.userId === userId && s.revokedAt === null
      ? { ...s, revokedAt: now, revokedReason: 'password_change' as const }
      : s,
  );
}

/**
 * Checks if a session token is still valid (not revoked).
 */
function isSessionValid(sessionId: string, sessions: Session[]): boolean {
  const session = sessions.find((s) => s.id === sessionId);
  return session !== undefined && session.revokedAt === null;
}

// ─── [BR-26] Tests ──────────────────────────────────────────

describe('[BR-26] Concurrent Session Limit', () => {
  const USER_ID = 'user-0000-0000-0000-000000000001';

  function makeSession(id: string, minutesAgo: number, revoked = false): Session {
    const createdAt = new Date(Date.now() - minutesAgo * 60000);
    return {
      id,
      userId: USER_ID,
      createdAt,
      revokedAt: revoked ? new Date() : null,
      revokedReason: revoked ? 'logout' : null,
    };
  }

  test('[BR-26] no sessions to revoke when under limit', () => {
    const sessions = [
      makeSession('s1', 100),
      makeSession('s2', 80),
      makeSession('s3', 60),
    ];
    const toRevoke = getSessionsToRevoke(USER_ID, sessions);
    expect(toRevoke).toHaveLength(0);
  });

  test('[BR-26] at limit — adding one requires revoking oldest', () => {
    const sessions = [
      makeSession('s1', 100), // oldest
      makeSession('s2', 80),
      makeSession('s3', 60),
      makeSession('s4', 40),
      makeSession('s5', 20), // newest
    ];
    const toRevoke = getSessionsToRevoke(USER_ID, sessions);
    expect(toRevoke).toHaveLength(1);
    expect(toRevoke[0].id).toBe('s1'); // oldest revoked first
  });

  test('[BR-26] already-revoked sessions are not counted toward limit', () => {
    const sessions = [
      makeSession('s1', 100, true), // already revoked
      makeSession('s2', 80),
      makeSession('s3', 60),
      makeSession('s4', 40),
    ];
    const active = getActiveSessions(USER_ID, sessions);
    expect(active).toHaveLength(3);
    const toRevoke = getSessionsToRevoke(USER_ID, sessions);
    expect(toRevoke).toHaveLength(0); // under limit
  });
});

describe('[BR-26] Password Change Revokes All Sessions', () => {
  const USER_ID = 'user-0000-0000-0000-000000000001';
  const OTHER_USER = 'user-other-0000-0000-000000000002';

  const sessions: Session[] = [
    { id: 's1', userId: USER_ID, createdAt: new Date('2024-01-01'), revokedAt: null, revokedReason: null },
    { id: 's2', userId: USER_ID, createdAt: new Date('2024-01-02'), revokedAt: null, revokedReason: null },
    { id: 's3', userId: OTHER_USER, createdAt: new Date('2024-01-01'), revokedAt: null, revokedReason: null },
  ];

  test('[BR-26] password change revokes all active sessions for that user', () => {
    const now = new Date();
    const updated = revokeAllSessionsOnPasswordChange(USER_ID, sessions, now);
    const userSessions = updated.filter((s) => s.userId === USER_ID);
    expect(userSessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(userSessions.every((s) => s.revokedReason === 'password_change')).toBe(true);
  });

  test('[BR-26] password change does not affect other users\' sessions', () => {
    const now = new Date();
    const updated = revokeAllSessionsOnPasswordChange(USER_ID, sessions, now);
    const otherSession = updated.find((s) => s.userId === OTHER_USER);
    expect(otherSession?.revokedAt).toBeNull();
  });

  test('[BR-26] revoked session is no longer valid', () => {
    const now = new Date();
    const updated = revokeAllSessionsOnPasswordChange(USER_ID, sessions, now);
    expect(isSessionValid('s1', updated)).toBe(false);
    expect(isSessionValid('s2', updated)).toBe(false);
  });

  test('[BR-26] non-revoked session is valid', () => {
    expect(isSessionValid('s3', sessions)).toBe(true);
  });
});
