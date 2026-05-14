import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';
import { getOrgProfile } from './getOrgProfile';

const fakeOrg = {
  id: 'org-1',
  name: 'Philippine Dental Association',
  slug: 'pda',
  contactEmail: 'admin@pda.org',
  region: 'Manila',
  orgType: 'chapter',
  status: 'active',
};

describe('getOrgProfile', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns org profile with 200', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => fakeOrg,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getOrgProfile(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data.id).toBe('org-1');
    expect((res as any).body.data.name).toBe('Philippine Dental Association');
  });

  test('throws NotFoundError when org does not exist', async () => {
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => null,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'missing-org' },
    });

    await expect(getOrgProfile(ctx as any)).rejects.toThrow('not found');
  });

  test('returns empty strings for missing optional fields', async () => {
    const minimalOrg = { ...fakeOrg, contactEmail: null, region: null };
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => minimalOrg,
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await getOrgProfile(ctx as any);
    expect((res as any).body.data.contactEmail).toBe('');
    expect((res as any).body.data.description).toBe('');
  });
});
