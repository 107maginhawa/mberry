import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { publishAnnouncement } from './publishAnnouncement';

describe('publishAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('publishes announcement with 200', async () => {
    const updated = { id: 'ann-1', status: 'sent', publishedAt: new Date() };
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft' }),
      updateStatus: async () => updated,
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
  });

  test('throws NotFoundError when not found', async () => {
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(publishAnnouncement(ctx)).rejects.toThrow('Announcement not found');
  });
});
