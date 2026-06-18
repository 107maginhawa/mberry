import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { addRosterMember } from './addRosterMember';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const fakeMember = (overrides: Record<string, any> = {}) => ({
  id: 'mem-new',
  personId: 'person-1',
  organizationId: 'org-1',
  status: 'pendingPayment',
  startDate: '2026-06-16',
  gracePeriodDays: 30,
  joinedAt: new Date(),
  ...overrides,
});

describe('addRosterMember', () => {
  afterEach(() => {
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
  });

  // requirePosition checks OfficerTermRepository before session check
  function grantPosition(title = 'Secretary') {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: title }],
    });
  }

  test('creates roster member and returns 201 (happy path)', async () => {
    grantPosition('Secretary');
    const created = fakeMember({ id: 'mem-new', personId: 'p-1' });
    stubRepo(MembershipRepository, {
      createOne: async () => created,
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'p-1', tierId: 'tier-1' },
    });

    const response = await addRosterMember(ctx);
    expect(response.status).toBe(201);
    const body = (response as any).body;
    expect(body.id).toBe('mem-new');
    expect(body.personId).toBe('p-1');
    expect(body.status).toBe('pendingPayment');
  });

  test('President role is also allowed', async () => {
    grantPosition('President');
    stubRepo(MembershipRepository, {
      createOne: async () => fakeMember(),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'p-2', tierId: 'tier-1' },
    });

    const response = await addRosterMember(ctx);
    expect(response.status).toBe(201);
  });

  test('non-officer gets 403', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [], // not an officer
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'p-3', tierId: 'tier-1' },
    });

    const response = await addRosterMember(ctx);
    expect(response.status).toBe(403);
  });

  test('wrong position title gets 403', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'p-4', tierId: 'tier-1' },
    });

    const response = await addRosterMember(ctx);
    expect(response.status).toBe(403);
  });

  test('createOne receives organizationId from context', async () => {
    grantPosition();
    let capturedData: any;
    stubRepo(MembershipRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return fakeMember({ ...data });
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-99',
      _body: { personId: 'p-5', tierId: 'tier-1' },
    });

    await addRosterMember(ctx);
    expect(capturedData.organizationId).toBe('org-99');
    expect(capturedData.status).toBe('pendingPayment');
    expect(capturedData.gracePeriodDays).toBe(30);
  });

  test('uses provided startDate when present in body', async () => {
    grantPosition();
    let capturedData: any;
    stubRepo(MembershipRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return fakeMember({ ...data });
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'p-6', tierId: 'tier-1', startDate: '2026-01-15' },
    });

    await addRosterMember(ctx);
    expect(capturedData.startDate).toBe('2026-01-15');
  });

  test('directory auto-populate job failure is swallowed (does not throw)', async () => {
    grantPosition();
    stubRepo(MembershipRepository, {
      createOne: async () => fakeMember(),
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: { personId: 'p-7', tierId: 'tier-1' },
      jobs: {
        trigger: async () => { throw new Error('job queue unavailable'); },
      },
    });

    // Should not throw — job errors are fire-and-forget
    const response = await addRosterMember(ctx);
    expect(response.status).toBe(201);
  });
});
