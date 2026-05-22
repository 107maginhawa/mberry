/**
 * getNotification — unit tests
 *
 * Core coverage lives in notifs-handlers.test.ts.
 * This file adds makeCtx-based auth and ownership tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeNotification } from '@/test-utils/factories';
import { NotificationRepository } from './repos/notification.repo';
import { getNotification } from './getNotification';

const fakeNotif = fakeNotification({
  relatedEntityType: null,
  relatedEntity: null,
  consentValidated: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'system',
  updatedBy: 'system',
  version: 1,
});

describe('getNotification', () => {
  beforeEach(() => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findOneByIdAndRecipient: async () => fakeNotif,
    });
  });

  afterEach(() => {
    restoreRepo(NotificationRepository);
  });

  test('returns 200 with notification data', async () => {
    const ctx = makeCtx({ _params: { notif: 'n-1' } });
    const res = await getNotification(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe('n-1');
  });

  test('throws when notification not found (repo returns null)', async () => {
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findOneByIdAndRecipient: async () => null,
    });
    const ctx = makeCtx({ _params: { notif: 'nonexistent' } });
    await expect(getNotification(ctx)).rejects.toThrow();
  });

  test('scopes to authenticated user (passes userId to repo)', async () => {
    let capturedRecipient = '';
    restoreRepo(NotificationRepository);
    stubRepo(NotificationRepository, {
      findOneByIdAndRecipient: async (_id: string, recipient: string) => {
        capturedRecipient = recipient;
        return fakeNotif;
      },
    });
    const ctx = makeCtx({ _params: { notif: 'n-1' }, user: { id: 'u-99', role: 'user' } });
    await getNotification(ctx);
    expect(capturedRecipient).toBe('u-99');
  });
});
