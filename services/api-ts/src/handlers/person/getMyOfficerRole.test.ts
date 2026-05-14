import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getMyOfficerRole } from './getMyOfficerRole';

describe('getMyOfficerRole', () => {
  beforeEach(() => { restoreRepo(OfficerTermRepository); });
  afterEach(() => { restoreRepo(OfficerTermRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyOfficerRole(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await getMyOfficerRole(ctx);
    expect(res.status).toBe(200);
  });
});
