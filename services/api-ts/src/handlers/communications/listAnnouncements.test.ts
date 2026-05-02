import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { listAnnouncements } from './listAnnouncements';

describe('listAnnouncements', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns announcements with 200', async () => {
    const anns = [{ id: 'ann-1', title: 'Test' }];
    mocks = stubRepo(CommunicationsRepository, {
      list: async () => ({ data: anns, total: 1 }),
    });
    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const res = await listAnnouncements(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('returns empty array when none', async () => {
    mocks = stubRepo(CommunicationsRepository, {
      list: async () => ({ data: [], total: 0 }),
    });
    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const res = await listAnnouncements(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
