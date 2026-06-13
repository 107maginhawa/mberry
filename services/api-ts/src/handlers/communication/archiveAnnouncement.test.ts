import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { archiveAnnouncement } from './archiveAnnouncement';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// Officer-term stub: the caller holds `title` in `org` and nothing elsewhere.
// archiveAnnouncement resolves org from the record and gates on
// President/Secretary in THAT org (requirePosition).
function stubOfficer(title: string, org: string) {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async (_personId: string, orgId: string) =>
      orgId === org ? [{ positionTitle: title }] : [],
  });
}

describe('archiveAnnouncement', () => {
  beforeEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path (president)', async () => {
    stubOfficer('President', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent', organizationId: 'org-1' }),
      updateStatus: async (_id: string, status: string) => ({ id: 'ann-1', status }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('returns 403 when caller is an officer without President/Secretary', async () => {
    stubOfficer('Treasurer', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent', organizationId: 'org-1' }),
      updateStatus: async (_id: string, status: string) => ({ id: 'ann-1', status }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(403);
  });

  test('throws BusinessLogicError when announcement already archived', async () => {
    stubOfficer('President', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'archived', organizationId: 'org-1' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Only sent announcements can be archived');
  });

  // Regression for the officer-mutation 403 bug (CONTINUE-53): org is resolved
  // from the record, not the :id path UUID.
  test('resolves org from the record even when ctx org is the (bogus) announcement id', async () => {
    stubOfficer('President', 'org-1');
    let writtenOrg: string | undefined;
    stubRepo(CommunicationsRepository, {
      get: async (_id: string, orgId?: string) =>
        orgId === undefined ? { id: 'ann-1', status: 'sent', organizationId: 'org-1' } : undefined,
      updateStatus: async (_id: string, status: string, _extra: any, orgId?: string) => {
        writtenOrg = orgId;
        return { id: 'ann-1', status };
      },
    });
    const ctx = makeCtx({ organizationId: 'ann-1', _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(200);
    expect(writtenOrg).toBe('org-1');
  });

  // FIX-007 (tenant isolation): an officer of org-A must NOT archive org-B's
  // announcement → 403 (no term in the record's org).
  test('rejects cross-org archive — 403 when caller has no term in the record org', async () => {
    stubOfficer('President', 'org-A');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent', organizationId: 'org-B' }),
      updateStatus: async (_id: string, status: string) => ({ id: 'ann-1', status }),
    });
    const ctx = makeCtx({ organizationId: 'org-A', _params: { id: 'ann-1' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(403);
  });
});
