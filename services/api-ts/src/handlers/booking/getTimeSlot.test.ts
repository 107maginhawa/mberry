import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { TimeSlotRepository } from './repos/timeSlot.repo';
import { getTimeSlot } from './getTimeSlot';

const fakeSlot = {
  id: 'slot-1',
  event: 'event-1',
  startTime: new Date('2026-06-01T10:00:00Z'),
  endTime: new Date('2026-06-01T10:30:00Z'),
  status: 'available',
  booking: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getTimeSlot', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns time slot by ID (public endpoint)', async () => {
    mocks = stubRepo(TimeSlotRepository, {
      findOneById: async () => fakeSlot,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { slotId: 'slot-1' },
      _query: {},
    });

    const res = await getTimeSlot(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('slot-1');
    expect((res as any).body.status).toBe('available');
    expect((res as any).body.event).toBe('event-1');
  });

  test('throws NotFoundError when slot does not exist', async () => {
    mocks = stubRepo(TimeSlotRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({
      _params: { slotId: 'missing' },
      _query: {},
    });

    await expect(getTimeSlot(ctx as any)).rejects.toThrow();
  });
});
