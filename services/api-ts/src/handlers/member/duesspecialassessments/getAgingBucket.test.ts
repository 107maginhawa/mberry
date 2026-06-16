/**
 * getAgingBucket.test.ts
 *
 * Covers:
 *   - Unauthorized (no session)
 *   - Happy path — returns latest bucket from repo
 *   - Empty repo — returns zero-value defaults
 *   - When multiple buckets exist, returns the last (latest)
 *   - Zero-value defaults have correct field names
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getAgingBucket } from './getAgingBucket';
import { AgingBucketRepository } from '@/handlers/association:member/repos/dues.repo';

const FAKE_BUCKET = {
  id: 'bucket-1',
  organizationId: 'tenant-1',
  asOfDate: '2026-06-01',
  current: 10000,
  thirtyDay: 5000,
  sixtyDay: 2500,
  ninetyDay: 1000,
  overNinety: 500,
  totalOutstanding: 19000,
};

describe('getAgingBucket', () => {
  beforeEach(() => {
    restoreRepo(AgingBucketRepository);
  });

  afterEach(() => {
    restoreRepo(AgingBucketRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ session: null, user: null, database: makeMockDb() });
    await expect(getAgingBucket(ctx as any)).rejects.toThrow();
  });

  test('returns latest bucket when repo has results', async () => {
    stubRepo(AgingBucketRepository, {
      findMany: async () => [{ ...FAKE_BUCKET }],
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
    });

    const res = await getAgingBucket(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.current).toBe(10000);
    expect(body.thirtyDay).toBe(5000);
    expect(body.sixtyDay).toBe(2500);
    expect(body.ninetyDay).toBe(1000);
    expect(body.overNinety).toBe(500);
    expect(body.totalOutstanding).toBe(19000);
  });

  test('returns last element when repo has multiple buckets', async () => {
    const older = { ...FAKE_BUCKET, id: 'bucket-old', current: 1, totalOutstanding: 1 };
    const newer = { ...FAKE_BUCKET, id: 'bucket-new', current: 99999, totalOutstanding: 99999 };
    stubRepo(AgingBucketRepository, {
      findMany: async () => [older, newer],
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
    });

    const res = await getAgingBucket(ctx as any);
    const body = (res as any).body;
    // handler returns result[result.length - 1] — the newer bucket
    expect(body.current).toBe(99999);
    expect(body.totalOutstanding).toBe(99999);
  });

  test('returns zero-value defaults when no bucket exists', async () => {
    stubRepo(AgingBucketRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
    });

    const res = await getAgingBucket(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.organizationId).toBe('tenant-1');
    expect(body.current).toBe(0);
    expect(body.thirtyDay).toBe(0);
    expect(body.sixtyDay).toBe(0);
    expect(body.ninetyDay).toBe(0);
    expect(body.overNinety).toBe(0);
    expect(body.totalOutstanding).toBe(0);
    // asOfDate should be today in YYYY-MM-DD format
    expect(body.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('default bucket asOfDate is today', async () => {
    stubRepo(AgingBucketRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
    });

    const before = new Date().toISOString().split('T')[0];
    const res = await getAgingBucket(ctx as any);
    const after = new Date().toISOString().split('T')[0];

    const body = (res as any).body;
    expect(body.asOfDate >= before).toBe(true);
    expect(body.asOfDate <= after).toBe(true);
  });

  test('repo is called with ctx organizationId', async () => {
    let captured: any;
    stubRepo(AgingBucketRepository, {
      findMany: async (filters: any) => { captured = filters; return []; },
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'org-special',
      _params: { organizationId: 'org-special' },
    });

    await getAgingBucket(ctx as any);
    expect(captured.organizationId).toBe('org-special');
  });
});
