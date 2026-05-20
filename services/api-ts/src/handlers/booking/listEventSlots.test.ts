import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { TimeSlotRepository } from './repos/timeSlot.repo';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { listEventSlots } from './listEventSlots';

const fakeEvent = {
  id: 'event-1',
  owner: 'user-1',
  status: 'active',
  organizationId: 'org-1',
};

const fakeSlot = {
  id: 'slot-1',
  event: 'event-1',
  startTime: new Date('2026-06-01T10:00:00Z'),
  endTime: new Date('2026-06-01T10:30:00Z'),
  status: 'available',
};

describe('listEventSlots', () => {
  let eventMocks: ReturnType<typeof stubRepo>;
  let slotMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    if (slotMocks) Object.values(slotMocks).forEach((m) => m.mockRestore());
  });

  test('returns slots for event (public endpoint)', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });
    slotMocks = stubRepo(TimeSlotRepository, {
      findMany: async () => [fakeSlot],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { event: 'event-1' },
      _query: {},
    });

    const res = await listEventSlots(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body).toHaveLength(1);
    expect((res as any).body[0].id).toBe('slot-1');
    expect((res as any).body[0].status).toBe('available');
  });

  test('throws NotFoundError when event does not exist', async () => {
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      _params: { event: 'missing' },
      _query: {},
    });

    await expect(listEventSlots(ctx as any)).rejects.toThrow();
  });

  test('defaults to available slots', async () => {
    let capturedFilters: any;
    eventMocks = stubRepo(BookingEventRepository, {
      findOneById: async () => fakeEvent,
    });
    slotMocks = stubRepo(TimeSlotRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
    });

    const ctx = makeCtx({
      _params: { event: 'event-1' },
      _query: {},
    });

    await listEventSlots(ctx as any);
    expect(capturedFilters.status).toBe('available');
  });
});
