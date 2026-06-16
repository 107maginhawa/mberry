import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getRosterMember } from './getRosterMember';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

const fakeRosterRow = (overrides: Record<string, any> = {}) => ({
  id: 'mem-1',
  personId: 'person-1',
  organizationId: 'org-1',
  memberNumber: 'MN-001',
  categoryId: 'cat-1',
  status: 'active',
  duesExpiryDate: '2027-01-01',
  joinedAt: new Date('2025-01-01'),
  createdAt: new Date('2025-01-01'),
  person: {
    id: 'person-1',
    firstName: 'Jane',
    lastName: 'Doe',
  },
  category: {
    id: 'cat-1',
    name: 'Regular',
  },
  ...overrides,
});

describe('getRosterMember', () => {
  afterEach(() => {
    restoreRepo(MembershipRepository);
  });

  test('returns 200 with roster member data (happy path)', async () => {
    const row = fakeRosterRow();
    stubRepo(MembershipRepository, {
      getMemberById: async () => row,
    });

    const ctx = makeCtx({ _params: { memberId: 'mem-1' } });
    const response = await getRosterMember(ctx);
    expect(response.status).toBe(200);

    const body = (response as any).body;
    expect(body.id).toBe('mem-1');
    expect(body.personId).toBe('person-1');
    expect(body.memberNumber).toBe('MN-001');
    expect(body.status).toBe('active');
    expect(body.categoryId).toBe('cat-1');
    expect(body.categoryName).toBe('Regular');
    expect(body.organizationId).toBe('org-1');
  });

  test('constructs name from person firstName and lastName', async () => {
    const row = fakeRosterRow({ person: { id: 'p-1', firstName: 'John', lastName: 'Smith' } });
    stubRepo(MembershipRepository, {
      getMemberById: async () => row,
    });

    const ctx = makeCtx({ _params: { memberId: 'mem-1' } });
    const response = await getRosterMember(ctx);
    expect((response as any).body.name).toBe('John Smith');
    expect((response as any).body.firstName).toBe('John');
    expect((response as any).body.lastName).toBe('Smith');
  });

  test('handles missing person data gracefully (null name)', async () => {
    const row = fakeRosterRow({ person: {} });
    stubRepo(MembershipRepository, {
      getMemberById: async () => row,
    });

    const ctx = makeCtx({ _params: { memberId: 'mem-1' } });
    const response = await getRosterMember(ctx);
    const body = (response as any).body;
    expect(body.name).toBeNull();
    expect(body.firstName).toBeNull();
    expect(body.lastName).toBeNull();
  });

  test('throws NotFoundError when member does not exist', async () => {
    stubRepo(MembershipRepository, {
      getMemberById: async () => null,
    });

    const ctx = makeCtx({ _params: { memberId: 'missing' } });
    await expect(getRosterMember(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { memberId: 'mem-1' } });
    await expect(getRosterMember(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('passes memberId param to getMemberById', async () => {
    let capturedId: string | undefined;
    stubRepo(MembershipRepository, {
      getMemberById: async (id: string) => {
        capturedId = id;
        return fakeRosterRow({ id });
      },
    });

    const ctx = makeCtx({ _params: { memberId: 'mem-42' } });
    await getRosterMember(ctx);
    expect(capturedId).toBe('mem-42');
  });

  test('duesExpiryDate is returned in body', async () => {
    const row = fakeRosterRow({ duesExpiryDate: '2028-06-30' });
    stubRepo(MembershipRepository, {
      getMemberById: async () => row,
    });

    const ctx = makeCtx({ _params: { memberId: 'mem-1' } });
    const response = await getRosterMember(ctx);
    expect((response as any).body.duesExpiryDate).toBe('2028-06-30');
  });
});
