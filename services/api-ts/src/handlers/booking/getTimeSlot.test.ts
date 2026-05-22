import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeSlot as fakeSlotFactory } from '@/test-utils/factories';
import { TimeSlotRepository } from './repos/timeSlot.repo';
import { getTimeSlot } from './getTimeSlot';

const fakeSlot = fakeSlotFactory({ event: 'event-1', booking: null });

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
