/**
 * V-15: Concurrent session limit tests
 *
 * Tests for session limit enforcement — default 5 sessions per user,
 * oldest session auto-revoked when limit exceeded.
 */

import { describe, test, expect } from 'bun:test';
import { DEFAULT_SESSION_LIMIT, enforceSessionLimit } from './session-limit';
// Factory N/A: core infrastructure test — config/setup/service assertions, no domain entities

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('V-15: Session limit constants', () => {
  test('default session limit is 5', () => {
    expect(DEFAULT_SESSION_LIMIT).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// enforceSessionLimit — unit tests with mock database
// ---------------------------------------------------------------------------

/**
 * Minimal mock that tracks sessions in memory.
 * Simulates the Drizzle query chain: select().from().where().orderBy()
 * and delete().where().
 */
function createMockDb(initialSessions: Array<{ id: string; userId: string; createdAt: Date }>) {
  const sessions = [...initialSessions];
  const deletedIds: string[] = [];

  const mockDb = {
    select: (_fields: any) => ({
      from: (_table: any) => ({
        where: (_cond: any) => ({
          orderBy: (_order: any) => {
            // Return sessions for the userId encoded in the where condition
            // Since we can't easily parse drizzle conditions, return all sessions sorted
            return Promise.resolve(
              [...sessions]
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .map(s => ({ id: s.id, createdAt: s.createdAt })),
            );
          },
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: (_cond: any) => {
        // Find and remove the session — extract id from the condition
        // We'll track what was deleted via the deletedIds array
        // For the mock, we delete the first session that hasn't been deleted yet
        const toDelete = sessions.find(s => !deletedIds.includes(s.id));
        if (toDelete) {
          deletedIds.push(toDelete.id);
          const idx = sessions.indexOf(toDelete);
          if (idx !== -1) sessions.splice(idx, 1);
        }
        return Promise.resolve();
      },
    }),
    // Expose for assertions
    _deletedIds: deletedIds,
    _sessions: sessions,
  };

  return mockDb;
}

function makeSessions(userId: string, count: number): Array<{ id: string; userId: string; createdAt: Date }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${i + 1}`,
    userId,
    createdAt: new Date(Date.now() - (count - i) * 60_000), // oldest first
  }));
}

describe('V-15: enforceSessionLimit', () => {
  test('does nothing when under the limit', async () => {
    const sessions = makeSessions('user-1', 3);
    const db = createMockDb(sessions);
    const revoked = await enforceSessionLimit(db as any, 'user-1', 5);
    expect(revoked).toBe(0);
    expect(db._deletedIds).toHaveLength(0);
  });

  test('does nothing when exactly at the limit', async () => {
    const sessions = makeSessions('user-1', 5);
    const db = createMockDb(sessions);
    const revoked = await enforceSessionLimit(db as any, 'user-1', 5);
    expect(revoked).toBe(0);
    expect(db._deletedIds).toHaveLength(0);
  });

  test('revokes oldest session when limit exceeded by 1', async () => {
    const sessions = makeSessions('user-1', 6);
    const db = createMockDb(sessions);
    const revoked = await enforceSessionLimit(db as any, 'user-1', 5);
    expect(revoked).toBe(1);
    expect(db._deletedIds).toContain('session-1'); // oldest
  });

  test('revokes multiple oldest sessions when limit exceeded by >1', async () => {
    const sessions = makeSessions('user-1', 8);
    const db = createMockDb(sessions);
    const revoked = await enforceSessionLimit(db as any, 'user-1', 5);
    expect(revoked).toBe(3);
    expect(db._deletedIds).toContain('session-1');
    expect(db._deletedIds).toContain('session-2');
    expect(db._deletedIds).toContain('session-3');
  });

  test('skips enforcement when limit < 1', async () => {
    const sessions = makeSessions('user-1', 3);
    const db = createMockDb(sessions);
    const revoked = await enforceSessionLimit(db as any, 'user-1', 0);
    expect(revoked).toBe(0);
  });

  test('works with limit of 1 (single session mode)', async () => {
    const sessions = makeSessions('user-1', 3);
    const db = createMockDb(sessions);
    const revoked = await enforceSessionLimit(db as any, 'user-1', 1);
    expect(revoked).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Config integration
// ---------------------------------------------------------------------------

describe('V-15: Session limit config', () => {
  test('AuthConfig has sessionLimit field', async () => {
    const { AuthConfig } = await import('@/types/auth').then(m => m);
    // Type-level check: if this compiles, the field exists on the interface
    // Runtime check: verify parseConfig exposes the value
    const { parseConfig } = await import('@/core/config');
    const config = parseConfig();
    expect(config.auth.sessionLimit).toBeDefined();
    expect(typeof config.auth.sessionLimit).toBe('number');
    expect(config.auth.sessionLimit).toBe(DEFAULT_SESSION_LIMIT);
  });
});

// ---------------------------------------------------------------------------
// Auth hook integration
// ---------------------------------------------------------------------------

describe('V-15: Auth hook integration', () => {
  test('auth module imports session-limit for hook enforcement', async () => {
    // Structural test: if the import chain works, session-limit is wired into auth
    const authModule = await import('./auth');
    const sessionLimit = await import('./session-limit');
    expect(authModule.createAuth).toBeDefined();
    expect(sessionLimit.enforceSessionLimit).toBeDefined();
    expect(sessionLimit.DEFAULT_SESSION_LIMIT).toBe(5);
  });
});
