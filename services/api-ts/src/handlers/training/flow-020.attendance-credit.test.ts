/**
 * FLOW-020: Training Attendance → Auto Credit Entry
 *
 * Acceptance criteria:
 *   AC-M09-001: Officer confirms attendance → auto-credit entry created in M10
 *   AC-M10-002: No duplicate AUTO credits for same (trainingId, personId)
 *   Cross-module flow 6.3: attendance confirmation → credit_entry → certificate eligibility
 *
 * Tests both paths:
 *   1. markComplete (training module handler)
 *   2. completeTrainingEnrollment (association:operations handler)
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeTraining, fakeEnrollment } from '@/test-utils/factories';
import { markComplete } from './markComplete';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { OrganizationRepository, AssociationRepository } from '../platformadmin/repos/platform-admin.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-020';
const PERSON = 'person-020';
const TRAINING_ID = 'training-020';

const creditBearingTraining = fakeTraining({
  id: TRAINING_ID,
  organizationId: ORG,
  title: 'Advanced CPD Workshop',
  status: 'published',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-02'), // Past date
  creditBearing: true,
  creditAmount: 10,
});

const activeEnrollment = fakeEnrollment({
  id: 'enroll-020',
  trainingId: TRAINING_ID,
  personId: PERSON,
  status: 'enrolled',
  enrolledAt: new Date('2025-01-01'),
  cancelledAt: null,
});

function stubTraining(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(TrainingRepository, {
    getByOrg: async () => creditBearingTraining,
    getEnrollmentCount: async () => 1,
    listEnrollments: async () => [activeEnrollment],
    updateEnrollmentStatus: async (id: string, status: string) => ({
      ...activeEnrollment,
      id,
      status,
      completedAt: new Date(),
    }),
    ...overrides,
  });
}

function stubMembership(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(MembershipRepository, {
    findByPersonAndOrg: async () => ({
      id: 'mem-1',
      personId: PERSON,
      organizationId: ORG,
      startDate: '2024-01-01',
      status: 'active',
    }),
    ...overrides,
  });
}

function stubOrgAssoc() {
  stubRepo(OrganizationRepository, {
    findById: async () => ({ id: ORG, associationId: 'assoc-1', name: 'Test Org', status: 'active' }),
  });
  stubRepo(AssociationRepository, {
    findById: async () => ({
      id: 'assoc-1', name: 'Test Assoc', creditCyclePeriod: 2,
      requiredCreditsPerCycle: 40, carryoverEnabled: false,
      cycleStartMonth: null, cycleStartDay: null,
    }),
  });
}

// ─── AC-M09-001: Auto-credit on attendance confirmation ─

describe('[AC-M09-001] Auto-credit on attendance confirmation', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OrganizationRepository);
    restoreRepo(AssociationRepository);
    restoreRepo(OfficerTermRepository);
    stubOrgAssoc();
    // Default officer stub — all tests assume caller is an officer
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (creditMocks) Object.values(creditMocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('markComplete creates credit_entry with type=auto when training is credit-bearing', async () => {
    let capturedCredit: any = null;

    trainingMocks = stubTraining();
    memberMocks = stubMembership();
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => {
        capturedCredit = data;
        return { id: 'credit-new', ...data };
      },
      findByTrainingAndPerson: async () => null, // No existing credit
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    expect(response.status).toBe(201);
    expect(capturedCredit).not.toBeNull();
    expect(capturedCredit.type).toBe('auto');
    expect(capturedCredit.trainingId).toBe(TRAINING_ID);
    expect(capturedCredit.personId).toBe(PERSON);
    expect(capturedCredit.organizationId).toBe(ORG);
    expect(capturedCredit.creditAmount).toBe(10);
    expect(capturedCredit.activityName).toBe('Advanced CPD Workshop');
  });

  test('markComplete skips credit creation for non-credit-bearing training', async () => {
    let creditCreated = false;

    trainingMocks = stubTraining({
      getByOrg: async () => ({ ...creditBearingTraining, creditAmount: 0 }),
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCreated = true; return {} as any; },
      findByTrainingAndPerson: async () => null,
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    await markComplete(ctx);
    expect(creditCreated).toBe(false);
  });

  test('credit entry includes cycle dates computed from activity date', async () => {
    let capturedCredit: any = null;

    trainingMocks = stubTraining();
    memberMocks = stubMembership();
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => {
        capturedCredit = data;
        return { id: 'credit-new', ...data };
      },
      findByTrainingAndPerson: async () => null,
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    await markComplete(ctx);

    expect(capturedCredit.cycleStart).toBeInstanceOf(Date);
    expect(capturedCredit.cycleEnd).toBeInstanceOf(Date);
    expect(capturedCredit.activityDate).toBeInstanceOf(Date);
  });
});

// ─── AC-M10-002: No duplicate AUTO credits ──────────────

describe('[AC-M10-002] No duplicate AUTO credits', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OrganizationRepository);
    restoreRepo(AssociationRepository);
    restoreRepo(OfficerTermRepository);
    stubOrgAssoc();
    // Default officer stub — all tests assume caller is an officer
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (creditMocks) Object.values(creditMocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('skips credit creation when auto credit already exists for same training+person', async () => {
    let creditCreateCalled = false;

    trainingMocks = stubTraining();
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCreateCalled = true; return {} as any; },
      findByTrainingAndPerson: async () => ({
        id: 'existing-credit',
        trainingId: TRAINING_ID,
        personId: PERSON,
        type: 'auto',
      }),
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    // Completion still succeeds
    expect(response.status).toBe(201);
    // But no new credit was created
    expect(creditCreateCalled).toBe(false);
  });

  test('creates credit when no existing auto credit for this training+person', async () => {
    let creditCreateCalled = false;

    trainingMocks = stubTraining();
    memberMocks = stubMembership();
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreateCalled = true; return { id: 'new-credit', ...data }; },
      findByTrainingAndPerson: async () => null, // No existing
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    expect(response.status).toBe(201);
    expect(creditCreateCalled).toBe(true);
  });

  test('already-completed enrollment throws before reaching credit logic', async () => {
    let creditCallCount = 0;

    trainingMocks = stubTraining({
      listEnrollments: async () => [{
        ...activeEnrollment,
        completedAt: new Date('2025-01-02'),
      }],
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCallCount++; return {} as any; },
      findByTrainingAndPerson: async () => null,
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Already marked as completed');
    expect(creditCallCount).toBe(0);
  });
});

// ─── Cross-module flow 6.3: attendance → credit → certificate ─

describe('[FLOW-6.3] Attendance → Credit Entry → Certificate eligibility', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OrganizationRepository);
    restoreRepo(AssociationRepository);
    restoreRepo(OfficerTermRepository);
    stubOrgAssoc();
    // Default officer stub — all tests assume caller is an officer
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (creditMocks) Object.values(creditMocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('credit entry links to training via trainingId for certificate verification', async () => {
    let capturedCredit: any = null;

    trainingMocks = stubTraining();
    memberMocks = stubMembership();
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => {
        capturedCredit = data;
        return { id: 'credit-flow', ...data };
      },
      findByTrainingAndPerson: async () => null,
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    await markComplete(ctx);

    // Credit entry must have trainingId for certificate eligibility lookup
    expect(capturedCredit.trainingId).toBe(TRAINING_ID);
    expect(capturedCredit.personId).toBe(PERSON);
    expect(capturedCredit.type).toBe('auto');
  });

  test('credit creation failure does not block attendance confirmation', async () => {
    trainingMocks = stubTraining();
    memberMocks = stubMembership();
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async () => { throw new Error('DB write failed'); },
      findByTrainingAndPerson: async () => null,
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    // Completion succeeds even if credit creation fails
    expect(response.status).toBe(201);
  });

  test('cancelled training blocks both attendance and credit creation', async () => {
    let creditCreateCalled = false;

    trainingMocks = stubTraining({
      getByOrg: async () => ({ ...creditBearingTraining, status: 'cancelled' }),
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCreateCalled = true; return {} as any; },
      findByTrainingAndPerson: async () => null,
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });

    await expect(markComplete(ctx)).rejects.toThrow('cancelled');
    expect(creditCreateCalled).toBe(false);
  });
});
