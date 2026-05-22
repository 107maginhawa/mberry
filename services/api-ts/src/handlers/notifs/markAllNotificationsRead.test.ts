/**
 * markAllNotificationsRead — unit tests
 *
 * Core coverage lives in notifs-handlers.test.ts.
 * This file adds makeCtx-based auth guard and basic path tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotificationRepository } from './repos/notification.repo';
import { markAllNotificationsRead } from './markAllNotificationsRead';
import { UnauthorizedError } from '@/core/errors';

describe('markAllNotificationsRead', () => {
  beforeEach(() => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      markAllAsRead: async () => 2,
    });
  });

  afterEach(() => {
    restoreRepo(NotificationRepository);
  });

  test('returns 200 with success:true when authenticated', async () => {
    const ctx = makeCtx();
    const res = await markAllNotificationsRead(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.success).toBe(true);
  });

  test('throws UnauthorizedError when user is null', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(markAllNotificationsRead(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('passes userId to markAllAsRead without type filter', async () => {
    let capturedArgs: any[] = [];
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      markAllAsRead: async (...args: any[]) => { capturedArgs = args; return 5; },
    });
    const ctx = makeCtx({ user: { id: 'u-55', role: 'user' } });
    await markAllNotificationsRead(ctx);
    expect(capturedArgs[0]).toBe('u-55');
    // No second arg (no type filter)
    expect(capturedArgs.length).toBe(1);
  });
});
