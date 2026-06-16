import { describe, test, expect, afterAll, mock } from 'bun:test';
import * as _real from './ownership';
import {
  checkBookingOwnership,
  checkBookingHostOwnership,
  checkBookingClientOwnership,
  getBookingUserType,
  checkEventOwnership,
} from './ownership';

// Snapshot real module and restore after all tests so sibling test mocks
// (cancelBooking, getBooking, markNoShowBooking, rejectBooking) don't
// leave a stub that poisons this real-impl test file.
const realOwnership = { ..._real };
afterAll(() => {
  mock.module('./ownership', () => realOwnership);
});

// ─── Minimal fakes ──────────────────────────────────────

const db = {} as any;
const logger = null;

function makeUser(id: string) {
  return { id, role: 'user' } as any;
}

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    client: 'client-1',
    host: 'host-1',
    status: 'confirmed',
    ...overrides,
  } as any;
}

// ─── checkBookingOwnership ──────────────────────────────

describe('checkBookingOwnership', () => {
  test('returns true when user is client', async () => {
    const booking = makeBooking({ client: 'user-1', host: 'host-1' });
    const result = await checkBookingOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(true);
  });

  test('returns true when user is host', async () => {
    const booking = makeBooking({ client: 'client-1', host: 'user-1' });
    const result = await checkBookingOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(true);
  });

  test('returns false when user is neither client nor host', async () => {
    const booking = makeBooking({ client: 'client-1', host: 'host-1' });
    const result = await checkBookingOwnership(db, logger, makeUser('stranger'), booking);
    expect(result).toBe(false);
  });

  test('returns false when booking has no client and no host', async () => {
    const booking = makeBooking({ client: null, host: null });
    const result = await checkBookingOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(false);
  });

  test('returns true when client matches even if host is null', async () => {
    const booking = makeBooking({ client: 'user-1', host: null });
    const result = await checkBookingOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(true);
  });
});

// ─── checkBookingHostOwnership ──────────────────────────

describe('checkBookingHostOwnership', () => {
  test('returns true when user is host', async () => {
    const booking = makeBooking({ host: 'user-1' });
    const result = await checkBookingHostOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(true);
  });

  test('returns false when user is not host', async () => {
    const booking = makeBooking({ host: 'host-1' });
    const result = await checkBookingHostOwnership(db, logger, makeUser('other'), booking);
    expect(result).toBe(false);
  });

  test('returns false when booking has no host', async () => {
    const booking = makeBooking({ host: null });
    const result = await checkBookingHostOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(false);
  });
});

// ─── checkBookingClientOwnership ───────────────────────

describe('checkBookingClientOwnership', () => {
  test('returns true when user is client', async () => {
    const booking = makeBooking({ client: 'user-1' });
    const result = await checkBookingClientOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(true);
  });

  test('returns false when user is not client', async () => {
    const booking = makeBooking({ client: 'other-client' });
    const result = await checkBookingClientOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(false);
  });

  test('returns false when booking has no client', async () => {
    const booking = makeBooking({ client: null });
    const result = await checkBookingClientOwnership(db, logger, makeUser('user-1'), booking);
    expect(result).toBe(false);
  });
});

// ─── getBookingUserType ─────────────────────────────────

describe('getBookingUserType', () => {
  test('returns "client" when user is client', async () => {
    const booking = makeBooking({ client: 'user-1', host: 'host-1' });
    const result = await getBookingUserType(db, logger, makeUser('user-1'), booking);
    expect(result).toBe('client');
  });

  test('returns "host" when user is host (not client)', async () => {
    const booking = makeBooking({ client: 'client-1', host: 'user-1' });
    const result = await getBookingUserType(db, logger, makeUser('user-1'), booking);
    expect(result).toBe('host');
  });

  test('returns null when user is neither', async () => {
    const booking = makeBooking({ client: 'client-1', host: 'host-1' });
    const result = await getBookingUserType(db, logger, makeUser('stranger'), booking);
    expect(result).toBeNull();
  });

  test('returns "client" when user is both client and host', async () => {
    // client check runs first; if same person is both, returns 'client'
    const booking = makeBooking({ client: 'user-1', host: 'user-1' });
    const result = await getBookingUserType(db, logger, makeUser('user-1'), booking);
    expect(result).toBe('client');
  });
});

// ─── checkEventOwnership ───────────────────────────────

describe('checkEventOwnership', () => {
  test('returns true when user id matches event owner', () => {
    const result = checkEventOwnership(makeUser('user-1'), 'user-1');
    expect(result).toBe(true);
  });

  test('returns false when user id does not match event owner', () => {
    const result = checkEventOwnership(makeUser('user-1'), 'other-owner');
    expect(result).toBe(false);
  });
});
