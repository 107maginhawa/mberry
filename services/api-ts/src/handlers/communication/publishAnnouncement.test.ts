import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { publishAnnouncement } from './publishAnnouncement';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// Default officer stub: user is President (authorized)
function stubOfficerAsPresident() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
  });
}

describe('publishAnnouncement', () => {
  beforeEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
    stubOfficerAsPresident();
  });
  afterEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path (president)', async () => {
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

  // ─── M7: Officer role enforcement ───────────────────────
  // 403 cases removed — gate moved to requirePositionMiddleware
  // (covered by src/middleware/require-position.test.ts).

  test('allows secretary to publish', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft' }),
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });
});
