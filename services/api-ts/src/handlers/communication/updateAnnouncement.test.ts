import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { updateAnnouncement } from './updateAnnouncement';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('updateAnnouncement', () => {
  beforeEach(() => { restoreRepo(CommunicationsRepository); });
  afterEach(() => { restoreRepo(CommunicationsRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'ann-1' }, _body: {} });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    const draft = { id: 'ann-1', status: 'draft', title: 'Test' };
    stubRepo(CommunicationsRepository, {
      get: async () => draft,
      update: async (_id: string, data: any) => ({ ...draft, ...data }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' }, _body: { title: 'Updated' } });
    const res = await updateAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws BusinessLogicError when announcement is not draft', async () => {
    stubRepo(CommunicationsRepository, {
      get: async () => ({ id: 'ann-1', status: 'sent' }),
    });
    const ctx = makeCtx({ _params: { id: 'ann-1' }, _body: {} });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Only draft announcements can be updated');
  });
});
