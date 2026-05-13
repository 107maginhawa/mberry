// FLOW-05: Event Creation → Registration Open
// Tests that createEvent correctly stores event with registration capacity,
// credit-bearing config, and status transitions.
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createEvent } from './createEvent';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-05';

function defaultStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(EventsRepository, {
    create: async (data: any) => ({ id: 'event-1', ...data }),
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-05] Event Creation → Registration Open', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventsRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('event created with registration capacity', async () => {
    let capturedEvent: any = null;

    mocks = defaultStubs({
      create: async (data: any) => {
        capturedEvent = data;
        return { id: 'event-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Annual Convention',
        startDate: '2026-07-01T09:00:00Z',
        endDate: '2026-07-03T17:00:00Z',
        capacity: 200,
        registrationFee: 50000,
        eventType: 'conference',
      },
      _params: { organizationId: ORG },
    });
    const response = await createEvent(ctx);

    expect(response.status).toBe(201);
    expect(capturedEvent.organizationId).toBe(ORG);
    expect(capturedEvent.title).toBe('Annual Convention');
    expect(capturedEvent.capacity).toBe(200);
    expect(capturedEvent.registrationFee).toBe(50000);
  });

  test('credit-bearing event stores credit amount', async () => {
    let capturedEvent: any = null;

    mocks = defaultStubs({
      create: async (data: any) => {
        capturedEvent = data;
        return { id: 'event-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        title: 'CPD Workshop',
        startDate: '2026-08-01',
        endDate: '2026-08-01',
        creditBearing: true,
        creditAmount: 4,
      },
      _params: { organizationId: ORG },
    });
    await createEvent(ctx);

    expect(capturedEvent.creditBearing).toBe(true);
    expect(capturedEvent.creditAmount).toBe(4);
  });

  test('non-credit event defaults creditBearing to false', async () => {
    let capturedEvent: any = null;

    mocks = defaultStubs({
      create: async (data: any) => {
        capturedEvent = data;
        return { id: 'event-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Social Gathering',
        startDate: '2026-09-15',
        endDate: '2026-09-15',
      },
      _params: { organizationId: ORG },
    });
    await createEvent(ctx);

    expect(capturedEvent.creditBearing).toBe(false);
    expect(capturedEvent.creditAmount).toBe(0);
  });

  test('default status is draft', async () => {
    let capturedEvent: any = null;

    mocks = defaultStubs({
      create: async (data: any) => {
        capturedEvent = data;
        return { id: 'event-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Pending Event',
        startDate: '2026-10-01',
        endDate: '2026-10-01',
      },
      _params: { organizationId: ORG },
    });
    await createEvent(ctx);

    expect(capturedEvent.status).toBe('draft');
    expect(capturedEvent.visibility).toBe('internal');
  });

  test('fee defaults to 0 when not provided', async () => {
    let capturedEvent: any = null;

    mocks = defaultStubs({
      create: async (data: any) => {
        capturedEvent = data;
        return { id: 'event-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        title: 'Free Event',
        startDate: '2026-11-01',
        endDate: '2026-11-01',
      },
      _params: { organizationId: ORG },
    });
    await createEvent(ctx);

    expect(capturedEvent.registrationFee).toBe(0);
  });

  test('accepts both startAt/endAt and startDate/endDate field names', async () => {
    let capturedEvent: any = null;

    mocks = defaultStubs({
      create: async (data: any) => {
        capturedEvent = data;
        return { id: 'event-1', ...data };
      },
    });

    // Using startAt/endAt (alternative field names)
    const ctx = makeCtx({
      _body: {
        title: 'Flexible Fields Event',
        startAt: '2026-12-01T09:00:00Z',
        endAt: '2026-12-01T17:00:00Z',
      },
      _params: { organizationId: ORG },
    });
    await createEvent(ctx);

    expect(capturedEvent.startDate).toBeInstanceOf(Date);
    expect(capturedEvent.endDate).toBeInstanceOf(Date);
  });
});
