import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMembershipCategory } from '@/test-utils/factories';
import { listMembershipCategories } from './listMembershipCategories';
import { MembershipCategoryRepository } from '@/handlers/association:member/repos/membership.repo';

describe('listMembershipCategories', () => {
  afterEach(() => {
    restoreRepo(MembershipCategoryRepository);
  });

  test('returns categories list (happy path)', async () => {
    const cat1 = fakeMembershipCategory({ id: 'cat-1', name: 'General Dentistry' });
    const cat2 = fakeMembershipCategory({ id: 'cat-2', name: 'Orthodontics' });
    stubRepo(MembershipCategoryRepository, {
      findMany: async () => [cat1, cat2],
    });

    const ctx = makeCtx({ organizationId: 'org-1' });
    const response = await listMembershipCategories(ctx);
    // handler calls ctx.json(body) with no explicit status (defaults 200)
    const body = (response as any).body;
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('cat-1');
    expect(body.data[1].id).toBe('cat-2');
  });

  test('returns empty array when no categories', async () => {
    stubRepo(MembershipCategoryRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({ organizationId: 'org-1' });
    const response = await listMembershipCategories(ctx);
    expect((response as any).body.data).toHaveLength(0);
  });

  test('passes organizationId filter to repository', async () => {
    let capturedFilter: any;
    stubRepo(MembershipCategoryRepository, {
      findMany: async (filter: any) => {
        capturedFilter = filter;
        return [];
      },
    });

    const ctx = makeCtx({ organizationId: 'org-42' });
    await listMembershipCategories(ctx);
    expect(capturedFilter.organizationId).toBe('org-42');
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const response = await listMembershipCategories(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({ organizationId: undefined });
    const response = await listMembershipCategories(ctx);
    expect(response.status).toBe(403);
  });

  test('category data fields are preserved in response', async () => {
    const cat = fakeMembershipCategory({ id: 'cat-1', name: 'Oral Surgery', code: 'OS', description: 'Surgical specialists' });
    stubRepo(MembershipCategoryRepository, {
      findMany: async () => [cat],
    });

    const ctx = makeCtx({ organizationId: 'org-1' });
    const response = await listMembershipCategories(ctx);
    // body.data is present regardless of status arg
    const item = (response as any).body.data[0];
    expect(item.name).toBe('Oral Surgery');
    expect(item.code).toBe('OS');
    expect(item.description).toBe('Surgical specialists');
  });
});
