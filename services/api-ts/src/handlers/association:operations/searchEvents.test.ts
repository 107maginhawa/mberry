import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { searchEvents } from './searchEvents';
import { EventRepository } from './repos/events.repo';

describe('searchEvents — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null });
    const response = await searchEvents(ctx);
    expect(response.status).toBe(401);
  });
});

describe('searchEvents — happy path', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
  });

  test('returns paginated event list with correct shape', async () => {
    const fakeEvents = [
      { id: 'evt-1', title: 'Conference A', status: 'published', organizationId: 'org-1' },
      { id: 'evt-2', title: 'Workshop B', status: 'published', organizationId: 'org-1' },
    ];
    mocks = stubRepo(EventRepository, {
      findMany: async () => fakeEvents,
      count: async () => 2,
    });

    const ctx = makeCtx({
      _query: { organizationId: 'org-1', limit: '10', offset: '0' },
    });
    const response = await searchEvents(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(2);
    expect((response as any).body.data[0].id).toBe('evt-1');
  });

  test('pagination math is correct', async () => {
    mocks = stubRepo(EventRepository, {
      findMany: async () => Array.from({ length: 10 }, (_, i) => ({ id: `evt-${i}` })),
      count: async () => 25,
    });

    const ctx = makeCtx({ _query: { limit: '10', offset: '10' } });
    const response = await searchEvents(ctx);
    expect(response.status).toBe(200);
    const pagination = (response as any).body.pagination;
    expect(pagination.totalCount).toBe(25);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.currentPage).toBe(2);
    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.hasPreviousPage).toBe(true);
  });

  test('last page has no next page', async () => {
    mocks = stubRepo(EventRepository, {
      findMany: async () => [{ id: 'evt-1' }],
      count: async () => 1,
    });

    const ctx = makeCtx({ _query: { limit: '10', offset: '0' } });
    const response = await searchEvents(ctx);
    const pagination = (response as any).body.pagination;
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.hasPreviousPage).toBe(false);
  });

  test('applies status filter when provided', async () => {
    let capturedFilters: Record<string, unknown> = {};
    mocks = stubRepo(EventRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: { status: 'published', organizationId: 'org-1' } });
    await searchEvents(ctx);
    expect(capturedFilters['status']).toBe('published');
    expect(capturedFilters['organizationId']).toBe('org-1');
  });

  test('defaults to limit=20 offset=0 when not provided', async () => {
    let capturedOpts: any = {};
    mocks = stubRepo(EventRepository, {
      findMany: async (_filters: any, opts: any) => {
        capturedOpts = opts;
        return [];
      },
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: {} });
    await searchEvents(ctx);
    expect(capturedOpts.pagination.limit).toBe(20);
    expect(capturedOpts.pagination.offset).toBe(0);
  });
});
