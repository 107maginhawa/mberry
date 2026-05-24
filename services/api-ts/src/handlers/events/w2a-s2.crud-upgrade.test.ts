import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { createEvent } from './createEvent';
import { updateEvent } from './updateEvent';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

const fakeEvent = createFakeEvent({
  id: 'event-1',
  organizationId: 'org-1',
  title: 'Test Event',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  status: 'draft',
  eventSlug: 'test-event',
});

describe('[W2A-S2] CRUD Upgrade — createEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('auto-generates slug from title', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'CPD Dental Workshop 2026',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
    });
    await createEvent(ctx);

    expect(capturedData.eventSlug).toBe('cpd-dental-workshop-2026');
  });

  test('accepts cpdActivityType field', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Seminar',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        cpdActivityType: 'seminar',
        creditBearing: true,
        creditAmount: 4,
      },
    });
    await createEvent(ctx);

    expect(capturedData.cpdActivityType).toBe('seminar');
    expect(capturedData.creditBearing).toBe(true);
    expect(capturedData.creditAmount).toBe(4);
  });

  test('accepts coverImageUrl field', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        coverImageUrl: 'https://storage.example.com/cover.jpg',
      },
    });
    await createEvent(ctx);

    expect(capturedData.coverImageUrl).toBe('https://storage.example.com/cover.jpg');
  });

  test('rejects credit amount > 40', async () => {
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => ({ ...fakeEvent, ...data }),
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        creditAmount: 41,
      },
    });

    await expect(createEvent(ctx)).rejects.toThrow('Credit amount cannot exceed 40 hours');
  });

  test('rejects credit amount not in 0.5 increments', async () => {
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => ({ ...fakeEvent, ...data }),
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        creditAmount: 2.3,
      },
    });

    await expect(createEvent(ctx)).rejects.toThrow('Credit amount must be in 0.5 increments');
  });

  test('defaults visibility to internal', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      create: async (data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
      findBySlug: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        title: 'Test',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
    });
    await createEvent(ctx);

    expect(capturedData.visibility).toBe('internal');
  });
});

describe('[W2A-S2] CRUD Upgrade — updateEvent', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('rejects slug change (immutable)', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (id: string, data: any) => ({ ...fakeEvent, ...data }),
    });
    stubRepo(MembershipRepository, {
      getMember: async () => ({ id: 'member-1', role: 'admin' }),
    });

    const ctx = makeCtx({
      _params: { id: 'event-1' },
      _body: { eventSlug: 'new-slug' },
    });

    await expect(updateEvent(ctx)).rejects.toThrow('Event slug cannot be changed after creation');
  });

  test('accepts cpdActivityType and coverImageUrl update', async () => {
    let capturedData: any = null;
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (id: string, data: any) => { capturedData = data; return { ...fakeEvent, ...data }; },
    });
    stubRepo(MembershipRepository, {
      getMember: async () => ({ id: 'member-1', role: 'admin' }),
    });

    const ctx = makeCtx({
      _params: { id: 'event-1' },
      _body: {
        cpdActivityType: 'workshop',
        coverImageUrl: 'https://storage.example.com/new-cover.jpg',
      },
    });

    const res = await updateEvent(ctx);
    expect(res.status).toBe(200);
    expect(capturedData.cpdActivityType).toBe('workshop');
    expect(capturedData.coverImageUrl).toBe('https://storage.example.com/new-cover.jpg');
  });

  test('validates credit hours on update', async () => {
    mocks = stubRepo(EventsRepository, {
      get: async () => fakeEvent,
      update: async (id: string, data: any) => ({ ...fakeEvent, ...data }),
    });
    stubRepo(MembershipRepository, {
      getMember: async () => ({ id: 'member-1', role: 'admin' }),
    });

    const ctx = makeCtx({
      _params: { id: 'event-1' },
      _body: { creditAmount: 50 },
    });

    await expect(updateEvent(ctx)).rejects.toThrow('Credit amount cannot exceed 40 hours');
  });
});
