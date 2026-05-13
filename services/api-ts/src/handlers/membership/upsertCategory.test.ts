import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { upsertCategory } from './upsertCategory';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeCategory = {
  id: 'cat-1',
  organizationId: 'org-1',
  organizationId: 'org-1',
  name: 'Regular',
  description: 'Regular members',
  applicableTiers: ['tier-1'],
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('upsertCategory', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('upserts category and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      upsertCategory: async (data: any) => ({ ...fakeCategory, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'Regular', description: 'Regular members', applicableTiers: ['tier-1'] },
    });

    const response = await upsertCategory(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Regular');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      upsertCategory: async (data: any) => ({ ...fakeCategory, ...data }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { name: 'Regular', description: 'Test' },
    });

    await expect(upsertCategory(ctx)).rejects.toThrow();
  });

  test('scopes category to orgId from route param', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      upsertCategory: async (data: any) => { captured = data; return { ...fakeCategory, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-88' },
      _body: { name: 'Test', description: 'Test category' },
    });

    await upsertCategory(ctx);
    expect(captured.organizationId).toBe('org-88');
  });

  test('defaults applicableTiers to empty array when not provided', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      upsertCategory: async (data: any) => { captured = data; return { ...fakeCategory, ...data }; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { name: 'Minimal', description: 'No tiers' },
    });

    await upsertCategory(ctx);
    expect(captured.applicableTiers).toEqual([]);
  });

  test('sets createdBy and updatedBy to session user id', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      upsertCategory: async (data: any) => { captured = data; return { ...fakeCategory, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'admin-9', role: 'admin' },
      _params: { organizationId: 'org-1' },
      _body: { name: 'Premium', description: 'Premium members' },
    });

    await upsertCategory(ctx);
    expect(captured.createdBy).toBe('admin-9');
    expect(captured.updatedBy).toBe('admin-9');
  });
});
