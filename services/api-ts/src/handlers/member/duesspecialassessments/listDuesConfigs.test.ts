/**
 * listDuesConfigs.test.ts
 *
 * Covers:
 *   - Unauthorized (no session)
 *   - Happy path — returns data + pagination envelope
 *   - Pagination math: totalPages, currentPage, hasNextPage, hasPreviousPage
 *   - Limit clamp to 100
 *   - Default offset/limit fallbacks
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesConfig } from '@/test-utils/factories';
import { listDuesConfigs } from './listDuesConfigs';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';

const FAKE_CONFIG = fakeDuesConfig({ id: 'cfg-1', organizationId: 'tenant-1' });

describe('listDuesConfigs', () => {
  beforeEach(() => {
    restoreRepo(DuesConfigRepository);
  });

  afterEach(() => {
    restoreRepo(DuesConfigRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, database: makeMockDb() });
    await expect(listDuesConfigs(ctx as any)).rejects.toThrow();
  });

  test('happy path — returns data with pagination', async () => {
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async () => ({
        data: [{ ...FAKE_CONFIG }],
        totalCount: 1,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    const res = await listDuesConfigs(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('cfg-1');
  });

  test('pagination defaults: offset=0, limit=20', async () => {
    let captured: any;
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        captured = opts;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    await listDuesConfigs(ctx as any);
    expect(captured.pagination.offset).toBe(0);
    expect(captured.pagination.limit).toBe(20);
  });

  test('limit is clamped to 100 even if query passes 200', async () => {
    let captured: any;
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async (_filters: any, opts: any) => {
        captured = opts;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: { limit: 200, offset: 0 },
    });

    await listDuesConfigs(ctx as any);
    expect(captured.pagination.limit).toBe(100);
  });

  test('pagination math — page 2 of 3 (30 total, limit 10, offset 10)', async () => {
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async () => ({
        data: Array.from({ length: 10 }, (_, i) => ({ ...FAKE_CONFIG, id: `cfg-${i}` })),
        totalCount: 30,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: { limit: 10, offset: 10 },
    });

    const res = await listDuesConfigs(ctx as any);
    const body = (res as any).body;
    expect(body.pagination.totalCount).toBe(30);
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.currentPage).toBe(2);
    expect(body.pagination.hasNextPage).toBe(true);
    expect(body.pagination.hasPreviousPage).toBe(true);
    expect(body.pagination.count).toBe(10);
  });

  test('pagination math — last page (30 total, limit 10, offset 20)', async () => {
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async () => ({
        data: Array.from({ length: 10 }, (_, i) => ({ ...FAKE_CONFIG, id: `cfg-${i}` })),
        totalCount: 30,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: { limit: 10, offset: 20 },
    });

    const res = await listDuesConfigs(ctx as any);
    const body = (res as any).body;
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.currentPage).toBe(3);
    expect(body.pagination.hasNextPage).toBe(false);
    expect(body.pagination.hasPreviousPage).toBe(true);
  });

  test('pagination math — first page, only 1 page total', async () => {
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async () => ({
        data: [{ ...FAKE_CONFIG }],
        totalCount: 1,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: { limit: 20, offset: 0 },
    });

    const res = await listDuesConfigs(ctx as any);
    const body = (res as any).body;
    expect(body.pagination.totalPages).toBe(1);
    expect(body.pagination.currentPage).toBe(1);
    expect(body.pagination.hasNextPage).toBe(false);
    expect(body.pagination.hasPreviousPage).toBe(false);
  });

  test('empty result returns empty data array', async () => {
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    const res = await listDuesConfigs(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(0);
    expect(body.pagination.totalCount).toBe(0);
  });

  test('passes organizationId from ctx (not query) to repo', async () => {
    let capturedFilters: any;
    stubRepo(DuesConfigRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'ctx-org-99',
      _query: {},
    });

    await listDuesConfigs(ctx as any);
    expect(capturedFilters.organizationId).toBe('ctx-org-99');
  });
});
