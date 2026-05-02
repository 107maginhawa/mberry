import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { importMembers } from './importMembers';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeMember = {
  id: 'mem-1',
  tenantId: 'org-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'active',
};

// ─── Tests ──────────────────────────────────────────────

describe('importMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('imports members and returns 201 with count', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members.map((m: any, i: number) => ({ ...fakeMember, id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1' },
          { personId: 'p-2', tierId: 'tier-1' },
        ],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(2);
  });

  test('handles empty members array', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { members: [] },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(0);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _body: { members: [{ personId: 'p-1', tierId: 'tier-1' }] },
    });

    await expect(importMembers(ctx)).rejects.toThrow();
  });

  test('scopes all members to orgId from route param', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-77' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1' },
          { personId: 'p-2', tierId: 'tier-2' },
        ],
      },
    });

    await importMembers(ctx);
    expect(captured.length).toBe(2);
    expect(captured[0].orgId).toBe('org-77');
    expect(captured[0].tenantId).toBe('org-77');
    expect(captured[1].orgId).toBe('org-77');
    expect(captured[1].tenantId).toBe('org-77');
  });

  test('uses licenseNumber as memberNumber fallback', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1', licenseNumber: 'LIC-100' },
        ],
      },
    });

    await importMembers(ctx);
    expect(captured[0].memberNumber).toBe('LIC-100');
  });

  test('sets createdBy and updatedBy for all members', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      user: { id: 'importer-1', role: 'admin' },
      _params: { orgId: 'org-1' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1' },
          { personId: 'p-2', tierId: 'tier-2' },
        ],
      },
    });

    await importMembers(ctx);
    expect(captured[0].createdBy).toBe('importer-1');
    expect(captured[0].updatedBy).toBe('importer-1');
    expect(captured[1].createdBy).toBe('importer-1');
    expect(captured[1].updatedBy).toBe('importer-1');
  });

  test('defaults status to active for all imported members', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        members: [{ personId: 'p-1', tierId: 'tier-1' }],
      },
    });

    await importMembers(ctx);
    expect(captured[0].status).toBe('active');
  });
});
