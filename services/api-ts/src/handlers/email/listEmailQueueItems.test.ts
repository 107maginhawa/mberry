import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EmailQueueRepository } from './repos/queue.repo';
import { listEmailQueueItems } from './listEmailQueueItems';

describe('listEmailQueueItems', () => {
  beforeEach(() => { restoreRepo(EmailQueueRepository); });
  afterEach(() => { restoreRepo(EmailQueueRepository); });

  test('returns 403 for non-admin user', async () => {
    const ctx = makeCtx({ user: { id: 'u1', role: 'user' } });
    await expect(listEmailQueueItems(ctx)).rejects.toThrow('Admin role required');
  });

  test('returns 200 with data and pagination', async () => {
    const emails = [{ id: 'q-1', status: 'pending' }, { id: 'q-2', status: 'sent' }];
    stubRepo(EmailQueueRepository, {
      findMany: async () => emails,
      count: async () => 2,
    });
    const ctx = makeCtx({ user: { id: 'u1', role: 'admin' }, _query: {} });
    const res = await listEmailQueueItems(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toEqual(emails);
    expect(body.pagination).toBeDefined();
  });

  test('admin via comma-separated roles is allowed', async () => {
    stubRepo(EmailQueueRepository, { findMany: async () => [], count: async () => 0 });
    const ctx = makeCtx({ user: { id: 'u1', role: 'user, admin' }, _query: {} });
    const res = await listEmailQueueItems(ctx);
    expect(res.status).toBe(200);
  });

  test('builds filters from all query params and returns empty', async () => {
    let capturedFilters: any;
    stubRepo(EmailQueueRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
      count: async () => 0,
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _query: {
        status: 'pending,processing,sent',
        template: 'welcome',
        templateTags: 'onboarding',
        recipientEmail: 'a@b.com',
        priority: '5',
        scheduledOnly: 'true',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      },
    });
    const res = await listEmailQueueItems(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toEqual([]);
    expect(capturedFilters.status).toEqual(['pending', 'processing', 'sent']);
    expect(capturedFilters.template).toBe('welcome');
    expect(capturedFilters.templateTags).toBe('onboarding');
    expect(capturedFilters.recipientEmail).toBe('a@b.com');
    expect(capturedFilters.priority).toBe(5);
    expect(capturedFilters.scheduledOnly).toBe(true);
    expect(capturedFilters.dateFrom instanceof Date).toBe(true);
    expect(capturedFilters.dateTo instanceof Date).toBe(true);
  });

  test('array-form status and templateTags + invalid priority/dates ignored', async () => {
    let capturedFilters: any;
    stubRepo(EmailQueueRepository, {
      findMany: async (filters: any) => { capturedFilters = filters; return []; },
      count: async () => 0,
    });
    const ctx = makeCtx({
      user: { id: 'u1', role: 'admin' },
      _query: {
        status: ['pending', 'sent'],
        templateTags: ['a', 'b'],
        priority: 'notanumber',
        dateFrom: 'invalid-date',
        dateTo: 'also-bad',
      },
    });
    const res = await listEmailQueueItems(ctx);
    expect(res.status).toBe(200);
    expect(capturedFilters.status).toEqual(['pending', 'sent']);
    expect(capturedFilters.templateTags).toEqual(['a', 'b']);
    expect(capturedFilters.priority).toBeUndefined();
    expect(capturedFilters.dateFrom).toBeUndefined();
    expect(capturedFilters.dateTo).toBeUndefined();
  });
});
