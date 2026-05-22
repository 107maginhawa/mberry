import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { getAnnouncement } from './getAnnouncement';

describe('getAnnouncement', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    await expect(getAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', organizationId: 'tenant-1', title: 'Test', status: 'draft' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await getAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when announcement not found', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(getAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });
});
