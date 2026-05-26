/**
 * Permission enforcement tests for Booking module.
 *
 * Verifies:
 * - Client cannot confirm bookings (host-only)
 * - Client cannot reject bookings (host-only)
 * - Non-owner cannot cancel another's booking
 * - Non-owner cannot delete another's booking event
 * - Non-owner cannot manage another's schedule exceptions
 *
 * Uses the shared makeCtx/stubRepo pattern from @/test-utils/make-ctx.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeBooking, fakeBookingEvent, fakeScheduleException } from '@/test-utils/factories';
import { BookingRepository } from './repos/booking.repo';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { ScheduleExceptionRepository } from './repos/scheduleException.repo';
import { confirmBooking } from './confirmBooking';
import { rejectBooking } from './rejectBooking';
import { cancelBooking } from './cancelBooking';
import { deleteBookingEvent } from './deleteBookingEvent';
import { createScheduleException } from './createScheduleException';
import { deleteScheduleException } from './deleteScheduleException';
import { ForbiddenError } from '@/core/errors';

// ─── Helpers ────────────────────────────────────────────

/**
 * deleteBookingEvent uses ctx.req.param() without args (destructuring),
 * which the standard makeCtx doesn't support. This wrapper fixes that.
 */
function makeCtxForParam(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides) as any;
  const params = overrides['_params'] || {};
  ctx.req.param = (key?: string) => key ? (params[key] || '') : params;
  return ctx;
}

// ─── Fixtures ───────────────────────────────────────────

const hostBooking = fakeBooking({ host: 'host-1', client: 'client-1', status: 'pending' });
const confirmedBooking = fakeBooking({ host: 'host-1', client: 'client-1', status: 'confirmed' });
const ownedEvent = fakeBookingEvent({ owner: 'user-1', organizationId: 'org-1' });
const otherEvent = fakeBookingEvent({ owner: 'other-user', organizationId: 'org-1', id: 'event-other' });
const ownedException = fakeScheduleException({ owner: 'user-1', eventId: 'event-1' });
const otherException = fakeScheduleException({ owner: 'other-user', eventId: 'event-1', id: 'exc-other' });

beforeEach(() => {
  restoreRepo(BookingRepository);
  restoreRepo(BookingEventRepository);
  restoreRepo(ScheduleExceptionRepository);
});

afterEach(() => {
  restoreRepo(BookingRepository);
  restoreRepo(BookingEventRepository);
  restoreRepo(ScheduleExceptionRepository);
});

// ─── confirmBooking: host-only ─────────────────────────

