import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { publishAnnouncement } from './publishAnnouncement';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('publishAnnouncement', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft' }),
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when announcement already published', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Only draft or scheduled announcements can be published');
  });
});
