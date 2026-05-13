import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { addMember } from './addMember';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeMember = {
  id: 'mem-1',
  organizationId: 'org-1',
  organizationId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  categoryId: 'cat-1',
  memberNumber: 'MEM-001',
  startDate: '2025-01-01',
  duesExpiryDate: '2026-01-01',
  gracePeriodDays: 30,
  status: 'active',
  joinedAt: new Date(),
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── Tests ──────────────────────────────────────────────

describe('addMember', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates member and returns 201', async () => {
    mocks = stubRepo(MembershipRepository, {
      addMember: async (data: any) => ({ ...fakeMember, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        personId: 'person-1',
        tierId: 'tier-1',
        categoryId: 'cat-1',
        memberNumber: 'MEM-001',
      },
    });

    const response = await addMember(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.personId).toBe('person-1');
    expect(response.body.data.organizationId).toBe('org-1');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      addMember: async (data: any) => ({ ...fakeMember, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { personId: 'person-1', tierId: 'tier-1' },
    });

    // session is null so accessing session.user.id throws
    await expect(addMember(ctx)).rejects.toThrow();
  });

  test('scopes member to orgId from route param', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      addMember: async (data: any) => { captured = data; return { ...fakeMember, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-99' },
      _body: { personId: 'person-1', tierId: 'tier-1' },
    });

    await addMember(ctx);
    expect(captured.organizationId).toBe('org-99');
  });

  test('defaults startDate to today when not provided', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      addMember: async (data: any) => { captured = data; return { ...fakeMember, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { personId: 'person-1', tierId: 'tier-1' },
    });

    await addMember(ctx);
    const today = new Date().toISOString().split('T')[0];
    expect(captured.startDate).toBe(today);
  });

  test('uses licenseNumber as memberNumber fallback', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      addMember: async (data: any) => { captured = data; return { ...fakeMember, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { personId: 'person-1', tierId: 'tier-1', licenseNumber: 'LIC-123' },
    });

    await addMember(ctx);
    expect(captured.memberNumber).toBe('LIC-123');
  });

  test('sets createdBy and updatedBy to session user id', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      addMember: async (data: any) => { captured = data; return { ...fakeMember, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-5', role: 'admin' },
      _params: { organizationId: 'org-1' },
      _body: { personId: 'person-1', tierId: 'tier-1' },
    });

    await addMember(ctx);
    expect(captured.createdBy).toBe('admin-5');
    expect(captured.updatedBy).toBe('admin-5');
  });
});
