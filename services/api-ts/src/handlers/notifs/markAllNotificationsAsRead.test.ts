/**
 * markAllNotificationsAsRead — unit tests
 *
 * Core coverage lives in notifs-handlers.test.ts.
 * This file adds makeCtx-based auth and filter tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotificationRepository } from './repos/notification.repo';
import { markAllNotificationsAsRead } from './markAllNotificationsAsRead';

describe('markAllNotificationsAsRead', () => {
  beforeEach(() => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      markAllAsRead: async () => 3,
    });
  });

  afterEach(() => {
    restoreRepo(NotificationRepository);
  });

  test('returns 200 with markedCount', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await markAllNotificationsAsRead(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.markedCount).toBe(3);
  });

  test('returns markedCount 0 when no unread notifications', async () => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, { markAllAsRead: async () => 0 });
    const ctx = makeCtx({ _query: {} });
    const res = await markAllNotificationsAsRead(ctx);
    expect((res as any).body?.markedCount).toBe(0);
  });

  test('passes optional type filter to markAllAsRead', async () => {
    let capturedType: any = undefined;
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      markAllAsRead: async (_userId: string, type?: string) => { capturedType = type; return 2; },
    });
    const ctx = makeCtx({ _query: { type: 'billing' } });
    await markAllNotificationsAsRead(ctx);
    expect(capturedType).toBe('billing');
  });

  test('passes userId from session to repo', async () => {
    let capturedUserId = '';
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      markAllAsRead: async (userId: string) => { capturedUserId = userId; return 1; },
    });
    const ctx = makeCtx({ _query: {}, user: { id: 'u-77', role: 'user' } });
    await markAllNotificationsAsRead(ctx);
    expect(capturedUserId).toBe('u-77');
  });
});
