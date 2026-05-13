import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listEvents } from './listEvents';
import { EventsRepository } from './repos/events.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeEvent = {
  id: 'evt-1',
  organizationId: 'org-1',
  organizationId: 'org-1',
  title: 'Annual Conference',
  description: 'Yearly gathering',
  location: 'Manila',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
  registrationFee: 500,
  capacity: 100,
  status: 'published',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('listEvents', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns events list with 200', async () => {
    mocks = stubRepo(EventsRepository, {
      list: async () => ({ data: [fakeEvent], total: 1 }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: {},
    });

    const response = await listEvents(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  test('returns empty list when no events', async () => {
    mocks = stubRepo(EventsRepository, {
      list: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const response = await listEvents(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.meta.total).toBe(0);
  });

  test('passes filters to repo', async () => {
    let capturedFilters: any = null;
    mocks = stubRepo(EventsRepository, {
      list: async (_orgId: string, filters: any) => {
        capturedFilters = filters;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'published', search: 'conf', limit: '10', offset: '5' },
    });

    await listEvents(ctx);
    expect(capturedFilters.status).toBe('published');
    expect(capturedFilters.search).toBe('conf');
    expect(capturedFilters.limit).toBe(10);
    expect(capturedFilters.offset).toBe(5);
  });

  test('no session does not crash (no auth required in handler)', async () => {
    // listEvents does not access session — it only reads orgId from param.
    // Auth middleware is responsible for gating. Handler itself won't crash.
    mocks = stubRepo(EventsRepository, {
      list: async () => ({ data: [], total: 0 }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
    });

    const response = await listEvents(ctx);
    expect(response.status).toBe(200);
  });
});
