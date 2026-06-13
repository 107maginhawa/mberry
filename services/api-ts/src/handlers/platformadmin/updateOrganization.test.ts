import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { updateOrganization } from './updateOrganization';
import { NotFoundError } from '@/core/errors';

const existingOrg = { id: 'org-1', associationId: 'assoc-1', name: 'Manila Chapter', status: 'active' };
const updatedOrg = { ...existingOrg, name: 'Manila Chapter Updated' };
const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

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

  // ─── FIX-001 (G1): super-only platform mutation ──────────────────────
  // Matrix §3.7: patching an organization = super only. analyst/support rejected.
  test('returns 403 for analyst platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'analyst' },
      _params: { organizationId: 'org-1' },
      _body: { name: 'Manila Chapter Updated' },
    });
    const res = await updateOrganization(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 for support platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'support' },
      _params: { organizationId: 'org-1' },
      _body: { name: 'Manila Chapter Updated' },
    });
    const res = await updateOrganization(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 when platformAdmin context is absent', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      platformAdmin: undefined,
      _params: { organizationId: 'org-1' },
      _body: { name: 'Manila Chapter Updated' },
    });
    const res = await updateOrganization(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 with updated org', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _params: { organizationId: 'org-1' }, _body: { name: 'Manila Chapter Updated' } });
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
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _params: { organizationId: 'nonexistent' }, _body: {} });
    await expect(updateOrganization(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
