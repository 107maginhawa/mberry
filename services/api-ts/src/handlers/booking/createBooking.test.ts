/**
 * Tests for createBooking handler
 *
 * The handler is a thin coordinator:
 *   1. Reads user + body from context
 *   2. Delegates to BookingRepository.createBooking
 *   3. Logs an audit trail
 *   4. Returns 201 JSON
 *
 * We stub the context and mock the BookingRepository so we test
 * handler-level concerns without hitting the database.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createBooking } from './createBooking';
import { NotFoundError, ConflictError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(overrides: {
  userId?: string;
  body?: Record<string, any>;
  repoResult?: any;
  repoThrows?: Error;
} = {}) {
  const {
    userId = 'user-1',
    body = { slot: 'slot-1', locationType: 'video' },
    repoResult = { id: 'booking-1', status: 'pending' },
    repoThrows,
  } = overrides;

  const store: Record<string, any> = {
    user: { id: userId },
    database: {},
    logger: {
      info: () => {},
      debug: () => {},
      error: () => {},
    },
  };

  const mockRepo = {
    createBooking: mock(async (_clientId: string, _slotId: string, _body: any) => {
      if (repoThrows) throw repoThrows;
      return repoResult;
    }),
  };

  // Intercept BookingRepository constructor at the handler level by patching the
  // module. Because Bun's module mock works best at module level, here we rely on
  // the fact that the handler instantiates BookingRepository with `new` and we
  // can verify integration by providing a real-ish context object.

  const ctx: any = {
    get: (key: string) => store[key],
    req: {
      valid: (_type: string) => body,
      header: (_name: string) => undefined,
    },
    json: (data: any, status: number) => ({ data, status }),
  };

  return { ctx, mockRepo };
}

// ---------------------------------------------------------------------------
// Tests that do NOT require real DB (test the handler logic with mocked repo)
// ---------------------------------------------------------------------------

describe('createBooking handler — with mocked repo', () => {
  test('returns 201 with booking payload on success', async () => {
    // We test handler control flow by monkey-patching BookingRepository at runtime.
    // Import the module so we can intercept the class.
    const { BookingRepository } = await import('./repos/booking.repo');
    const originalProto = BookingRepository.prototype.createBooking;

    const fakeBooking = { id: 'b-1', status: 'pending', client: 'user-1' };
    BookingRepository.prototype.createBooking = mock(async () => fakeBooking);

    const { ctx } = makeCtx({ userId: 'user-1', body: { slot: 'slot-1', locationType: 'video' } });

    const response = await createBooking(ctx);

    expect(response.status).toBe(201);
    expect(response.data).toEqual(fakeBooking);

    // Restore
    BookingRepository.prototype.createBooking = originalProto;
  });

  test('propagates NotFoundError thrown by repo', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const originalProto = BookingRepository.prototype.createBooking;

    BookingRepository.prototype.createBooking = mock(async () => {
      throw new NotFoundError('Time slot not found');
    });

    const { ctx } = makeCtx();
    await expect(createBooking(ctx)).rejects.toThrow(NotFoundError);

    BookingRepository.prototype.createBooking = originalProto;
  });

  test('propagates ConflictError when slot is unavailable', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const originalProto = BookingRepository.prototype.createBooking;

    BookingRepository.prototype.createBooking = mock(async () => {
      throw new ConflictError('Time slot is not available');
    });

    const { ctx } = makeCtx();
    await expect(createBooking(ctx)).rejects.toThrow(ConflictError);

    BookingRepository.prototype.createBooking = originalProto;
  });

  test('passes the authenticated user id as clientId', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const originalProto = BookingRepository.prototype.createBooking;

    let capturedClientId: string | undefined;
    BookingRepository.prototype.createBooking = mock(async (clientId: string) => {
      capturedClientId = clientId;
      return { id: 'b-2', status: 'pending' };
    });

    const { ctx } = makeCtx({ userId: 'user-42', body: { slot: 'slot-9' } });
    await createBooking(ctx);

    expect(capturedClientId).toBe('user-42');

    BookingRepository.prototype.createBooking = originalProto;
  });

  test('passes slot id from request body to repo', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const originalProto = BookingRepository.prototype.createBooking;

    let capturedSlotId: string | undefined;
    BookingRepository.prototype.createBooking = mock(async (_clientId: string, slotId: string) => {
      capturedSlotId = slotId;
      return { id: 'b-3', status: 'pending' };
    });

    const { ctx } = makeCtx({ body: { slot: 'slot-xyz', locationType: 'phone' } });
    await createBooking(ctx);

    expect(capturedSlotId).toBe('slot-xyz');

    BookingRepository.prototype.createBooking = originalProto;
  });
});

// ---------------------------------------------------------------------------
// Slot validation (via repo — test different body configurations)
// ---------------------------------------------------------------------------

describe('createBooking handler — slot validation scenarios', () => {
  test('passes full body including locationType and reason to repo', async () => {
    const { BookingRepository } = await import('./repos/booking.repo');
    const originalProto = BookingRepository.prototype.createBooking;

    let capturedBody: any;
    BookingRepository.prototype.createBooking = mock(
      async (_clientId: string, _slotId: string, body: any) => {
        capturedBody = body;
        return { id: 'b-4', status: 'pending' };
      }
    );

    const body = { slot: 'slot-1', locationType: 'in-person', reason: 'Annual checkup' };
    const { ctx } = makeCtx({ body });
    await createBooking(ctx);

    expect(capturedBody.locationType).toBe('in-person');
    expect(capturedBody.reason).toBe('Annual checkup');

    BookingRepository.prototype.createBooking = originalProto;
  });
});
