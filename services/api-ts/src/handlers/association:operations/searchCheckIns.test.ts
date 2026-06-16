import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { searchCheckIns } from './searchCheckIns';
import { CheckInRepository } from './repos/events.repo';

describe('searchCheckIns — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(403);
  });
});

describe('searchCheckIns — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CheckInRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CheckInRepository);
  });

  test('returns paginated results with totalCount', async () => {
    const checkIns = [
      { id: 'ci-1', eventId: 'evt-1', personId: 'p-1' },
      { id: 'ci-2', eventId: 'evt-1', personId: 'p-2' },
    ];
    mocks = stubRepo(CheckInRepository, {
      findMany: async () => checkIns,
      count: async () => 2,
    });

    const ctx = makeCtx({ _query: {} });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toHaveLength(2);
    expect((response as any).body.totalCount).toBe(2);
    expect((response as any).body.limit).toBe(20);
    expect((response as any).body.offset).toBe(0);
  });

  test('applies eventId filter', async () => {
    let capturedFilters: Record<string, unknown> = {};
    mocks = stubRepo(CheckInRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: { eventId: 'evt-42' } });
    await searchCheckIns(ctx);
    expect(capturedFilters['eventId']).toBe('evt-42');
  });

  test('applies personId filter', async () => {
    let capturedFilters: Record<string, unknown> = {};
    mocks = stubRepo(CheckInRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: { personId: 'person-99' } });
    await searchCheckIns(ctx);
    expect(capturedFilters['personId']).toBe('person-99');
  });

  test('respects custom limit and offset', async () => {
    let capturedOpts: Record<string, unknown> = {};
    mocks = stubRepo(CheckInRepository, {
      findMany: async (_f: any, opts: any) => { capturedOpts = opts; return []; },
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: { limit: '5', offset: '10' } });
    await searchCheckIns(ctx);
    expect((capturedOpts as any).pagination?.limit).toBe(5);
    expect((capturedOpts as any).pagination?.offset).toBe(10);
  });

  test('defaults limit=20, offset=0 when not provided', async () => {
    let capturedOpts: Record<string, unknown> = {};
    mocks = stubRepo(CheckInRepository, {
      findMany: async (_f: any, opts: any) => { capturedOpts = opts; return []; },
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: {} });
    await searchCheckIns(ctx);
    expect((capturedOpts as any).pagination?.limit).toBe(20);
    expect((capturedOpts as any).pagination?.offset).toBe(0);
  });

  test('returns empty data array when no results', async () => {
    mocks = stubRepo(CheckInRepository, {
      findMany: async () => [],
      count: async () => 0,
    });

    const ctx = makeCtx({ _query: { eventId: 'nonexistent' } });
    const response = await searchCheckIns(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.data).toEqual([]);
    expect((response as any).body.totalCount).toBe(0);
  });
});
