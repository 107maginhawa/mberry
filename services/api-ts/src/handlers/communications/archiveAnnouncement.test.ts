import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { archiveAnnouncement } from './archiveAnnouncement';

describe('archiveAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('archives announcement with 200', async () => {
    const updated = { id: 'ann-1', status: 'archived' };
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent' }),
      updateStatus: async () => updated,
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });

  test('throws NotFoundError when not found', async () => {
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(archiveAnnouncement(ctx)).rejects.toThrow('Announcement not found');
  });
});
