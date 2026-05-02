import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { getAnnouncement } from './getAnnouncement';

describe('getAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns announcement with 200', async () => {
    const ann = { id: 'ann-1', title: 'Test', stats: undefined };
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => ann,
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await getAnnouncement(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('ann-1');
  });

  test('throws NotFoundError when not found', async () => {
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(getAnnouncement(ctx)).rejects.toThrow('Announcement not found');
  });
});
