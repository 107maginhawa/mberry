import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeOrg as createFakeOrg } from '@/test-utils/factories';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { updateOrgProfile } from './updateOrgProfile';

const fakeOrg = createFakeOrg({
  contactEmail: 'admin@pda.org',
  region: 'Manila',
  orgType: 'chapter',
});

describe('updateOrgProfile', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('updates org profile and returns 200 when president', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
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

  // 403 for non-president officer is now enforced by requirePositionMiddleware
  // at the route level — see middleware/require-position.test.ts.


  test('throws NotFoundError when org does not exist', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
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
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
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
