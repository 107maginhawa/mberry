import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMembership } from '@/test-utils/factories';
import { updateRosterMember } from './updateRosterMember';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

describe('updateRosterMember', () => {
  afterEach(() => {
    restoreRepo(MembershipRepository);
  });

  test('updates roster member and returns 200 (happy path)', async () => {
    const existing = fakeMembership({ id: 'mem-1', organizationId: 'org-1' });
    const updated = { ...existing, categoryId: 'cat-2' };
    stubRepo(MembershipRepository, {
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { memberId: 'mem-1' },
      _body: { categoryId: 'cat-2' },
    });

    const response = await updateRosterMember(ctx);
    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.id).toBe('mem-1');
    expect(body.categoryId).toBe('cat-2');
  });

  test('updateOneById is called with the memberId and body', async () => {
    let capturedId: string | undefined;
    let capturedData: any;
    const existing = fakeMembership({ id: 'mem-5' });
    stubRepo(MembershipRepository, {
      findOneById: async () => existing,
      updateOneById: async (id: string, data: any) => {
        capturedId = id;
        capturedData = data;
        return { ...existing, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { memberId: 'mem-5' },
      _body: { memberNumber: 'MN-999' },
    });

    await updateRosterMember(ctx);
    expect(capturedId).toBe('mem-5');
    expect(capturedData.memberNumber).toBe('MN-999');
  });

  test('throws NotFoundError when member does not exist', async () => {
    stubRepo(MembershipRepository, {
      findOneById: async () => null,
      updateOneById: async () => ({}),
    });

    const ctx = makeCtx({
      _params: { memberId: 'missing' },
      _body: { categoryId: 'cat-1' },
    });

    await expect(updateRosterMember(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { memberId: 'mem-1' },
      _body: {},
    });
    await expect(updateRosterMember(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('findOneById is called with the correct memberId', async () => {
    let lookedUpId: string | undefined;
    stubRepo(MembershipRepository, {
      findOneById: async (id: string) => {
        lookedUpId = id;
        return fakeMembership({ id });
      },
      updateOneById: async (_id: string, data: any) => ({ id: _id, ...data }),
    });

    const ctx = makeCtx({
      _params: { memberId: 'mem-77' },
      _body: {},
    });

    await updateRosterMember(ctx);
    expect(lookedUpId).toBe('mem-77');
  });
});
