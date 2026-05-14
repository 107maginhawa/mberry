import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { getOrganization } from './getOrganization';
import { NotFoundError } from '@/core/errors';

const fakeOrg = { id: 'org-1', associationId: 'assoc-1', name: 'Manila Chapter', status: 'active' };

describe('getOrganization', () => {
  beforeEach(() => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, { findById: async () => fakeOrg });
  });

  afterEach(() => {
    restoreRepo(OrganizationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { organizationId: 'org-1' } });
    const res = await getOrganization(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with organization', async () => {
    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await getOrganization(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe('org-1');
  });

  test('throws NotFoundError when org not found', async () => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, { findById: async () => undefined });
    const ctx = makeCtx({ _params: { organizationId: 'nonexistent' } });
    await expect(getOrganization(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
