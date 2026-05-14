import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { ScheduleExceptionRepository } from './repos/scheduleException.repo';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { createScheduleException } from './createScheduleException';

const fakeEvent = {
  id: 'event-1',
  owner: 'user-1',
  status: 'active',
  organizationId: 'org-1',
};

const fakeException = {
  id: 'exception-1',
  event: 'event-1',
  owner: 'user-1',
  startDatetime: new Date('2026-06-01T10:00:00Z'),
  endDatetime: new Date('2026-06-01T12:00:00Z'),
  reason: 'Holiday',
  recurring: false,
};

describe('createScheduleException', () => {
  let exceptionMocks: ReturnType<typeof stubRepo>;
  let eventMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (exceptionMocks) Object.values(exceptionMocks).forEach((m) => m.mockRestore());
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
  });

  test('creates exception and returns 201 when event owner', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });
    exceptionMocks = stubRepo(ScheduleExceptionRepository, {
      createExceptionForEvent: async () => fakeException,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1' },
      _body: {
        startDatetime: '2026-06-01T10:00:00Z',
        endDatetime: '2026-06-01T12:00:00Z',
        reason: 'Holiday',
      },
    });

    const res = await createScheduleException(ctx as any);
    expect(res.status).toBe(201);
  });

  test('throws NotFoundError when event does not exist', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'missing' },
      _body: { reason: 'Holiday' },
    });

    await expect(createScheduleException(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-owner tries to create exception', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });

    const ctx = makeCtx({
      user: { id: 'other-user', role: 'user' },
      _params: { event: 'event-1' },
      _body: { reason: 'Holiday' },
    });

    await expect(createScheduleException(ctx as any)).rejects.toThrow();
  });
});
