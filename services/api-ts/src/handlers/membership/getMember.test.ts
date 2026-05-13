import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getMember } from './getMember';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeMemberResult = {
  membership: {
    id: 'mem-1',
    organizationId: 'org-1',
    organizationId: 'org-1',
    personId: 'person-1',
    tierId: 'tier-1',
    categoryId: 'cat-1',
    memberNumber: 'MEM-001',
    status: 'active',
  },
  person: { id: 'person-1', firstName: 'Alice', lastName: 'Smith', avatar: null },
  category: { id: 'cat-1', name: 'Regular' },
};

// ─── Tests ──────────────────────────────────────────────

describe('getMember', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns member with 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => fakeMemberResult,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'person-1' },
    });

    const response = await getMember(ctx);
    expect(response.status).toBe(200);
    // Response is now flattened (not nested under .membership)
    expect(response.body.data.id).toBe('mem-1');
  });

  test('throws NotFoundError for non-existent member', async () => {
    mocks = stubRepo(MembershipRepository, {
      getMember: async () => undefined,
      getMemberById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1', memberId: 'nonexistent' },
    });

    await expect(getMember(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('passes orgId and memberId from route params', async () => {
    let capturedOrgId: string | null = null;
    let capturedMemberId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      getMember: async (orgId: string, memberId: string) => {
        capturedOrgId = orgId;
        capturedMemberId = memberId;
        return fakeMemberResult;
      },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-42', memberId: 'person-99' },
    });

    await getMember(ctx);
    expect(capturedOrgId).toBe('org-42');
    expect(capturedMemberId).toBe('person-99');
  });
});
