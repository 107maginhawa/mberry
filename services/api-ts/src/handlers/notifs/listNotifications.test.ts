/**
 * listNotifications — unit tests
 *
 * Core coverage lives in notifs-handlers.test.ts.
 * This file adds makeCtx-based auth and boundary tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotificationRepository } from './repos/notification.repo';
import { listNotifications } from './listNotifications';

const fakeResult = { data: [{ id: 'n-1', type: 'system', status: 'sent' }], totalCount: 1 };

describe('listNotifications', () => {
  beforeEach(() => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findManyByRecipient: async () => fakeResult,
    });
  });

  afterEach(() => {
    restoreRepo(NotificationRepository);
  });

  test('returns 200 with paginated notifications', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await listNotifications(ctx);
    expect(res.status).toBe(200);
  });

  test('passes userId from session to repo', async () => {
    let capturedId = '';
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findManyByRecipient: async (id: string) => { capturedId = id; return fakeResult; },
    });
    const ctx = makeCtx({ _query: {}, user: { id: 'u-42', role: 'user' } });
    await listNotifications(ctx);
    expect(capturedId).toBe('u-42');
  });

  test('forwards query filters to repo', async () => {
    let capturedFilters: any = null;
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findManyByRecipient: async (_id: string, filters: any) => { capturedFilters = filters; return fakeResult; },
    });
    const ctx = makeCtx({ _query: { type: 'billing', status: 'sent' } });
    await listNotifications(ctx);
    expect(capturedFilters?.type).toBe('billing');
    expect(capturedFilters?.status).toBe('sent');
  });

  test('returns empty list when no notifications', async () => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findManyByRecipient: async () => ({ data: [], totalCount: 0 }),
    });
    const ctx = makeCtx({ _query: {} });
    const res = await listNotifications(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(0);
  });
});
