import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { deleteAnnouncement } from './deleteAnnouncement';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('deleteAnnouncement', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'draft' }),
      delete: async () => undefined,
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await deleteAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when announcement is not draft', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Only draft announcements can be deleted');
  });

  // FIX-007 (tenant isolation): an officer of org-A must NOT delete org-B's
  // draft announcement by id. The handler must fetch scoped to the caller's org.
  test('rejects cross-org delete — 404 when the announcement belongs to another org', async () => {
    let deleted = false;
    stubRepo(CommunicationsRepository, {
      get: async (_id: string, orgId?: string) =>
        orgId === undefined || orgId === 'org-B'
          ? { id: 'ann-1', status: 'draft', organizationId: 'org-B' }
          : undefined,
      delete: async () => { deleted = true; },
    });
    const ctx = makeCtx({ organizationId: 'org-A', _params: { id: 'ann-1' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Announcement');
    expect(deleted).toBe(false);
  });
});
