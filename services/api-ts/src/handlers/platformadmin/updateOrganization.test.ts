import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { updateOrganization } from './updateOrganization';
import { NotFoundError } from '@/core/errors';

const existingOrg = { id: 'org-1', associationId: 'assoc-1', name: 'Manila Chapter', status: 'active' };
const updatedOrg = { ...existingOrg, name: 'Manila Chapter Updated' };

describe('updateOrganization', () => {
  beforeEach(() => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, {
      findById: async () => existingOrg,
      update: async () => updatedOrg,
    });
  });

  afterEach(() => {
    restoreRepo(OrganizationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { organizationId: 'org-1' }, _body: {} });
    const res = await updateOrganization(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with updated org', async () => {
    const ctx = makeCtx({ _params: { organizationId: 'org-1' }, _body: { name: 'Manila Chapter Updated' } });
    const res = await updateOrganization(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.name).toBe('Manila Chapter Updated');
  });

  test('throws NotFoundError when org not found', async () => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, {
      findById: async () => undefined,
      update: async () => updatedOrg,
    });
    const ctx = makeCtx({ _params: { organizationId: 'nonexistent' }, _body: {} });
    await expect(updateOrganization(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
