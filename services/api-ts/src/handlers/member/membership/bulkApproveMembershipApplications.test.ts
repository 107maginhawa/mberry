import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeApplication as createFakeApplication } from '@/test-utils/factories';
import { bulkApproveMembershipApplications } from './bulkApproveMembershipApplications';
import { MembershipApplicationRepository, MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeApplication = createFakeApplication({
  organizationId: 'tenant-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
});

const fakeApplication2 = createFakeApplication({
  id: 'app-2',
  organizationId: 'tenant-1',
  personId: 'person-2',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
});

const crossOrgApplication = {
  id: 'app-cross',
  organizationId: 'other-org',
  personId: 'person-3',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
};

// ─── Tests ──────────────────────────────────────────────

describe('bulkApproveMembershipApplications', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipApplicationRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipApplicationRepository);
    restoreRepo(MembershipRepository);
  });

  // Test 1: Bulk approve 2 valid applications
  test('bulk approves 2 valid applications and returns succeeded list', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }] });
    stubRepo(MembershipApplicationRepository, {
      findOneById: async (id: string) => {
        if (id === 'app-1') return { ...fakeApplication };
        if (id === 'app-2') return { ...fakeApplication2 };
        return undefined;
      },
      updateOneById: async (_id: string, data: any) => ({ id: _id, ...data }),
    });
    stubRepo(MembershipRepository, {
      createOne: async () => ({ id: 'mem-new' }),
    });

    const ctx = makeCtx({ _body: { applicationIds: ['app-1', 'app-2'] } });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(200);
    expect((response as any).body.succeeded).toContain('app-1');
    expect((response as any).body.succeeded).toContain('app-2');
    expect((response as any).body.failed).toHaveLength(0);
  });

  // Test 2: Not-found application returns failed with reason
  test('not-found application returns failed entry with "Not found" reason', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipApplicationRepository, {
      findOneById: async () => undefined,
    });
    stubRepo(MembershipRepository, { createOne: async () => ({ id: 'mem-1' }) });

    const ctx = makeCtx({ _body: { applicationIds: ['nonexistent'] } });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(200);
    expect((response as any).body.succeeded).toHaveLength(0);
    expect((response as any).body.failed).toHaveLength(1);
    expect((response as any).body.failed[0].id).toBe('nonexistent');
    expect((response as any).body.failed[0].reason).toMatch(/not found/i);
  });

  // Test 3: Already approved application returns failed with reason
  test('application with status "approved" returns failed with "not approvable" reason', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'approved' }),
    });
    stubRepo(MembershipRepository, { createOne: async () => ({ id: 'mem-1' }) });

    const ctx = makeCtx({ _body: { applicationIds: ['app-1'] } });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(200);
    expect((response as any).body.succeeded).toHaveLength(0);
    expect((response as any).body.failed).toHaveLength(1);
    expect((response as any).body.failed[0].reason).toMatch(/not approvable/i);
  });

  // Test 4: Cross-org application rejected (OPS-03)
  test('application from different org returns failed with scope violation reason', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...crossOrgApplication }),
    });
    stubRepo(MembershipRepository, { createOne: async () => ({ id: 'mem-1' }) });

    // Officer is in 'tenant-1', application belongs to 'other-org'
    const ctx = makeCtx({ organizationId: 'tenant-1', _body: { applicationIds: ['app-cross'] } });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(200);
    expect((response as any).body.succeeded).toHaveLength(0);
    expect((response as any).body.failed).toHaveLength(1);
    expect((response as any).body.failed[0].reason).toMatch(/scope/i);
  });

  // Test 5: Mixed batch
  test('mixed batch returns 1 succeeded and 2 failed', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipApplicationRepository, {
      findOneById: async (id: string) => {
        if (id === 'app-1') return { ...fakeApplication }; // valid
        if (id === 'app-cross') return { ...crossOrgApplication }; // wrong org
        return undefined; // not found
      },
      updateOneById: async (_id: string, data: any) => ({ id: _id, ...data }),
    });
    stubRepo(MembershipRepository, {
      createOne: async () => ({ id: 'mem-new' }),
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _body: { applicationIds: ['app-1', 'app-cross', 'nonexistent'] },
    });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(200);
    expect((response as any).body.succeeded).toHaveLength(1);
    expect((response as any).body.succeeded).toContain('app-1');
    expect((response as any).body.failed).toHaveLength(2);
  });

  // Test 6: Successful approvals create membership with pendingPayment
  test('successful approval creates membership record with status pendingPayment', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication }),
      updateOneById: async (_id: string, data: any) => ({ id: _id, ...data }),
    });
    let capturedMembership: any = null;
    stubRepo(MembershipRepository, {
      createOne: async (data: any) => { capturedMembership = data; return { id: 'mem-1' }; },
    });

    const ctx = makeCtx({ _body: { applicationIds: ['app-1'] } });
    await bulkApproveMembershipApplications(ctx);

    expect(capturedMembership).not.toBeNull();
    expect(capturedMembership.status).toBe('pendingPayment');
    expect(capturedMembership.organizationId).toBe('tenant-1');
    expect(capturedMembership.personId).toBe('person-1');
    expect(capturedMembership.tierId).toBe('tier-1');
    expect(capturedMembership.duesExpiryDate).toBeNull();
  });

  // Test 7: Empty applicationIds array
  test('empty applicationIds returns empty succeeded and failed', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    stubRepo(MembershipApplicationRepository, { findOneById: async () => undefined });
    stubRepo(MembershipRepository, { createOne: async () => ({ id: 'mem-1' }) });

    const ctx = makeCtx({ _body: { applicationIds: [] } });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(200);
    expect((response as any).body.succeeded).toHaveLength(0);
    expect((response as any).body.failed).toHaveLength(0);
  });

  // Test 8: Non-officer (member) gets 403
  test('non-officer gets 403', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }); // no officer terms
    stubRepo(MembershipApplicationRepository, { findOneById: async () => undefined });
    stubRepo(MembershipRepository, { createOne: async () => ({ id: 'mem-1' }) });

    const ctx = makeCtx({ _body: { applicationIds: ['app-1'] } });
    const response = await bulkApproveMembershipApplications(ctx);

    expect(response.status).toBe(403);
  });
});
