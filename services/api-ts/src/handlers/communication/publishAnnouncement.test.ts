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

  // FIX-007 (tenant isolation): the handler must fetch the announcement scoped to
  // the caller's org. An officer of org-A must NOT be able to publish org-B's
  // announcement by id. We model org-scoping in the `get` stub: it only returns
  // the row when fetched with the owning org (or unscoped, the legacy leak path).
  test('rejects cross-org publish — 404 when the announcement belongs to another org', async () => {
    stubRepo(CommunicationsRepository, {
      get: async (_id: string, orgId?: string) =>
        orgId === undefined || orgId === 'org-B'
          ? { id: 'ann-1', status: 'draft', organizationId: 'org-B' }
          : undefined,
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ organizationId: 'org-A', _params: { id: 'ann-1' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });
});
