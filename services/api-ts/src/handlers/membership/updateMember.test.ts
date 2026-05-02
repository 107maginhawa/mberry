import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { updateMember } from './updateMember';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const existingMember = {
  membership: {
    id: 'mem-1',
    tenantId: 'org-1',
    orgId: 'org-1',
    personId: 'person-1',
    tierId: 'tier-1',
    categoryId: 'cat-1',
    memberNumber: 'MEM-001',
    status: 'active',
    note: null,
    terminatedAt: null,
    terminationReason: null,
    updatedBy: 'user-1',
  },
  person: { id: 'person-1', firstName: 'Alice', lastName: 'Smith', avatar: null },
  category: { id: 'cat-1', name: 'Regular' },
};

const updatedMember = {
  ...existingMember.membership,
  status: 'suspended',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('updateMember', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('updates member and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'person-1' },
      _body: { status: 'suspended' },
    });

    const response = await updateMember(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('suspended');
  });

  test('throws NotFoundError for non-existent member', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => undefined,
      updateMember: async () => updatedMember,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'nonexistent' },
      _body: { status: 'active' },
    });

    await expect(updateMember(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async () => updatedMember,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1', memberId: 'person-1' },
      _body: { status: 'active' },
    });

    await expect(updateMember(ctx)).rejects.toThrow();
  });

  test('scopes getMember call to orgId from route param', async () => {
    let capturedOrgId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async (orgId: string) => { capturedOrgId = orgId; return existingMember; },
      updateMember: async (_id: string, data: any) => ({ ...existingMember.membership, ...data }),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-55', memberId: 'person-1' },
      _body: { status: 'active' },
    });

    await updateMember(ctx);
    expect(capturedOrgId).toBe('org-55');
  });

  test('preserves existing values when body fields are absent', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'person-1' },
      _body: {}, // empty body - all values should fall back to existing
    });

    await updateMember(ctx);
    expect(capturedUpdate.categoryId).toBe('cat-1');
    expect(capturedUpdate.status).toBe('active');
    expect(capturedUpdate.memberNumber).toBe('MEM-001');
  });

  test('sets terminatedAt when status is terminated', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'person-1' },
      _body: { status: 'terminated', terminationReason: 'Non-compliance' },
    });

    await updateMember(ctx);
    expect(capturedUpdate.terminatedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.terminationReason).toBe('Non-compliance');
  });

  test('uses licenseNumber as memberNumber fallback', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'person-1' },
      _body: { licenseNumber: 'LIC-999' },
    });

    await updateMember(ctx);
    expect(capturedUpdate.memberNumber).toBe('LIC-999');
  });

  test('sets updatedBy to session user id', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => existingMember,
      updateMember: async (_id: string, data: any) => { capturedUpdate = data; return { ...existingMember.membership, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-3', role: 'admin' },
      _params: { orgId: 'org-1', memberId: 'person-1' },
      _body: { status: 'active' },
    });

    await updateMember(ctx);
    expect(capturedUpdate.updatedBy).toBe('admin-3');
  });
});
