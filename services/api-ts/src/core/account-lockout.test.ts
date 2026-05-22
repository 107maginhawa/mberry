/**
 * AC-M01-005: Account lockout after 5 consecutive failed login attempts.
 *
 * Tests the in-memory tracking, threshold detection, DB ban application,
 * and reset-on-success behaviour.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
import {
  recordFailedAttempt,
  getFailedAttemptCount,
  clearFailedAttempts,
  isLockedOut,
  applyLockout,
  clearLockout,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  _resetForTest,
} from './account-lockout';

// Mock-Classification: APPROPRIATE — security/auth infrastructure boundary
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeMockDb() {
  const updateChain = {
    set: mock(function (this: any) { return this; }),
    where: mock(function (this: any) { return this; }),
  };
  const selectChain = {
    from: mock(function (this: any) { return this; }),
    where: mock(function (this: any) { return this; }),
    limit: mock(() => []),
  };
  const insertChain = {
    values: mock(function (this: any) { return this; }),
    returning: mock(() => [{ id: 'audit-1' }]),
  };
  return {
    update: mock(() => updateChain),
    select: mock(() => selectChain),
    insert: mock(() => insertChain),
    delete: mock(() => ({ where: mock(() => ({ returning: mock(() => []) })) })),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AC-M01-005: Account lockout', () => {
  beforeEach(() => {
    _resetForTest();
  });

  describe('in-memory failed attempt tracking', () => {
    test('recordFailedAttempt increments count', () => {
      expect(recordFailedAttempt('user@test.com')).toBe(1);
      expect(recordFailedAttempt('user@test.com')).toBe(2);
      expect(recordFailedAttempt('user@test.com')).toBe(3);
    });

    test('email is case-insensitive', () => {
      recordFailedAttempt('User@Test.COM');
      expect(getFailedAttemptCount('user@test.com')).toBe(1);
    });

    test('separate tracking per email', () => {
      recordFailedAttempt('a@test.com');
      recordFailedAttempt('a@test.com');
      recordFailedAttempt('b@test.com');
      expect(getFailedAttemptCount('a@test.com')).toBe(2);
      expect(getFailedAttemptCount('b@test.com')).toBe(1);
    });

    test('clearFailedAttempts resets count to 0', () => {
      recordFailedAttempt('user@test.com');
      recordFailedAttempt('user@test.com');
      clearFailedAttempts('user@test.com');
      expect(getFailedAttemptCount('user@test.com')).toBe(0);
    });

    test('getFailedAttemptCount returns 0 for unknown email', () => {
      expect(getFailedAttemptCount('unknown@test.com')).toBe(0);
    });
  });

  describe('lockout threshold', () => {
    test('isLockedOut returns false under threshold', () => {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
        recordFailedAttempt('user@test.com');
      }
      expect(isLockedOut('user@test.com')).toBe(false);
    });

    test('isLockedOut returns true at threshold (5 attempts)', () => {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        recordFailedAttempt('user@test.com');
      }
      expect(isLockedOut('user@test.com')).toBe(true);
    });

    test('MAX_FAILED_ATTEMPTS is exactly 5', () => {
      expect(MAX_FAILED_ATTEMPTS).toBe(5);
    });

    test('LOCKOUT_DURATION_MS is 15 minutes', () => {
      expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
    });
  });

  describe('applyLockout DB interaction', () => {
    test('sets banned=true, banReason, and banExpires on user table', async () => {
      const db = makeMockDb();
      const logger = makeLogger();

      await applyLockout(db, 'user@test.com', logger);

      expect(db.update).toHaveBeenCalled();
      const setCall = db.update().set;
      expect(setCall).toHaveBeenCalled();

      // Verify the set data shape
      const setArg = setCall.mock.calls[0]?.[0];
      expect(setArg).toBeDefined();
      expect(setArg.banned).toBe(true);
      expect(setArg.banReason).toContain('too many failed login attempts');
      expect(setArg.banExpires).toBeInstanceOf(Date);

      // banExpires should be ~15 minutes from now
      const expectedExpiry = Date.now() + LOCKOUT_DURATION_MS;
      const actualExpiry = setArg.banExpires.getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });

    test('logs warning on lockout', async () => {
      const db = makeMockDb();
      const logger = makeLogger();

      await applyLockout(db, 'user@test.com', logger);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('clearLockout DB interaction', () => {
    test('sets banned=false and clears ban fields', async () => {
      const db = makeMockDb();
      const logger = makeLogger();

      await clearLockout(db, 'user@test.com', logger);

      expect(db.update).toHaveBeenCalled();
      const setCall = db.update().set;
      const setArg = setCall.mock.calls[0]?.[0];
      expect(setArg).toBeDefined();
      expect(setArg.banned).toBe(false);
      expect(setArg.banReason).toBeNull();
      expect(setArg.banExpires).toBeNull();
    });

    test('clears in-memory counter', async () => {
      const db = makeMockDb();
      recordFailedAttempt('user@test.com');
      recordFailedAttempt('user@test.com');
      expect(getFailedAttemptCount('user@test.com')).toBe(2);

      await clearLockout(db, 'user@test.com', makeLogger());
      expect(getFailedAttemptCount('user@test.com')).toBe(0);
    });
  });

  describe('error resilience', () => {
    test('applyLockout does not throw on DB error', async () => {
      const db = makeMockDb();
      db.update = mock(() => { throw new Error('DB down'); });
      const logger = makeLogger();

      // Should not throw
      await applyLockout(db, 'user@test.com', logger);
      expect(logger.error).toHaveBeenCalled();
    });

    test('clearLockout does not throw on DB error', async () => {
      const db = makeMockDb();
      db.update = mock(() => { throw new Error('DB down'); });
      const logger = makeLogger();

      await clearLockout(db, 'user@test.com', logger);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
