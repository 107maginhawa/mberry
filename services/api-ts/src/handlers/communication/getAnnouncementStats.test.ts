/**
 * getAnnouncementStats handler tests — RED phase
 *
 * Business rules:
 * - Returns stats for a specific announcement (recipients, views, delivery counts)
 * - Auth required
 * - Returns 404 if announcement not found
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

// ─── Fixtures ───────────────────────────────────────────

const announcementWithStats = {
  id: 'ann-1',
  organizationId: 'org-1',
  title: 'Test Announcement',
  status: 'sent',
  authorId: 'user-1',
  stats: {
    recipients: 42,
    emailSent: 40,
    pushDelivered: 35,
    inappViews: 28,
  },
};

// ─── Tests ──────────────────────────────────────────────

describe('getAnnouncementStats', () => {
  let getAnnouncementStats: typeof import('./getAnnouncementStats').getAnnouncementStats;

  beforeEach(async () => {
    restoreRepo(CommunicationsRepository);
    getAnnouncementStats = (await import('./getAnnouncementStats')).getAnnouncementStats;
  });

  afterEach(() => {
    restoreRepo(CommunicationsRepository);
  });

  test('returns stats for announcement with 200', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => announcementWithStats,
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const response = await getAnnouncementStats(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.stats.recipients).toBe(42);
    expect(response.body.data.stats.emailSent).toBe(40);
  });

  test('returns announcement without stats (stats undefined)', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ ...announcementWithStats, stats: undefined }),
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const response = await getAnnouncementStats(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.stats).toBeUndefined();
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'missing' } });
    await expect(getAnnouncementStats(ctx)).rejects.toThrow('Announcement');
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(getAnnouncementStats(ctx)).rejects.toThrow('Unauthorized');
  });
});
