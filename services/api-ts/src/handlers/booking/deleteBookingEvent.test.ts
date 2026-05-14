import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { deleteBookingEvent } from './deleteBookingEvent';

const fakeEvent = {
  id: 'event-1',
  owner: 'user-1',
  title: 'Dental Consultation',
  status: 'active',
  organizationId: 'org-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCtxForDelete(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides) as any;
  const params = overrides['_params'] || {};
  // deleteBookingEvent uses req.param() with no args
  ctx.req.param = (key?: string) => key ? (params[key] || '') : params;
  return ctx;
}

describe('deleteBookingEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('deletes event and returns 204 when owner', async () => {
    let deleteCalled = false;
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
      deleteOneById: async () => { deleteCalled = true; },
    });

    const ctx = makeCtxForDelete({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1' },
    });

    const res = await deleteBookingEvent(ctx);
    expect(res.status).toBe(204);
    expect(deleteCalled).toBe(true);
  });

  test('throws NotFoundError when event does not exist', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => null,
      deleteOneById: async () => {},
    });

    const ctx = makeCtxForDelete({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'missing' },
    });

    await expect(deleteBookingEvent(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-owner tries to delete', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
      deleteOneById: async () => {},
    });

    const ctx = makeCtxForDelete({
      user: { id: 'other-user', role: 'user' },
      _params: { event: 'event-1' },
    });

    await expect(deleteBookingEvent(ctx)).rejects.toThrow();
  });
});
