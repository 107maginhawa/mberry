import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBookingEvent } from '@/test-utils/factories';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { regenerateBookingEventSlots } from './regenerateBookingEventSlots';

// Unit coverage for the ownership gates, which short-circuit BEFORE any slot
// regeneration (so they are cleanly testable against a stubbed repo). The
// happy-path regen-produces-slots behavior is proven against real PG in
// regenerateBookingEventSlots.integration.test.ts.

const fakeEvent = fakeBookingEvent({ duration: 30 });

function makeCtxFor(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides) as any;
  const params = overrides['_params'] || {};
  ctx.req.param = (key?: string) => (key ? params[key] || '' : params);
  ctx.json = (body: any, status: number = 200) => ({ status, body });
  return ctx;
}

describe('regenerateBookingEventSlots (ownership gates)', () => {
  let mocks: ReturnType<typeof stubRepo>;
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 404 when the event does not exist', async () => {
    mocks = stubRepo(BookingEventRepository, { findOneById: async () => null });
    const ctx = makeCtxFor({ user: { id: 'user-1', role: 'user' }, _params: { event: 'missing' } });

    const res = await regenerateBookingEventSlots(ctx);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns 403 when a non-owner triggers regeneration', async () => {
    // findOneById returns an event owned by someone else → owner check fails
    // before regenerateEventSlots is ever called.
    mocks = stubRepo(BookingEventRepository, { findOneById: async () => fakeEvent });
    const ctx = makeCtxFor({ user: { id: 'other-user', role: 'user' }, _params: { event: 'event-1' } });

    const res = await regenerateBookingEventSlots(ctx);
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });
});
