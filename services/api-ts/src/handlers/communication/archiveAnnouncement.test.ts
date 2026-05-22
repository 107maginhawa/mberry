import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { archiveAnnouncement } from './archiveAnnouncement';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

// archiveAnnouncement calls requirePosition → OfficerTermRepository
stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });

describe('archiveAnnouncement', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent' }),
      updateStatus: async (_id: string, status: string) => ({ id: 'ann-1', status }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when announcement already archived', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'archived' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Only sent announcements can be archived');
  });
});
