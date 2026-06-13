import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { publishAnnouncement } from './publishAnnouncement';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// Officer-term stub: the caller holds `title` in `org` and nothing elsewhere.
// publishAnnouncement resolves org from the announcement record and gates on
// President/Secretary in THAT org (requirePosition), so the stub must be
// org-aware to model tenant isolation correctly.
function stubOfficer(title: string, org: string) {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async (_personId: string, orgId: string) =>
      orgId === org ? [{ positionTitle: title }] : [],
  });
}

describe('publishAnnouncement', () => {
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
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path (president)', async () => {
    stubOfficer('President', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft', organizationId: 'org-1' }),
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('allows secretary to publish', async () => {
    stubOfficer('Secretary', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft', organizationId: 'org-1' }),
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('returns 403 when caller is an officer without President/Secretary', async () => {
    stubOfficer('Treasurer', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft', organizationId: 'org-1' }),
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(403);
  });

  test('throws BusinessLogicError when announcement already published', async () => {
    stubOfficer('President', 'org-1');
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent', organizationId: 'org-1' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Only draft or scheduled announcements can be published');
  });

  // Regression for the officer-publish 403 bug (CONTINUE-53). The route is
  // /communications/announcements/:id/publish — the only path UUID is the
  // announcement id, which the org-context middleware's UUID-from-path fallback
  // mistakes for organizationId. The handler must derive org from the record so
  // the position check (and the scoped write) run against the right org.
  test('resolves org from the record even when ctx org is the (bogus) announcement id', async () => {
    stubOfficer('President', 'org-1');
    let writtenOrg: string | undefined;
    stubRepo(CommunicationsRepository, {
      get: async (_id: string, orgId?: string) =>
        orgId === undefined ? { id: 'ann-1', status: 'draft', organizationId: 'org-1' } : undefined,
      updateStatus: async (_id: string, status: string, extra: any, orgId?: string) => {
        writtenOrg = orgId;
        return { id: 'ann-1', status, ...extra };
      },
    });
    // ctx.organizationId is the announcement id — exactly what the broken
    // middleware would set for an id-only route.
    const ctx = makeCtx({ organizationId: 'ann-1', _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
    expect(writtenOrg).toBe('org-1');
  });

  // FIX-007 (tenant isolation): an officer of org-A must NOT publish org-B's
  // announcement. With org derived from the record, the caller holds no term in
  // org-B → 403.
  test('rejects cross-org publish — 403 when caller has no term in the record org', async () => {
    stubOfficer('President', 'org-A'); // caller is an officer of org-A only
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft', organizationId: 'org-B' }),
      updateStatus: async (_id: string, status: string, extra: any) => ({ id: 'ann-1', status, ...extra }),
    });
    const ctx = makeCtx({ organizationId: 'org-A', _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(403);
  });
});
