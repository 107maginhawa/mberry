import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listWaitlistEntries } from './listWaitlistEntries';
import { WaitlistEntryRepository } from './repos/events.repo';

describe('listWaitlistEntries — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { eventId: 'evt-1' } });
    const response = await listWaitlistEntries(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { eventId: 'evt-1' } });
    const response = await listWaitlistEntries(ctx);
    expect(response.status).toBe(403);
  });
});

describe('listWaitlistEntries — happy path', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(WaitlistEntryRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(WaitlistEntryRepository);
  });

  test('returns waitlist entries with totalCount for event', async () => {
    const entries = [
      { id: 'wl-1', eventId: 'evt-1', personId: 'person-1', position: 1 },
      { id: 'wl-2', eventId: 'evt-1', personId: 'person-2', position: 2 },
    ];
    mocks = stubRepo(WaitlistEntryRepository, {
      findMany: async () => entries,
      count: async () => 2,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _query: { limit: '10', offset: '0' },
    });
    const response = await listWaitlistEntries(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(2);
    expect((response as any).body.totalCount).toBe(2);
  });

  test('passes eventId filter to repo', async () => {
    let capturedFilters: Record<string, unknown> = {};
    mocks = stubRepo(WaitlistEntryRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
      count: async () => 0,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-special' },
      _query: {},
    });
    await listWaitlistEntries(ctx);
    expect(capturedFilters['eventId']).toBe('evt-special');
  });

  test('returns correct limit and offset in response', async () => {
    mocks = stubRepo(WaitlistEntryRepository, {
      findMany: async () => [],
      count: async () => 0,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _query: { limit: '5', offset: '15' },
    });
    const response = await listWaitlistEntries(ctx);
    expect((response as any).body.limit).toBe(5);
    expect((response as any).body.offset).toBe(15);
  });

  test('defaults to limit=20 offset=0 when not provided', async () => {
    let capturedOpts: any = {};
    mocks = stubRepo(WaitlistEntryRepository, {
      findMany: async (_filters: any, opts: any) => {
        capturedOpts = opts;
        return [];
      },
      count: async () => 0,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-1' },
      _query: {},
    });
    await listWaitlistEntries(ctx);
    expect(capturedOpts.pagination.limit).toBe(20);
    expect(capturedOpts.pagination.offset).toBe(0);
  });

  test('returns empty data array when no entries', async () => {
    mocks = stubRepo(WaitlistEntryRepository, {
      findMany: async () => [],
      count: async () => 0,
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-empty' },
      _query: {},
    });
    const response = await listWaitlistEntries(ctx);
    expect((response as any).body.data).toHaveLength(0);
    expect((response as any).body.totalCount).toBe(0);
  });
});
