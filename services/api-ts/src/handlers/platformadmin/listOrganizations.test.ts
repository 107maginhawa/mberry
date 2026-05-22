import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeOrg as createFakeOrg } from '@/test-utils/factories';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { listOrganizations } from './listOrganizations';

const fakeOrgs = [
  createFakeOrg({ associationId: 'assoc-1', name: 'Manila Chapter' }),
  createFakeOrg({ id: 'org-2', associationId: 'assoc-1', name: 'Cebu Chapter', status: 'trial' }),
];

describe('listOrganizations', () => {
  beforeEach(() => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, { findAll: async () => fakeOrgs });
  });

  afterEach(() => {
    restoreRepo(OrganizationRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    const res = await listOrganizations(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with paginated org list', async () => {
    const ctx = makeCtx({ _query: {} });
    const res = await listOrganizations(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(2);
    expect((res as any).body?.pagination).toBeDefined();
  });

  test('returns empty list when no orgs', async () => {
    restoreRepo(OrganizationRepository);
    stubRepo(OrganizationRepository, { findAll: async () => [] });
    const ctx = makeCtx({ _query: {} });
    const res = await listOrganizations(ctx);
    expect((res as any).body?.data).toHaveLength(0);
    expect((res as any).body?.pagination?.total).toBe(0);
  });
});
