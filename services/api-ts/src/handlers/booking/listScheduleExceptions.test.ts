import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBookingEvent, fakeScheduleException } from '@/test-utils/factories';
import { ScheduleExceptionRepository } from './repos/scheduleException.repo';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { listScheduleExceptions } from './listScheduleExceptions';

const fakeEvent = fakeBookingEvent();

const fakeException = fakeScheduleException({ id: 'exception-1', event: 'event-1', owner: 'user-1', startDatetime: new Date('2026-06-01T10:00:00Z'), endDatetime: new Date('2026-06-01T12:00:00Z'), recurring: false });

describe('listScheduleExceptions', () => {
  let exceptionMocks: ReturnType<typeof stubRepo>;
  let eventMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (exceptionMocks) Object.values(exceptionMocks).forEach((m) => m.mockRestore());
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('throws NotFoundError when event does not exist', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'missing' },
      _query: {},
    });

    await expect(listScheduleExceptions(ctx as any)).rejects.toThrow();
  });

  test('returns exceptions for event owner', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });
    exceptionMocks = stubRepo(ScheduleExceptionRepository, {
      findMany: async () => [fakeException],
      count: async () => 1,
    });
    mock.module('./utils/authorization', () => ({
      checkBookingEventOwnership: async () => {},
    }));

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1' },
      _query: {},
    });

    const res = await listScheduleExceptions(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
  });
});
