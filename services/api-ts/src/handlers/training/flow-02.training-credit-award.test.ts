// FLOW-02: Training Completion → Credit Award
// Tests that markComplete creates credit entry for credit-bearing trainings.
// Cross-module: training → credits (via CreditEntryRepository)
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { markComplete } from './markComplete';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const ORG = 'org-flow-02';
const PERSON = 'person-flow-02';
const TRAINING_ID = 'training-1';

const fakeTraining = {
  id: TRAINING_ID,
  organizationId: ORG,
  title: 'CPD Seminar 2026',
  status: 'published',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-02'),
  creditAmount: 8,
  creditBearing: true,
};

const fakeEnrollment = {
  id: 'enroll-1',
  trainingId: TRAINING_ID,
  personId: PERSON,
  status: 'registered',
  completedAt: null,
};

function defaultTrainingStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(TrainingRepository, {
    getByOrg: async () => fakeTraining,
    getEnrollmentCount: async () => 1,
    listEnrollments: async () => [fakeEnrollment],
    updateEnrollmentStatus: async (id: string, status: string) => ({
      ...fakeEnrollment,
      id,
      status,
      completedAt: new Date(),
    }),
    ...overrides,
  });
}

function defaultCreditStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
  return stubRepo(CreditEntryRepository, {
    createOne: async (data: any) => ({ id: 'credit-1', ...data }),
    findByTrainingAndPerson: async () => null,
    ...overrides,
  });
}

function defaultMembershipStubs(overrides: Record<string, (...args: any[]) => any> = {}) {
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

// ─── Tests ──────────────────────────────────────────────

describe('[FLOW-02] Training Completion → Credit Award', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (creditMocks) Object.values(creditMocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('completing credit-bearing training creates credit entry', async () => {
    let capturedCredit: any = null;

    trainingMocks = defaultTrainingStubs();
    memberMocks = defaultMembershipStubs();
    creditMocks = defaultCreditStubs({
      createOne: async (data: any) => {
        capturedCredit = data;
        return { id: 'credit-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    expect(response.status).toBe(201);
    expect(capturedCredit).not.toBeNull();
    expect(capturedCredit.personId).toBe(PERSON);
    expect(capturedCredit.organizationId).toBe(ORG);
    expect(capturedCredit.trainingId).toBe(TRAINING_ID);
    expect(capturedCredit.creditAmount).toBe(8);
    expect(capturedCredit.type).toBe('auto');
    expect(capturedCredit.activityName).toBe('CPD Seminar 2026');
  });

  test('non-credit-bearing training skips credit creation', async () => {
    let creditCreated = false;

    trainingMocks = defaultTrainingStubs({
      getByOrg: async () => ({ ...fakeTraining, creditAmount: 0 }),
    });
    creditMocks = defaultCreditStubs({
      createOne: async () => { creditCreated = true; return {} as any; },
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    expect(response.status).toBe(201);
    expect(creditCreated).toBe(false);
  });

  test('null creditAmount skips credit creation', async () => {
    let creditCreated = false;

    trainingMocks = defaultTrainingStubs({
      getByOrg: async () => ({ ...fakeTraining, creditAmount: null }),
    });
    creditMocks = defaultCreditStubs({
      createOne: async () => { creditCreated = true; return {} as any; },
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    await markComplete(ctx);

    expect(creditCreated).toBe(false);
  });

  test('credit entry includes cycle dates from getCycleForDate', async () => {
    let capturedCredit: any = null;

    trainingMocks = defaultTrainingStubs();
    memberMocks = defaultMembershipStubs();
    creditMocks = defaultCreditStubs({
      createOne: async (data: any) => {
        capturedCredit = data;
        return { id: 'credit-1', ...data };
      },
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

  test('cancelled training blocks completion with ConflictError', async () => {
    trainingMocks = defaultTrainingStubs({
      getByOrg: async () => ({ ...fakeTraining, status: 'cancelled' }),
    });
    creditMocks = defaultCreditStubs();

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });

    try {
      await markComplete(ctx);
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain('cancelled');
    }
  });

  test('already-completed enrollment throws ConflictError', async () => {
    trainingMocks = defaultTrainingStubs({
      listEnrollments: async () => [{
        ...fakeEnrollment,
        completedAt: new Date('2026-01-02'),
      }],
    });
    creditMocks = defaultCreditStubs();

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });

    try {
      await markComplete(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('Already marked');
    }
  });

  test('credit creation failure does not block completion', async () => {
    trainingMocks = defaultTrainingStubs();
    memberMocks = defaultMembershipStubs();
    creditMocks = defaultCreditStubs({
      createOne: async () => { throw new Error('DB write failed'); },
    });

    const ctx = makeCtx({
      _body: { personId: PERSON },
      _params: { id: TRAINING_ID, organizationId: ORG },
    });
    const response = await markComplete(ctx);

    // Completion succeeds despite credit failure (per handler's try/catch)
    expect(response.status).toBe(201);
  });
});
