import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listCategories } from './listCategories';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeCategories = [
  { id: 'cat-1', organizationId: 'org-1', orgId: 'org-1', name: 'Regular', description: 'Regular member' },
  { id: 'cat-2', organizationId: 'org-1', orgId: 'org-1', name: 'Senior', description: 'Senior member' },
];

// ─── Tests ──────────────────────────────────────────────

describe('listCategories', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns categories with 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      listCategories: async () => fakeCategories,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
    });

    const response = await listCategories(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  test('passes orgId from route param to repo', async () => {
    let capturedOrgId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      listCategories: async (orgId: string) => { capturedOrgId = orgId; return []; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-33' },
    });

    await listCategories(ctx);
    expect(capturedOrgId).toBe('org-33');
  });

  test('returns empty list when no categories', async () => {
    mocks = stubRepo(MembershipRepository, {
      listCategories: async () => [],
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
    });

    const response = await listCategories(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });
});
