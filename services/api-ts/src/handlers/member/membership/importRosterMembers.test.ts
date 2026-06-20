import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { importRosterMembers } from './importRosterMembers';
import { MembershipRepository, MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

describe('importRosterMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let tierMocks: ReturnType<typeof stubRepo>;
  let personMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    [mocks, tierMocks, personMocks, officerMocks].forEach((m) => {
      if (m) Object.values(m).forEach((x) => x.mockRestore());
    });
  });

  function grantOfficer() {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
  }

  // Tier always resolves to one owned by the test org unless overridden.
  function validTier(orgId = 'org-9') {
    tierMocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1', organizationId: orgId }),
    });
  }

  test('matches an existing person and creates a membership', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => ({ id: 'p-existing' }),
      createOne: async () => { throw new Error('should not create when matched'); },
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'm-1', personId: data.personId }),
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'ada@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.skipped).toBe(0);
    expect(res.body.failed).toBe(0);
  });

  test('creates a new person then a membership when no match', async () => {
    grantOfficer();
    validTier();
    let created = false;
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => null,
      createOne: async (data: any) => { created = true; return { id: 'p-new', firstName: data.firstName }; },
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'm-2', personId: data.personId }),
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ firstName: 'New', email: 'new@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(created).toBe(true);
    expect(res.body.imported).toBe(1);
  });

  test('skips a person who is already a member of this org', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => ({ id: 'p-existing' }),
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ id: 'm-existing' }),
      createOne: async () => { throw new Error('should not create for a skipped row'); },
    });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'dup@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  test('fails a row with neither email nor license', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, { findByEmailOrLicense: async () => null });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ firstName: 'NoKey' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.body.failed).toBe(1);
    const err = (res.body.errors as Array<{ index: number; error: string }>).find((e) => e.index === 0);
    expect(err!.error).toMatch(/email or licenseNumber/i);
  });

  test('fails a no-match row that is missing firstName (cannot create)', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async () => null,
      createOne: async () => { throw new Error('should not create without firstName'); },
    });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'ghost@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.body.failed).toBe(1);
    const err = (res.body.errors as Array<{ index: number; error: string }>).find((e) => e.index === 0);
    expect(err!.error).toMatch(/firstName/i);
  });

  test('returns 400 when the tier does not belong to the org', async () => {
    grantOfficer();
    tierMocks = stubRepo(MembershipTierRepository, {
      findOneById: async () => ({ id: 'tier-1', organizationId: 'other-org' }),
    });
    personMocks = stubRepo(PersonRepository, { findByEmailOrLicense: async () => null });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ firstName: 'A', email: 'a@x.com' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(400);
  });

  test('rejects an import exceeding the row cap (FIX-016)', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, { findByEmailOrLicense: async () => null });
    mocks = stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null, createOne: async () => ({ id: 'm' }) });

    const members = Array.from({ length: 501 }, (_, i) => ({ email: `p${i}@x.com`, firstName: 'X' }));
    const ctx = makeCtx({ organizationId: 'org-9', _body: { organizationId: 'org-9', tierId: 'tier-1', members } });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(400);
  });

  test('emits membership.imported with created personIds', async () => {
    grantOfficer();
    validTier();
    personMocks = stubRepo(PersonRepository, {
      findByEmailOrLicense: async (email: string) => ({ id: email === 'a@x.com' ? 'p-a' : 'p-b' }),
    });
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => ({ id: 'm', personId: data.personId }),
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({
        organizationId: 'org-9',
        _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'a@x.com' }, { email: 'b@x.com' }] },
      });
      const res = await importRosterMembers(ctx);
      expect(res.body.imported).toBe(2);
      const evt = emitted.find((x) => x.e === 'membership.imported');
      expect(evt).toBeDefined();
      expect(evt!.p.importedCount).toBe(2);
      expect(evt!.p.personIds).toEqual(['p-a', 'p-b']);
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  test('returns 403 when caller holds no qualifying officer position', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      organizationId: 'org-9',
      _body: { organizationId: 'org-9', tierId: 'tier-1', members: [{ email: 'a@x.com', firstName: 'A' }] },
    });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(403);
  });
});
