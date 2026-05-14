import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { listBookingEvents } from './listBookingEvents';

const fakeEvent = {
  id: 'event-1',
  owner: 'user-1',
  title: 'Dental Consultation',
  status: 'active',
  organizationId: 'org-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('listBookingEvents', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  function makeCtxWithVar(overrides: Record<string, any> = {}) {
    const ctx = makeCtx(overrides) as any;
    ctx.var = { logger: null };
    ctx.req.query = (key?: string) => key ? (overrides['_query']?.[key] ?? null) : (overrides['_query'] ?? {});
    ctx.req.queries = (_key: string) => [];
    // Override json to default status to 200 when omitted
    ctx.json = (body: any, status: number = 200) => ({ status, body });
    return ctx;
  }

  test('returns active events by default (public endpoint)', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findManyWithPagination: async () => ({ data: [fakeEvent], totalCount: 1 }),
    });

    const ctx = makeCtxWithVar({
      user: null,
      session: null,
    });

    const res = await listBookingEvents(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
  });

  test('returns pagination metadata', async () => {
    mocks = stubRepo(BookingEventRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtxWithVar({});
    const res = await listBookingEvents(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.pagination).toBeDefined();
  });
});