describe('confirmBooking — host-only permission', () => {
  test('throws ForbiddenError when client tries to confirm their own booking', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => hostBooking,
      confirmBooking: async () => ({ ...hostBooking, status: 'confirmed' }),
    });

    // Authenticated as the client, not the host
    const ctx = makeCtx({
      user: { id: 'client-1', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Confirming' },
    });

    await expect(confirmBooking(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('throws ForbiddenError when unrelated user tries to confirm', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => hostBooking,
      confirmBooking: async () => ({ ...hostBooking, status: 'confirmed' }),
    });

    const ctx = makeCtx({
      user: { id: 'stranger-99', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Confirming' },
    });

    await expect(confirmBooking(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows host to confirm booking', async () => {
    const confirmed = { ...hostBooking, status: 'confirmed', confirmationTimestamp: new Date() };
    stubRepo(BookingRepository, {
      findOneById: async () => hostBooking,
      confirmBooking: async () => confirmed,
    });

    const ctx = makeCtx({
      user: { id: 'host-1', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Confirming' },
    });

    const res = await confirmBooking(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── rejectBooking: host-only ──────────────────────────

describe('rejectBooking — host-only permission', () => {
  test('throws ForbiddenError when client tries to reject', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => hostBooking,
      updateOneById: async (_id: string, data: any) => ({ ...hostBooking, ...data }),
    });

    const ctx = makeCtx({
      user: { id: 'client-1', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Not available' },
    });

    await expect(rejectBooking(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('throws ForbiddenError when unrelated user tries to reject', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => hostBooking,
      updateOneById: async (_id: string, data: any) => ({ ...hostBooking, ...data }),
    });

    const ctx = makeCtx({
      user: { id: 'stranger-99', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Not available' },
    });

    await expect(rejectBooking(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows host to reject booking', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => hostBooking,
      updateOneById: async (_id: string, data: any) => ({ ...hostBooking, ...data }),
    });

    // rejectBooking does a direct db.update() for slot release
    const ctx = makeCtx({
      user: { id: 'host-1', role: 'user', twoFactorEnabled: true },
      database: {
        transaction: async (fn: any) => fn({}),
        update: () => ({
          set: () => ({
            where: async () => {},
          }),
        }),
      },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Not available' },
    });

    const res = await rejectBooking(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── cancelBooking: owner-only ─────────────────────────

describe('cancelBooking — non-owner denial', () => {
  test('throws ForbiddenError when unrelated user tries to cancel', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => confirmedBooking,
      cancelBooking: async () => ({ ...confirmedBooking, status: 'cancelled' }),
    });

    const ctx = makeCtx({
      user: { id: 'stranger-99', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Need to cancel' },
    });

    await expect(cancelBooking(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows client to cancel their booking', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => confirmedBooking,
      cancelBooking: async (_id: string, _type: string, _reason: string) => ({
        ...confirmedBooking,
        status: 'cancelled',
        cancelledAt: new Date(),
      }),
    });

    const ctx = makeCtx({
      user: { id: 'client-1', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Need to cancel' },
    });

    const res = await cancelBooking(ctx);
    expect(res.status).toBe(200);
  });

  test('allows host to cancel booking', async () => {
    stubRepo(BookingRepository, {
      findOneById: async () => confirmedBooking,
      cancelBooking: async (_id: string, _type: string, _reason: string) => ({
        ...confirmedBooking,
        status: 'cancelled',
        cancelledAt: new Date(),
      }),
    });

    const ctx = makeCtx({
      user: { id: 'host-1', role: 'user', twoFactorEnabled: true },
      _params: { booking: 'booking-1' },
      _body: { reason: 'Need to cancel' },
    });

    const res = await cancelBooking(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── deleteBookingEvent: owner-only ────────────────────

describe('deleteBookingEvent — non-owner denial', () => {
  test('throws ForbiddenError when non-owner tries to delete event', async () => {
    stubRepo(BookingEventRepository, {
      findOneById: async () => otherEvent,
      deleteOneById: async () => {},
    });

    // user-1 trying to delete other-user's event
    const ctx = makeCtxForParam({
      _params: { event: 'event-other' },
    });

    await expect(deleteBookingEvent(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows owner to delete their booking event', async () => {
    stubRepo(BookingEventRepository, {
      findOneById: async () => ownedEvent,
      deleteOneById: async () => {},
    });

    const ctx = makeCtxForParam({
      _params: { event: 'event-1' },
    });

    const res = await deleteBookingEvent(ctx);
    expect(res.status).toBe(204);
  });
});

// ─── createScheduleException: owner-only ───────────────

describe('createScheduleException — non-owner denial', () => {
  test('throws ForbiddenError when non-owner tries to create exception', async () => {
    stubRepo(BookingEventRepository, {
      findOneById: async () => otherEvent,
    });
    stubRepo(ScheduleExceptionRepository, {
      createExceptionForEvent: async () => ownedException,
    });

    // user-1 trying to create exception on other-user's event
    const ctx = makeCtx({
      _params: { event: 'event-other' },
      _body: {
        startDatetime: '2026-06-15T09:00:00Z',
        endDatetime: '2026-06-15T17:00:00Z',
        type: 'unavailable',
        reason: 'Holiday',
      },
    });

    await expect(createScheduleException(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows owner to create exception on their event', async () => {
    stubRepo(BookingEventRepository, {
      findOneById: async () => ownedEvent,
    });
    stubRepo(ScheduleExceptionRepository, {
      createExceptionForEvent: async () => ownedException,
    });

    const ctx = makeCtx({
      _params: { event: 'event-1' },
      _body: {
        startDatetime: '2026-06-15T09:00:00Z',
        endDatetime: '2026-06-15T17:00:00Z',
        type: 'unavailable',
        reason: 'Holiday',
      },
    });

    const res = await createScheduleException(ctx);
    expect(res.status).toBe(201);
  });
});

// ─── deleteScheduleException: owner-only ───────────────

describe('deleteScheduleException — non-owner denial', () => {
  test('throws ForbiddenError when non-owner tries to delete exception', async () => {
    stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => otherException,
      deleteOneById: async () => {},
    });

    // user-1 trying to delete other-user's exception
    const ctx = makeCtx({
      _params: { event: 'event-1', exception: 'exc-other' },
    });

    await expect(deleteScheduleException(ctx)).rejects.toThrow(ForbiddenError);
  });

  test('allows owner to delete their schedule exception', async () => {
    stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => ownedException,
      deleteOneById: async () => {},
    });

    const ctx = makeCtx({
      _params: { event: 'event-1', exception: 'exc-1' },
    });

    const res = await deleteScheduleException(ctx);
    expect(res.status).toBe(204);
  });
});
