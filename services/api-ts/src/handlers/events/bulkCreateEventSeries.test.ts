import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EventsRepository } from './repos/events.repo';
import { bulkCreateEventSeries } from './bulkCreateEventSeries';

let repoMocks: Record<string, { mockRestore: () => void }>;

const templateEvent = {
  id: 'evt-template',
  organizationId: 'tenant-1',
  title: 'Monthly Seminar',
  eventType: 'seminar',
  description: 'A recurring seminar',
  location: 'Manila',
  startDate: new Date('2026-06-01T09:00:00Z'),
  endDate: new Date('2026-06-01T17:00:00Z'),
  capacity: 50,
  registrationFee: 0,
  currency: 'PHP',
  creditBearing: true,
  creditAmount: 8,
  cpdActivityType: 'seminar',
  eventSlug: 'monthly-seminar',
  coverImageUrl: null,
  visibility: 'network',
};

function stubRepoDefaults(overrides: Partial<Record<string, any>> = {}) {
  let createIdx = 0;
  repoMocks = stubRepo(EventsRepository, {
    get: async (id: string) => (id === templateEvent.id ? templateEvent : undefined),
    findBySlug: async () => undefined, // no collisions
    create: async (data: any) => ({ id: `evt-created-${++createIdx}`, ...data }),
    ...overrides,
  });
}

describe('bulkCreateEventSeries', () => {
  afterEach(() => {
    if (repoMocks) Object.values(repoMocks).forEach(m => m.mockRestore());
    restoreRepo(EventsRepository);
  });

  test('rejects when templateEventId missing', async () => {
    stubRepoDefaults();
    const ctx = makeCtx({
      _body: { dates: ['2026-07-01'] },
      _params: { organizationId: 'tenant-1' },
    });
    await expect(bulkCreateEventSeries(ctx)).rejects.toThrow('templateEventId required');
  });

  test('rejects when dates empty', async () => {
    stubRepoDefaults();
    const ctx = makeCtx({
      _body: { templateEventId: 'evt-template', dates: [] },
      _params: { organizationId: 'tenant-1' },
    });
    await expect(bulkCreateEventSeries(ctx)).rejects.toThrow('dates[] required');
  });

  test('rejects when > 52 dates', async () => {
    stubRepoDefaults();
    const dates = Array.from({ length: 53 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`);
    const ctx = makeCtx({
      _body: { templateEventId: 'evt-template', dates },
      _params: { organizationId: 'tenant-1' },
    });
    await expect(bulkCreateEventSeries(ctx)).rejects.toThrow('Max 52 occurrences');
  });

  test('rejects when template event not found', async () => {
    stubRepoDefaults({
      get: async () => undefined,
    });
    const ctx = makeCtx({
      _body: { templateEventId: 'nonexistent', dates: ['2026-07-01'] },
      _params: { organizationId: 'tenant-1' },
    });
    await expect(bulkCreateEventSeries(ctx)).rejects.toThrow('Template event not found');
  });

  test('rejects when template belongs to different org', async () => {
    stubRepoDefaults({
      get: async () => ({ ...templateEvent, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({
      _body: { templateEventId: 'evt-template', dates: ['2026-07-01'] },
      _params: { organizationId: 'tenant-1' },
    });
    await expect(bulkCreateEventSeries(ctx)).rejects.toThrow('Template event not found');
  });

  test('success: creates events with correct parentEventId, draft status, unique slugs', async () => {
    const createdEvents: any[] = [];
    stubRepoDefaults({
      create: async (data: any) => {
        const evt = { id: `evt-${createdEvents.length + 1}`, ...data };
        createdEvents.push(evt);
        return evt;
      },
    });
    const ctx = makeCtx({
      _body: {
        templateEventId: 'evt-template',
        dates: ['2026-07-01T09:00:00Z', '2026-08-01T09:00:00Z'],
      },
      _params: { organizationId: 'tenant-1' },
    });
    const res = await bulkCreateEventSeries(ctx);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.count).toBe(2);

    // All created events should have draft status
    for (const evt of createdEvents) {
      expect(evt.status).toBe('draft');
      expect(evt.parentEventId).toBe('evt-template');
      expect(evt.organizationId).toBe('tenant-1');
      expect(evt.title).toBe('Monthly Seminar');
    }

    // Slugs should be unique
    const slugs = createdEvents.map(e => e.eventSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
