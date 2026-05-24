import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBookingEvent } from '@/test-utils/factories';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { updateBookingEvent } from './updateBookingEvent';

const fakeEvent = fakeBookingEvent({ duration: 30 });

function makeCtxForUpdate(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides) as any;
  // updateBookingEvent uses req.param() with no args (returns full params object)
  const params = overrides['_params'] || {};
  ctx.req.param = (key?: string) => key ? (params[key] || '') : params;
  // Handler uses req.valid('json') for body
  ctx.req.valid = (target: string) => {
    if (target === 'json') return overrides['_body'] || {};
    if (target === 'param') return params;
    if (target === 'query') return overrides['_query'] || {};
    return {};
  };
  // Override json to default status to 200 when omitted
  ctx.json = (body: any, status: number = 200) => ({ status, body });
  return ctx;
}

describe('updateBookingEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('updates event and returns 200 when owner', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
      validateEventConfig: () => [],
      updateWithChangeDetection: async (_id: string, data: any) => ({
        event: { ...fakeEvent, ...data },
        requiresSlotRegeneration: false,
        changes: [],
      }),
    });

    const ctx = makeCtxForUpdate({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1' },
      _body: { title: 'Updated Consultation' },
    });

    const res = await updateBookingEvent(ctx);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('event-1');
    expect(res.body.title).toBe('Updated Consultation');
    expect(res.body.status).toBe('active');
  });

  test('returns 404 when event does not exist', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtxForUpdate({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'missing' },
      _body: { title: 'Updated' },
    });

    const res = await updateBookingEvent(ctx);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('returns 403 when non-owner tries to update', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });

    const ctx = makeCtxForUpdate({
      user: { id: 'other-user', role: 'user' },
      _params: { event: 'event-1' },
      _body: { title: 'Updated' },
    });

    const res = await updateBookingEvent(ctx);
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 when validation fails', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
      validateEventConfig: () => ['Invalid duration'],
    });

    const ctx = makeCtxForUpdate({
      user: { id: 'user-1', role: 'user' },
      _params: { event: 'event-1' },
      _body: { duration: -1 },
    });

    const res = await updateBookingEvent(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeArray();
    expect(res.body.details[0]).toBe('Invalid duration');
  });
});
