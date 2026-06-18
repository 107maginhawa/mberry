/**
 * booking/utils/authorization — full branch coverage
 *
 * Pure utility module — no ctx, no repos, direct function calls.
 * Every exported function, every branch path covered.
 */
import { describe, test, expect } from 'bun:test';
import { ForbiddenError } from '@/core/errors';
import {
  checkBookingEventOwnership,
  checkBookingEventCreateAuthorization,
  checkUserRole,
  checkBookingOwnership,
} from './authorization';

// Minimal mock db — these functions don't actually query it
const mockDb = {} as any;
const mockAuth = {} as any;

// ─── checkBookingEventOwnership ──────────────────────────

describe('checkBookingEventOwnership', () => {
  test('admin role bypasses ownership check', async () => {
    const user = { id: 'user-1', role: 'admin' };
    const result = await checkBookingEventOwnership(mockDb, mockAuth, user, 'other-owner', 'event-1');
    expect(result).toBe(true);
  });

  test('support role bypasses ownership check', async () => {
    const user = { id: 'user-1', role: 'support' };
    const result = await checkBookingEventOwnership(mockDb, mockAuth, user, 'other-owner', 'event-1');
    expect(result).toBe(true);
  });

  test('owner can manage their own event', async () => {
    const user = { id: 'user-1', role: 'user' };
    const result = await checkBookingEventOwnership(mockDb, mockAuth, user, 'user-1', 'event-1');
    expect(result).toBe(true);
  });

  test('non-owner throws ForbiddenError with eventId in message', async () => {
    const user = { id: 'user-1', role: 'user' };
    await expect(
      checkBookingEventOwnership(mockDb, mockAuth, user, 'other-owner', 'event-99'),
    ).rejects.toThrow('event: event-99');
  });

  test('non-owner without eventId throws ForbiddenError without event context', async () => {
    const user = { id: 'user-1', role: 'member' };
    await expect(
      checkBookingEventOwnership(mockDb, mockAuth, user, 'other-owner'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('non-owner error message does not include event: when eventId omitted', async () => {
    const user = { id: 'user-1', role: 'user' };
    let caught: Error | undefined;
    try {
      await checkBookingEventOwnership(mockDb, mockAuth, user, 'other-owner');
    } catch (e: any) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught?.message).not.toContain('event:');
  });
});

// ─── checkBookingEventCreateAuthorization ────────────────

describe('checkBookingEventCreateAuthorization', () => {
  test('any authenticated user can create events', async () => {
    const user = { id: 'user-1', role: 'user' };
    const result = await checkBookingEventCreateAuthorization(mockDb, mockAuth, user);
    expect(result).toBe(true);
  });

  test('member role can create events', async () => {
    const user = { id: 'member-1', role: 'member' };
    const result = await checkBookingEventCreateAuthorization(mockDb, mockAuth, user);
    expect(result).toBe(true);
  });

  test('officer role can create events', async () => {
    const user = { id: 'officer-1', role: 'officer' };
    const result = await checkBookingEventCreateAuthorization(mockDb, mockAuth, user);
    expect(result).toBe(true);
  });
});

// ─── checkUserRole ───────────────────────────────────────

describe('checkUserRole', () => {
  test('user with matching role returns true', () => {
    const user = { id: 'user-1', role: 'admin' };
    const result = checkUserRole(user, ['admin', 'super'], 'delete resources');
    expect(result).toBe(true);
  });

  test('user with one of multiple allowed roles returns true', () => {
    const user = { id: 'user-1', role: 'officer' };
    const result = checkUserRole(user, ['admin', 'officer', 'support'], 'manage events');
    expect(result).toBe(true);
  });

  test('user with disallowed role throws ForbiddenError', () => {
    const user = { id: 'user-1', role: 'user' };
    expect(() => checkUserRole(user, ['admin', 'officer'], 'delete resources')).toThrow(ForbiddenError);
  });

  test('ForbiddenError message includes role and operation', () => {
    const user = { id: 'user-1', role: 'member' };
    let caught: Error | undefined;
    try {
      checkUserRole(user, ['admin'], 'configure billing');
    } catch (e: any) {
      caught = e;
    }
    expect(caught?.message).toContain("'member'");
    expect(caught?.message).toContain('configure billing');
    expect(caught?.message).toContain('admin');
  });

  test('empty roles array always throws ForbiddenError', () => {
    const user = { id: 'user-1', role: 'admin' };
    expect(() => checkUserRole(user, [], 'do anything')).toThrow(ForbiddenError);
  });
});

// ─── checkBookingOwnership ───────────────────────────────

describe('checkBookingOwnership', () => {
  const booking = {
    id: 'booking-1',
    client: 'client-1',
    host: 'host-1',
    slot: 'slot-1',
    status: 'confirmed',
  };

  test('admin role bypasses ownership check', async () => {
    const user = { id: 'random-1', role: 'admin' };
    const result = await checkBookingOwnership(mockDb, user, booking);
    expect(result).toBe(true);
  });

  test('support role bypasses ownership check', async () => {
    const user = { id: 'random-1', role: 'support' };
    const result = await checkBookingOwnership(mockDb, user, booking);
    expect(result).toBe(true);
  });

  test('client (booking.client === user.id) can manage booking', async () => {
    const user = { id: 'client-1', role: 'user' };
    const result = await checkBookingOwnership(mockDb, user, booking);
    expect(result).toBe(true);
  });

  test('host (booking.host === user.id) can manage booking', async () => {
    const user = { id: 'host-1', role: 'user' };
    const result = await checkBookingOwnership(mockDb, user, booking);
    expect(result).toBe(true);
  });

  test('unrelated user throws ForbiddenError', async () => {
    const user = { id: 'stranger-1', role: 'user' };
    await expect(checkBookingOwnership(mockDb, user, booking)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('ForbiddenError message says not authorized to manage', async () => {
    const user = { id: 'nobody', role: 'member' };
    let caught: Error | undefined;
    try {
      await checkBookingOwnership(mockDb, user, booking);
    } catch (e: any) {
      caught = e;
    }
    expect(caught?.message).toContain('not authorized to manage this booking');
  });

  test('officer role (not client/host) throws ForbiddenError', async () => {
    const user = { id: 'officer-99', role: 'officer' };
    await expect(checkBookingOwnership(mockDb, user, booking)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
