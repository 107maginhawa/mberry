import { describe, test, expect, afterEach } from 'bun:test';
import { mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';
import { updateOrgProfile } from './updateOrgProfile';

const fakeOrg = {
  id: 'org-1',
  name: 'Philippine Dental Association',
  slug: 'pda',
  contactEmail: 'admin@pda.org',
  region: 'Manila',
  orgType: 'chapter',
  status: 'active',
};

describe('updateOrgProfile', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    mock.restore();
  });

  test('updates org profile and returns 200 when president', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => fakeOrg,
      update: async (_id: string, updates: any) => ({ ...fakeOrg, ...updates }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'PDA Updated', contactEmail: 'new@pda.org' },
    });

    const res = await updateOrgProfile(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data.name).toBe('PDA Updated');
  });

  test('returns 403 for non-president officer', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async (ctx: any) => ctx.json({ error: 'President only' }, 403),
    }));

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'Updated' },
    });

    const res = await updateOrgProfile(ctx as any);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when org does not exist', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => null,
      update: async () => null,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'missing-org' },
      _body: { name: 'Updated' },
    });

    await expect(updateOrgProfile(ctx as any)).rejects.toThrow('not found');
  });

  test('only updates allowed fields (name, contactEmail, region)', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    let capturedUpdates: any;
    mocks = stubRepo(OrganizationRepository, {
      findById: async () => fakeOrg,
      update: async (_id: string, updates: any) => { capturedUpdates = updates; return { ...fakeOrg, ...updates }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        name: 'Updated Name',
        contactEmail: 'new@pda.org',
        region: 'Cebu',
        status: 'suspended', // not allowed
        orgType: 'chapter', // not allowed
      },
    });

    await updateOrgProfile(ctx as any);
    expect(capturedUpdates.name).toBe('Updated Name');
    expect(capturedUpdates.contactEmail).toBe('new@pda.org');
    expect(capturedUpdates.region).toBe('Cebu');
    expect(capturedUpdates.status).toBeUndefined();
    expect(capturedUpdates.orgType).toBeUndefined();
  });
});
