import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { createAnnouncement } from './createAnnouncement';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('createAnnouncement', () => {
  beforeEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
    // Default: caller is a President (qualifying officer)
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
  });
  afterEach(() => {
    restoreRepo(CommunicationsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { organizationId: 'org-1' }, _body: { title: 'T', body: 'B' } });
    await expect(createAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  // 403 for non-president/non-secretary is now enforced by
  // requirePositionMiddleware(President, Secretary) at the route level —
  // see middleware/require-position.test.ts.


  test('returns 201 on happy path for president', async () => {
    stubRepo(CommunicationsRepository, {
      create: async (data: any) => ({ id: 'ann-1', ...data }),
    });
    const ctx = makeCtx({ _params: { organizationId: 'org-1' }, _body: { title: 'Test', body: 'Hello' } });
    const res = await createAnnouncement(ctx as any);
    expect(res.status).toBe(201);
  });
});
