import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { ScheduleExceptionRepository } from './repos/scheduleException.repo';
import { updateScheduleException } from './updateScheduleException';

const fakeException = {
  id: 'exception-1',
  event: 'event-1',
  owner: 'user-1',
  startDatetime: new Date('2026-06-01T10:00:00Z'),
  endDatetime: new Date('2026-06-01T12:00:00Z'),
  reason: 'Holiday',
  recurring: false,
};

function makeCtxForUpdateException(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides) as any;
  // updateScheduleException uses c.var.logger
  ctx.var = { logger: null };
  // Override json to default status to 200 when omitted
  ctx.json = (body: any, status: number = 200) => ({ status, body });
  return ctx;
}

describe('updateScheduleException', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 401 without user', async () => {
    const ctx = makeCtxForUpdateException({
      user: null,
      session: null,
      _params: { exceptionId: 'exception-1' },
      _body: { reason: 'Updated' },
    });

    const res = await updateScheduleException(ctx);
    expect(res.status).toBe(401);
  });

  test('updates exception and returns 200 when owner', async () => {
    const updated = { ...fakeException, reason: 'Updated reason' };
    mocks = stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => fakeException,
      updateOneById: async () => updated,
    });

    const ctx = makeCtxForUpdateException({
      user: { id: 'user-1', role: 'user' },
      _params: { exceptionId: 'exception-1' },
      _body: { reason: 'Updated reason' },
    });

    const res = await updateScheduleException(ctx);
    expect(res.status).toBe(200);
  });

  test('returns 404 when exception does not exist', async () => {
    mocks = stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtxForUpdateException({
      user: { id: 'user-1', role: 'user' },
      _params: { exceptionId: 'missing' },
      _body: { reason: 'Updated' },
    });

    const res = await updateScheduleException(ctx);
    expect(res.status).toBe(404);
  });

  test('returns 403 when non-owner tries to update', async () => {
    mocks = stubRepo(ScheduleExceptionRepository, {
      findOneById: async () => fakeException,
    });

    const ctx = makeCtxForUpdateException({
      user: { id: 'other-user', role: 'user' },
      _params: { exceptionId: 'exception-1' },
      _body: { reason: 'Updated' },
    });

    const res = await updateScheduleException(ctx);
    expect(res.status).toBe(403);
  });
});
