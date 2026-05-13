/**
 * Tests for untested notifs handlers:
 *   - getNotification
 *   - listNotifications
 *   - markAllNotificationsAsRead
 *   - markAllNotificationsRead
 *
 * Pattern follows markNotificationAsRead.test.ts — local makeCtx + prototype stubs.
 *
 * NOTE on near-duplicate handlers:
 *   markAllNotificationsAsRead (POST /notifications/read-all) — ValidatedContext,
 *     accepts optional ?type= filter, returns { markedCount }.
 *   markAllNotificationsRead (POST /notifs/read-all) — BaseContext,
 *     explicit UnauthorizedError guard, no type filter, returns { success: true }.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { getNotification } from './getNotification';
import { listNotifications } from './listNotifications';
import { markAllNotificationsAsRead } from './markAllNotificationsAsRead';
import { markAllNotificationsRead } from './markAllNotificationsRead';
import { NotificationRepository } from './repos/notification.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { Notification } from './repos/notification.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    organizationId: 'org-1',
    recipient: 'user-1',
    type: 'system',
    channel: 'in-app',
    title: 'Test',
    message: 'Hello',
    status: 'sent',
    sentAt: new Date(),
    readAt: null,
    deliveredAt: null,
    scheduledAt: null,
    relatedEntityType: null,
    relatedEntity: null,
    consentValidated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    version: 1,
    ...overrides,
  } as unknown as Notification;
}

function makeUser(id = 'user-1') {
  return { id, role: 'user', email: 'user@test.com' };
}

// ---------------------------------------------------------------------------
// Context builders (mirroring existing test pattern)
// ---------------------------------------------------------------------------

/** Context for getNotification — valid('param') returns { notif } */
function makeGetCtx(opts: { userId?: string; notifId?: string; logger?: any } = {}) {
  const userId = opts.userId ?? 'user-1';
  const notifId = opts.notifId ?? 'notif-1';
  const logger = opts.logger ?? { info: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: makeUser(userId),
        database: {},
        logger,
      };
      return store[key];
    },
    req: {
      valid: (target: string) => {
        if (target === 'param') return { notif: notifId };
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

/** Context for listNotifications — valid('query') returns pagination + filter params */
function makeListCtx(opts: {
  userId?: string;
  query?: Record<string, any>;
  logger?: any;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const queryValues = opts.query ?? {};
  const logger = opts.logger ?? { info: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: makeUser(userId),
        database: {},
        logger,
      };
      return store[key];
    },
    req: {
      valid: (target: string) => {
        if (target === 'query') return queryValues;
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

/** Context for markAllNotificationsAsRead — valid('query') returns { type? } */
function makeMarkAllAsReadCtx(opts: {
  userId?: string;
  type?: string;
  logger?: any;
} = {}) {
  const userId = opts.userId ?? 'user-1';
  const logger = opts.logger ?? { info: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: makeUser(userId),
        database: {},
        logger,
      };
      return store[key];
    },
    req: {
      valid: (target: string) => {
        if (target === 'query') return { type: opts.type };
        return {};
      },
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

/** Context for markAllNotificationsRead — BaseContext, no validated query */
function makeMarkAllReadCtx(opts: { userId?: string | null; logger?: any } = {}) {
  const userId = 'userId' in opts ? opts.userId : 'user-1';
  const logger = opts.logger ?? { info: () => {} };

  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => {
      const store: Record<string, any> = {
        user: userId ? makeUser(userId) : null,
        database: {},
        logger,
      };
      return store[key];
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

// ---------------------------------------------------------------------------
// getNotification
// ---------------------------------------------------------------------------

describe('getNotification', () => {
  let findOneByIdAndRecipient: ReturnType<typeof mock>;

  beforeEach(() => {
    const notification = makeNotification();
    findOneByIdAndRecipient = mock(async () => notification);
    NotificationRepository.prototype.findOneByIdAndRecipient = findOneByIdAndRecipient as any;
    PersonRepository.prototype.findOneById = mock(async () => null) as any;
  });

  test('returns 200 with notification', async () => {
    const ctx = makeGetCtx();
    await getNotification(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.id).toBe('notif-1');
    expect(data.type).toBe('system');
  });

  test('calls findOneByIdAndRecipient with correct ids', async () => {
    const ctx = makeGetCtx({ userId: 'user-42', notifId: 'notif-abc' });
    await getNotification(ctx);

    expect(findOneByIdAndRecipient).toHaveBeenCalledWith('notif-abc', 'user-42');
  });

  test('throws NotFoundError when notification not found', async () => {
    findOneByIdAndRecipient = mock(async () => null);
    NotificationRepository.prototype.findOneByIdAndRecipient = findOneByIdAndRecipient as any;

    const ctx = makeGetCtx({ notifId: 'nonexistent' });
    await expect(getNotification(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when notification belongs to another user', async () => {
    // Repo returns null for wrong recipient — ownership enforced at repo level
    findOneByIdAndRecipient = mock(async () => null);
    NotificationRepository.prototype.findOneByIdAndRecipient = findOneByIdAndRecipient as any;

    const ctx = makeGetCtx({ userId: 'other-user', notifId: 'notif-1' });
    await expect(getNotification(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('logs audit info', async () => {
    const logInfo = mock(() => {});
    const ctx = makeGetCtx({ logger: { info: logInfo }, userId: 'user-xyz', notifId: 'notif-xyz' });
    await getNotification(ctx);

    expect(logInfo).toHaveBeenCalledTimes(1);
    const [logArg] = (logInfo as ReturnType<typeof mock>).mock.calls[0];
    expect(logArg).toMatchObject({ userId: 'user-xyz', notificationId: 'notif-xyz' });
  });
});

// ---------------------------------------------------------------------------
// listNotifications
// ---------------------------------------------------------------------------

describe('listNotifications', () => {
  let findManyByRecipient: ReturnType<typeof mock>;

  beforeEach(() => {
    const notifications = [makeNotification(), makeNotification({ id: 'notif-2' })];
    findManyByRecipient = mock(async () => ({
      data: notifications,
      totalCount: 2,
    }));
    NotificationRepository.prototype.findManyByRecipient = findManyByRecipient as any;
    PersonRepository.prototype.findOneById = mock(async () => null) as any;
  });

  test('returns 200 with paginated data', async () => {
    const ctx = makeListCtx();
    await listNotifications(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination).toBeDefined();
  });

  test('passes userId as recipientId to repo', async () => {
    const ctx = makeListCtx({ userId: 'user-42' });
    await listNotifications(ctx);

    expect(findManyByRecipient).toHaveBeenCalledTimes(1);
    const [recipientId] = (findManyByRecipient as ReturnType<typeof mock>).mock.calls[0];
    expect(recipientId).toBe('user-42');
  });

  test('returns empty array when no notifications', async () => {
    findManyByRecipient = mock(async () => ({ data: [], totalCount: 0 }));
    NotificationRepository.prototype.findManyByRecipient = findManyByRecipient as any;

    const ctx = makeListCtx();
    await listNotifications(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.data).toHaveLength(0);
  });

  test('forwards query filters to repo', async () => {
    const ctx = makeListCtx({ query: { type: 'billing', status: 'sent' } });
    await listNotifications(ctx);

    expect(findManyByRecipient).toHaveBeenCalledTimes(1);
    const [, filters] = (findManyByRecipient as ReturnType<typeof mock>).mock.calls[0];
    expect(filters.type).toBe('billing');
    expect(filters.status).toBe('sent');
  });

  test('logs audit info with result counts', async () => {
    const logInfo = mock(() => {});
    const ctx = makeListCtx({ logger: { info: logInfo }, userId: 'user-xyz' });
    await listNotifications(ctx);

    expect(logInfo).toHaveBeenCalledTimes(1);
    const [logArg] = (logInfo as ReturnType<typeof mock>).mock.calls[0];
    expect(logArg).toMatchObject({ userId: 'user-xyz', resultCount: 2, totalCount: 2 });
  });
});

// ---------------------------------------------------------------------------
// markAllNotificationsAsRead (POST /notifications/read-all — ValidatedContext)
// ---------------------------------------------------------------------------

describe('markAllNotificationsAsRead', () => {
  let markAllAsRead: ReturnType<typeof mock>;

  beforeEach(() => {
    markAllAsRead = mock(async () => 3);
    NotificationRepository.prototype.markAllAsRead = markAllAsRead as any;
    PersonRepository.prototype.findOneById = mock(async () => null) as any;
  });

  test('returns 200 with markedCount', async () => {
    const ctx = makeMarkAllAsReadCtx();
    await markAllNotificationsAsRead(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.markedCount).toBe(3);
  });

  test('calls markAllAsRead with userId', async () => {
    const ctx = makeMarkAllAsReadCtx({ userId: 'user-42' });
    await markAllNotificationsAsRead(ctx);

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
    const [userId] = (markAllAsRead as ReturnType<typeof mock>).mock.calls[0];
    expect(userId).toBe('user-42');
  });

  test('passes optional type filter to markAllAsRead', async () => {
    const ctx = makeMarkAllAsReadCtx({ type: 'billing' });
    await markAllNotificationsAsRead(ctx);

    const [, typeArg] = (markAllAsRead as ReturnType<typeof mock>).mock.calls[0];
    expect(typeArg).toBe('billing');
  });

  test('returns markedCount 0 when no unread notifications', async () => {
    markAllAsRead = mock(async () => 0);
    NotificationRepository.prototype.markAllAsRead = markAllAsRead as any;

    const ctx = makeMarkAllAsReadCtx();
    await markAllNotificationsAsRead(ctx);

    const { data } = ctx._captured();
    expect(data.markedCount).toBe(0);
  });

  test('logs audit info with type and markedCount', async () => {
    const logInfo = mock(() => {});
    const ctx = makeMarkAllAsReadCtx({ logger: { info: logInfo }, userId: 'user-xyz', type: 'security' });
    await markAllNotificationsAsRead(ctx);

    expect(logInfo).toHaveBeenCalledTimes(1);
    const [logArg] = (logInfo as ReturnType<typeof mock>).mock.calls[0];
    expect(logArg).toMatchObject({ userId: 'user-xyz', type: 'security', markedCount: 3 });
  });
});

// ---------------------------------------------------------------------------
// markAllNotificationsRead (POST /notifs/read-all — BaseContext)
//
// Key differences from markAllNotificationsAsRead:
//   1. Uses BaseContext (no validated query) — no type filter
//   2. Has explicit UnauthorizedError guard (checks `if (!user)`)
//   3. Returns { success: true } instead of { markedCount }
// ---------------------------------------------------------------------------

describe('markAllNotificationsRead', () => {
  let markAllAsRead: ReturnType<typeof mock>;

  beforeEach(() => {
    markAllAsRead = mock(async () => 3);
    NotificationRepository.prototype.markAllAsRead = markAllAsRead as any;
    PersonRepository.prototype.findOneById = mock(async () => null) as any;
  });

  test('returns 200 with success: true', async () => {
    const ctx = makeMarkAllReadCtx();
    await markAllNotificationsRead(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  test('throws UnauthorizedError when user is null (auth guard)', async () => {
    const ctx = makeMarkAllReadCtx({ userId: null });
    await expect(markAllNotificationsRead(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('calls markAllAsRead with userId (no type filter)', async () => {
    const ctx = makeMarkAllReadCtx({ userId: 'user-42' });
    await markAllNotificationsRead(ctx);

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
    const args = (markAllAsRead as ReturnType<typeof mock>).mock.calls[0];
    expect(args[0]).toBe('user-42');
    // No second argument (type) — unlike markAllNotificationsAsRead
    expect(args.length).toBe(1);
  });
});
