import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { ScheduleExceptionRepository } from './repos/scheduleException.repo';
import { deleteScheduleException } from './deleteScheduleException';

const fakeException = {
  id: 'exception-1',
  event: 'event-1',
  owner: 'user-1',
  startDatetime: new Date('2026-06-01T10:00:00Z'),
  endDatetime: new Date('2026-06-01T12:00:00Z'),
  reason: 'Holiday',
  recurring: false,
};

describe('deleteScheduleException', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('deletes exception and returns 204 when owner', async () => {
    let deleteCalled = false;
    mocks = stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => fakeException,
      deleteOneById: async () => { deleteCalled = true; },
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1', exception: 'exception-1' },
    });

    const res = await deleteScheduleException(ctx as any);
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  test('throws NotFoundError when exception does not exist', async () => {
    mocks = stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1', exception: 'missing' },
    });

    await expect(deleteScheduleException(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-owner tries to delete', async () => {
    mocks = stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => fakeException,
    });

    const ctx = makeCtx({
      user: { id: 'other-user', role: 'user' },
      _params: { event: 'event-1', exception: 'exception-1' },
    });

    await expect(deleteScheduleException(ctx as any)).rejects.toThrow();
  });
});
