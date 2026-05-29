// Business Rules: [BR-04] — categories with assigned members cannot be deleted
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteMembershipCategory } from './deleteMembershipCategory';
import { MembershipCategoryRepository } from './repos/membership.repo';
import { ConflictError, NotFoundError } from '@/core/errors';

const category = {
  id: 'cat-1',
  organizationId: 'org-1',
  name: 'Regular',
};

describe('deleteMembershipCategory [BR-04]', () => {
  beforeEach(() => restoreRepo(MembershipCategoryRepository));
  afterEach(() => restoreRepo(MembershipCategoryRepository));

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, _params: { membershipCategoryId: 'cat-1' } });
    const res = await deleteMembershipCategory(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organization context', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { membershipCategoryId: 'cat-1' } });
    const res = await deleteMembershipCategory(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NotFound when category missing', async () => {
    stubRepo(MembershipCategoryRepository, { findOneById: async () => undefined });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { membershipCategoryId: 'cat-1' } });
    await expect(deleteMembershipCategory(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('[BR-04] throws Conflict when category has assigned members', async () => {
    let deleted = false;
    stubRepo(MembershipCategoryRepository, {
      findOneById: async () => category,
      countMembersInCategory: async () => 3,
      deleteOneById: async () => { deleted = true; },
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { membershipCategoryId: 'cat-1' } });
    await expect(deleteMembershipCategory(ctx)).rejects.toBeInstanceOf(ConflictError);
    expect(deleted).toBe(false);
  });

  test('[BR-04] deletes when category has zero members', async () => {
    let deleted = false;
    stubRepo(MembershipCategoryRepository, {
      findOneById: async () => category,
      countMembersInCategory: async () => 0,
      deleteOneById: async () => { deleted = true; },
    });
    const ctx = makeCtx({ organizationId: 'org-1', _params: { membershipCategoryId: 'cat-1' } });
    const res = await deleteMembershipCategory(ctx);
    expect(res.status).toBe(200);
    expect(deleted).toBe(true);
  });
});
