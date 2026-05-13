import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { createBookingEvent } from './createBookingEvent';
import { mock } from 'bun:test';

const EVENT = {
  id: 'event-1',
  title: 'Consultation',
  status: 'active',
  ownerId: 'user-1',
};

describe('createBookingEvent', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns 403 without org context', async () => {
    const ctx = makeCtx({
      _body: { title: 'Test' },
      orgId: null,
      organizationId: null,
    });
    // Override orgId getter
    const origGet = ctx.get.bind(ctx);
    ctx.get = (key: string) => key === 'orgId' ? null : origGet(key);

    const res = await createBookingEvent(ctx as any);
    expect(res.status).toBe(403);
  });

  test('throws ValidationError for invalid config', async () => {
    mocks = stubRepo(BookingEventRepository, {
      validateEventConfig: () => ['title is required'],
    });

    const ctx = makeCtx({
      _body: {},
      orgId: 'org-1',
    });

    await expect(createBookingEvent(ctx as any)).rejects.toThrow('Invalid booking event configuration');
  });

  test('creates event and returns 201', async () => {
    mocks = stubRepo(BookingEventRepository, {
      validateEventConfig: () => [],
      createWithSmartDefaults: async () => EVENT,
    });

    // Mock slot generator
    mock.module('./jobs/slotGenerator', () => ({
      regenerateEventSlots: async () => {},
    }));

    const ctx = makeCtx({
      _body: { title: 'Consultation' },
      orgId: 'org-1',
    });

    const res = await createBookingEvent(ctx as any);
    expect(res.status).toBe(201);
  });
});
