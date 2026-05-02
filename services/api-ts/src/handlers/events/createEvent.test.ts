import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createEvent } from './createEvent';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  tenantId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  description: 'Yearly gathering',
  location: 'Manila',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  registrationFee: 500,
  capacity: 100,
  creditBearing: false,
  creditAmount: 0,
  status: 'draft',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-15] createEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates event and returns 201', async () => {
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Annual Conference',
        description: 'Yearly gathering',
        startAt: '2026-06-01',
        endAt: '2026-06-02',
        capacity: 100,
        fee: 500,
      },
    });

    const response = await createEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe('Annual Conference');
    expect(response.body.data.organizationId).toBe('org-1');
  });

  test('maps alternative field names (startAt/endAt/fee)', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Test',
        startAt: '2026-07-01',
        endAt: '2026-07-02',
        fee: 1000,
        locationDetails: 'Room 101',
      },
    });

    await createEvent(ctx);
    expect(capturedData.registrationFee).toBe(1000);
    expect(capturedData.location).toBe('Room 101');
    expect(capturedData.startDate).toEqual(new Date('2026-07-01'));
    expect(capturedData.endDate).toEqual(new Date('2026-07-02'));
  });

  test('defaults creditBearing to false and creditAmount to 0', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
    });

    await createEvent(ctx);
    expect(capturedData.creditBearing).toBe(false);
    expect(capturedData.creditAmount).toBe(0);
  });

  test('defaults status to draft', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
    });

    await createEvent(ctx);
    expect(capturedData.status).toBe('draft');
  });

  test('accepts start date in the past (no validation in handler)', async () => {
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Past Event',
        startDate: '2020-01-01',
        endDate: '2020-01-02',
      },
    });

    // Handler does no date validation — accepts past dates
    const response = await createEvent(ctx);
    expect(response.status).toBe(201);
  });

  test('accepts end date before start date (no validation in handler)', async () => {
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Bad Dates',
        startDate: '2026-06-10',
        endDate: '2026-06-01',
      },
    });

    // Handler does no date range validation
    const response = await createEvent(ctx);
    expect(response.status).toBe(201);
  });

  test('accepts zero capacity (no validation in handler)', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Zero Cap',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        capacity: 0,
      },
    });

    const response = await createEvent(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.capacity).toBe(0);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => ({ ...fakeEvent, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
    });

    // session.user.id is accessed for createdBy/updatedBy
    await expect(createEvent(ctx)).rejects.toThrow();
  });
});
