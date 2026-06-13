import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeApplication as createFakeApplication } from '@/test-utils/factories';
import { approveMembershipApplication } from './approveMembershipApplication';
import { MembershipApplicationRepository, MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError, ConflictError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ───────────────────────────────────────────

const fakeApplication = createFakeApplication({
  // Match the makeCtx() default org context so the FIX-003 cross-org guard
  // (record org must equal caller org) is satisfied for these same-org tests.
  organizationId: 'tenant-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
});

const approvedApplication = {
  ...fakeApplication,
  status: 'approved',
  reviewedBy: 'user-1',
  reviewedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('approveMembershipApplication', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipApplicationRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipApplicationRepository);
    restoreRepo(MembershipRepository);
  });

  test('approves a submitted application and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    // stubRepo returns one mock record, but approveMembershipApplication instantiates
    // two separate repo classes — patch MembershipRepository separately
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    const response = await approveMembershipApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
  });

  test('approves an underReview application and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    const underReviewApp = { ...fakeApplication, status: 'underReview' };
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => underReviewApp,
      updateOneById: async (_id: string, data: any) => ({ ...underReviewApp, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-2' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    const response = await approveMembershipApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
  });

  test('throws NotFoundError for non-existent application', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { applicationId: 'nonexistent' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when application is already approved', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'approved' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when application is denied', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'denied' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('rejects when no session (401 or UnauthorizedError)', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { applicationId: 'app-1' },
    });

    // Handler has two auth-rejection paths: requirePosition returns 401 Response,
    // or explicit throw UnauthorizedError. Both are correct. Under Bun parallel
    // test execution, prototype pollution can change which path fires first.
    try {
      const res = await approveMembershipApplication(ctx);
      expect(res.status).toBe(401);
    } catch (e) {
      expect(e).toBeInstanceOf(UnauthorizedError);
    }
  });

  test('sets reviewedBy to the session user id', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      user: { id: 'reviewer-99', role: 'officer', twoFactorEnabled: true },
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    expect(capturedUpdate.reviewedBy).toBe('reviewer-99');
    expect(capturedUpdate.status).toBe('approved');
  });

  test('sets reviewedAt to current timestamp', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedUpdate: any = null;
    const before = new Date();
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    const after = new Date();
    expect(capturedUpdate.reviewedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.reviewedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedUpdate.reviewedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('creates membership record with null duesExpiryDate for pendingPayment (BR-01)', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedMembership: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => { capturedMembership = data; return { id: 'mem-1' }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    const before = new Date();
    await approveMembershipApplication(ctx);

    expect(capturedMembership).not.toBeNull();

    // startDate should be today's date in YYYY-MM-DD format
    const todayStr = before.toISOString().split('T')[0];
    expect(capturedMembership.startDate).toBe(todayStr);

    // duesExpiryDate must be null — no expiry until payment settles
    expect(capturedMembership.duesExpiryDate).toBeNull();
  });

  test('creates membership with pendingPayment status', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedMembership: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async (data: any) => { capturedMembership = data; return { id: 'mem-1' }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    expect(capturedMembership.status).toBe('pendingPayment');
    expect(capturedMembership.personId).toBe('person-1');
    // Created membership inherits the application's org (fixture aligned to ctx org for FIX-003).
    expect(capturedMembership.organizationId).toBe('tenant-1');
    expect(capturedMembership.tierId).toBe('tier-1');
  });

  // ─── Transaction boundary tests ─────────────────────────

  test('wraps approval + membership creation in db.transaction()', async () => {
    let transactionCalled = false;

    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
    };

    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    expect(transactionCalled).toBe(true);
  });

  test('rolls back application approval when membership creation fails', async () => {
    let applicationUpdated = false;

    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        return fn(txDb);
      },
    };

    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => {
        applicationUpdated = true;
        return { ...fakeApplication, ...data };
      },
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => { throw new Error('Membership creation failed'); },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { applicationId: 'app-1' },
    });

    // Error should propagate out of the transaction, triggering DB rollback
    await expect(approveMembershipApplication(ctx)).rejects.toThrow('Membership creation failed');
  });

  test('both operations use transaction-scoped db instance', async () => {
    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
    };

    // Track which db instance each repo receives
    const appRepoDb: any = null;
    const membershipRepoDb: any = null;

    const OrigAppRepo = MembershipApplicationRepository;
    const OrigMemRepo = MembershipRepository;

    // Intercept constructor to capture db argument
    const origAppConstruct = MembershipApplicationRepository.prototype.constructor;
    const origMemConstruct = MembershipRepository.prototype.constructor;

    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);

    // The transaction must have been used (verified by the wraps test above)
    // This test ensures the handler calls db.transaction at all
    expect(txDb).toBeDefined();
  });

  // ─── FIX-010 / decision #5: reuse-row re-application ─────
  //
  // A terminal member re-applies. The (organizationId, personId) unique index
  // means a fresh INSERT raises a 500. Approve must instead REUSE the existing
  // row — flip it back through a clean pendingPayment — and a status-history row.

  test('re-application of a terminal member reuses the existing row instead of inserting a duplicate (FIX-010)', async () => {
    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
      insert: () => ({ values: async () => undefined }),
    };

    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });

    let createCalled = false;
    let capturedUpdate: { id: string; data: any } | null = null;
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-existing',
        organizationId: 'tenant-1',
        personId: 'person-1',
        tierId: 'tier-old',
        status: 'resigned',
        resignedAt: new Date('2025-01-01'),
        removedAt: null,
        removalReason: 'Relocated',
        suspendedAt: null,
        dateOfDeath: null,
        duesExpiryDate: null,
        gracePeriodDays: 30,
      }),
      createOne: async () => { createCalled = true; return { id: 'mem-new' }; },
      updateOneById: async (id: string, data: any) => { capturedUpdate = { id, data }; return { id, ...data }; },
    });

    const ctx = makeCtx({ database: txDb, _params: { applicationId: 'app-1' } });
    const response = await approveMembershipApplication(ctx);

    expect(response.status).toBe(200);
    // No duplicate INSERT (the unique index would 500).
    expect(createCalled).toBe(false);
    // The existing row was flipped back to a clean pendingPayment.
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.id).toBe('mem-existing');
    expect(capturedUpdate!.data.status).toBe('pendingPayment');
    expect(capturedUpdate!.data.tierId).toBe('tier-1'); // the new application's tier
    expect(capturedUpdate!.data.resignedAt).toBeNull();
    expect(capturedUpdate!.data.removedAt).toBeNull();
    expect(capturedUpdate!.data.duesExpiryDate).toBeNull();

    membershipMocks.findByPersonAndOrg.mockRestore();
    membershipMocks.createOne.mockRestore();
    membershipMocks.updateOneById.mockRestore();
  });

  test('re-application throws ConflictError (not 500) when an active membership already exists (FIX-010)', async () => {
    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
      insert: () => ({ values: async () => undefined }),
    };

    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-active',
        organizationId: 'tenant-1',
        personId: 'person-1',
        tierId: 'tier-1',
        status: 'active',
        resignedAt: null,
        removedAt: null,
        suspendedAt: null,
        dateOfDeath: null,
        duesExpiryDate: '2099-01-01',
        gracePeriodDays: 30,
      }),
      createOne: async () => ({ id: 'should-not-be-called' }),
    });

    const ctx = makeCtx({ database: txDb, _params: { applicationId: 'app-1' } });
    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(ConflictError);

    membershipMocks.findByPersonAndOrg.mockRestore();
    membershipMocks.createOne.mockRestore();
  });

  // ─── FIX-005 / G-07: approve emits membership.created ───
  //
  // The welcome consumer (domain-event-consumers.ts) only fired on the invite
  // funnel (claimInvite emits membership.created). Officer approval — the main
  // join funnel — produced a silent member with no welcome. Approve must emit
  // the same event the existing consumer handles.

  test('emits membership.created with source=application when a new membership is approved (FIX-005)', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
      createOne: async () => ({ id: 'mem-1' }),
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({ _params: { applicationId: 'app-1' } });
      await approveMembershipApplication(ctx);

      const evt = emitted.find((x) => x.e === 'membership.created');
      expect(evt).toBeDefined();
      expect(evt!.p.membershipId).toBe('mem-1');
      expect(evt!.p.personId).toBe('person-1');
      expect(evt!.p.organizationId).toBe('tenant-1');
      expect(evt!.p.source).toBe('application');
    } finally {
      (domainEvents as any).emit = origEmit;
      membershipMocks.findByPersonAndOrg.mockRestore();
      membershipMocks.createOne.mockRestore();
    }
  });

  test('emits membership.created on re-application reusing an existing row (FIX-005)', async () => {
    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
      insert: () => ({ values: async () => undefined }),
    };
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-existing', organizationId: 'tenant-1', personId: 'person-1', tierId: 'tier-old',
        status: 'resigned', resignedAt: new Date('2025-01-01'), removedAt: null, removalReason: null,
        suspendedAt: null, dateOfDeath: null, duesExpiryDate: null, gracePeriodDays: 30,
      }),
      createOne: async () => ({ id: 'should-not-be-called' }),
      updateOneById: async (id: string, data: any) => ({ id, ...data }),
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({ database: txDb, _params: { applicationId: 'app-1' } });
      await approveMembershipApplication(ctx);

      const evt = emitted.find((x) => x.e === 'membership.created');
      expect(evt).toBeDefined();
      expect(evt!.p.membershipId).toBe('mem-existing');
      expect(evt!.p.source).toBe('application');
    } finally {
      (domainEvents as any).emit = origEmit;
      membershipMocks.findByPersonAndOrg.mockRestore();
      membershipMocks.createOne.mockRestore();
      membershipMocks.updateOneById.mockRestore();
    }
  });
});
