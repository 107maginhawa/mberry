import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMembershipCategory } from '@/test-utils/factories';
import { upsertMembershipCategory } from './upsertMembershipCategory';
import { MembershipCategoryRepository } from '@/handlers/association:member/repos/membership.repo';
import { UnauthorizedError } from '@/core/errors';

describe('upsertMembershipCategory', () => {
  afterEach(() => {
    restoreRepo(MembershipCategoryRepository);
  });

  test('creates a new category (no id in body) → returns 201', async () => {
    const newCat = fakeMembershipCategory({ id: 'cat-new', name: 'Periodontics' });
    stubRepo(MembershipCategoryRepository, {
      createOne: async () => newCat,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { organizationId: 'org-1' },
      _body: { name: 'Periodontics', code: 'PERIO' },
    });

    const response = await upsertMembershipCategory(ctx);
    expect(response.status).toBe(201);
    const body = (response as any).body;
    expect(body.id).toBe('cat-new');
    expect(body.name).toBe('Periodontics');
  });

  test('updates an existing category (id in body) → returns 200', async () => {
    const updated = fakeMembershipCategory({ id: 'cat-1', name: 'Updated Name' });
    stubRepo(MembershipCategoryRepository, {
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { organizationId: 'org-1' },
      _body: { id: 'cat-1', name: 'Updated Name' },
    });

    const response = await upsertMembershipCategory(ctx);
    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.id).toBe('cat-1');
    expect(body.name).toBe('Updated Name');
  });

  test('createOne receives organizationId from path param', async () => {
    let capturedData: any;
    stubRepo(MembershipCategoryRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return fakeMembershipCategory({ ...data });
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-99',
      _params: { organizationId: 'org-99' },
      _body: { name: 'New Cat', code: 'NC' },
    });

    await upsertMembershipCategory(ctx);
    expect(capturedData.organizationId).toBe('org-99');
  });

  test('updateOneById receives the id from body', async () => {
    let capturedId: string | undefined;
    stubRepo(MembershipCategoryRepository, {
      updateOneById: async (id: string) => {
        capturedId = id;
        return fakeMembershipCategory({ id });
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { organizationId: 'org-1' },
      _body: { id: 'cat-existing', name: 'Renamed' },
    });

    await upsertMembershipCategory(ctx);
    expect(capturedId).toBe('cat-existing');
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { name: 'X' },
    });
    await expect(upsertMembershipCategory(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
