import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { archiveAnnouncement } from './archiveAnnouncement';

describe('archiveAnnouncement', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(CommunicationsRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(CommunicationsRepository);
  });

  test('archives announcement with 200', async () => {
    const updated = { id: 'ann-1', status: 'archived' };
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent' }),
      updateStatus: async () => updated,
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });

  test('throws NotFoundError when not found', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(archiveAnnouncement(ctx)).rejects.toThrow('Announcement not found');
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx);
    expect(res.status).toBe(401);
  });
});
