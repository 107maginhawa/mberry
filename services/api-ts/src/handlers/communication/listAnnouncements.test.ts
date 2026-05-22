import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { listAnnouncements } from './listAnnouncements';

describe('listAnnouncements', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { organizationId: 'org-1' }, _query: {} });
    await expect(listAnnouncements(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(CommunicationsRepository, {
      list: async () => ({ data: [], total: 0 }),
    });
    const ctx = makeCtx({ _params: { organizationId: 'org-1' }, _query: {} });
    const res = await listAnnouncements(ctx as any);
    expect(res.status).toBe(200);
  });
});
