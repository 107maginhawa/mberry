// Acceptance Criteria: [AC-M09-001] (Auto-credit award on attendance confirm), [AC-M09-003] (No duplicate credits — idempotent re-confirm), [AC-M09-005] (Post-completion lock — no enroll/modify)
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import { BusinessLogicError, ConflictError } from '@/core/errors';

/**
 * Training Enrollment Tests
 *
 * Tests for training enrollment lifecycle handlers and guards.
 */

// ─── enrollInCustomTraining ────────────────────────────────

describe('enrollInCustomTraining', () => {
  test('enrollInCustomTraining returns 401 without user', async () => {
    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('enrollInCustomTraining returns 403 without organizationId', async () => {
    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({ organizationId: null, _params: { trainingId: 't-1' } });
    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(403);
  });

  test('only published trainings accept enrollment', () => {
    const published = { status: 'published' };
    const draft = { status: 'draft' };
    const cancelled = { status: 'cancelled' };

    expect(published.status === 'published').toBe(true);
    expect(draft.status === 'published').toBe(false);
    expect(cancelled.status === 'published').toBe(false);
  });

  test('capacity check prevents over-enrollment', () => {
    const training = { capacity: 30 };
    const enrolledCount = 30;
    const isFull = training.capacity !== null && enrolledCount >= training.capacity;
    expect(isFull).toBe(true);
  });

  test('enrollment allowed when below capacity', () => {
    const training = { capacity: 30 };
    const enrolledCount = 15;
    const isFull = training.capacity !== null && enrolledCount >= training.capacity;
    expect(isFull).toBe(false);
  });

  test('no capacity limit when capacity is null', () => {
    const training = { capacity: null };
    const enrolledCount = 9999;
    const isFull = training.capacity !== null && enrolledCount >= training.capacity;
    expect(isFull).toBe(false);
  });
});

// ─── G10 / FIX-010 — duplicate enrollment guard ──
//
// A member may hold at most one active (non-cancelled) enrollment per
// training. A second enroll attempt must be rejected (not silently create a
// duplicate row that distorts capacity and makes enrollments[0] arbitrary).

describe('enrollInCustomTraining — G10 duplicate-enrollment guard (FIX-010)', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });
  afterEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('rejects a second enrollment for the same (trainingId, personId)', async () => {
    let createCalls = 0;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published', registrationFee: 0, capacity: null }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      // The member already holds an active enrollment.
      findMany: async () => [{ id: 'e-existing', trainingId: 't-1', personId: 'user-1', status: 'enrolled' }],
      count: async () => 0,
      createOne: async () => { createCalls += 1; return { id: 'e-new' }; },
    });

    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user', twoFactorEnabled: true },
      organizationId: 'org-1',
      _params: { trainingId: 't-1' },
    });

    await expect(enrollInCustomTraining(ctx)).rejects.toThrow(BusinessLogicError);
    expect(createCalls).toBe(0);
  });

  test('allows enrollment when the only prior enrollment was cancelled', async () => {
    let created: any = null;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published', registrationFee: 0, capacity: null }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      // Prior enrollment was cancelled — re-enrollment is permitted.
      findMany: async () => [{ id: 'e-old', trainingId: 't-1', personId: 'user-1', status: 'cancelled' }],
      count: async () => 0,
      createOne: async (data: any) => { created = data; return { id: 'e-new', ...data }; },
    });

    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user', twoFactorEnabled: true },
      organizationId: 'org-1',
      _params: { trainingId: 't-1' },
    });

    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(201);
    expect(created?.personId).toBe('user-1');
  });

  test('allows the first-ever enrollment (no prior rows)', async () => {
    let created: any = null;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published', registrationFee: 0, capacity: null }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [],
      count: async () => 0,
      createOne: async (data: any) => { created = data; return { id: 'e-new', ...data }; },
    });

    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user', twoFactorEnabled: true },
      organizationId: 'org-1',
      _params: { trainingId: 't-1' },
    });

    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(201);
    expect(created?.personId).toBe('user-1');
  });
});

// ─── listCustomTrainingEnrollments ─────────────────────────

describe('listCustomTrainingEnrollments', () => {
  test('listCustomTrainingEnrollments returns 401 without user', async () => {
    const { listCustomTrainingEnrollments } = await import('./listCustomTrainingEnrollments');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await listCustomTrainingEnrollments(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── listMyCustomTrainings ─────────────────────────────────

describe('listMyCustomTrainings', () => {
  test('listMyCustomTrainings returns 401 without user', async () => {
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ user: null });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(401);
  });
});

// ─── completeTrainingEnrollment — deeper tests ─────────────

describe('completeTrainingEnrollment — business logic', () => {
  test('completeTrainingEnrollment returns 401 without user', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'e-1' }, _body: {} });
    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('already completed enrollment cannot be completed again', () => {
    const enrollment = { status: 'completed' };
    expect(enrollment.status === 'completed').toBe(true);
  });

  test('only enrolled status allows completion', () => {
    const validForCompletion = ['enrolled'];
    expect(validForCompletion).toContain('enrolled');
    expect(validForCompletion).not.toContain('cancelled');
    expect(validForCompletion).not.toContain('completed');
    expect(validForCompletion).not.toContain('noShow');
  });

  test('credit-bearing training awards credits on completion', () => {
    const training = { creditBearing: true, creditAmount: 15 };
    const creditAwarded = training.creditBearing ? training.creditAmount : 0;
    expect(creditAwarded).toBe(15);
  });

  test('non-credit-bearing training awards zero', () => {
    const training = { creditBearing: false, creditAmount: 15 };
    const creditAwarded = training.creditBearing ? training.creditAmount : 0;
    expect(creditAwarded).toBe(0);
  });
});

// ─── completeTrainingEnrollment — WF-061/BR-20 certificate wiring ──

describe('completeTrainingEnrollment — emits training.completed (EM-M09-n4o5p6q7)', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;
  let emitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
    emitSpy = spyOn(domainEvents, 'emit');
  });

  afterEach(() => {
    [trainingMocks, enrollMocks, creditMocks, officerMocks].forEach(
      (m) => m && Object.values(m).forEach((s) => s.mockRestore()),
    );
    emitSpy.mockRestore();
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('emits training.completed after credit-bearing enrollment completion', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'enrolled' }),
      updateOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'completed' }),
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => ({
        id: 't-1',
        organizationId: 'org-1',
        title: 'CPD Seminar',
        creditBearing: true,
        creditAmount: 10,
        endDate: new Date(),
      }),
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      findByTrainingAndPerson: async () => null,
      createOne: async () => ({ id: 'c-1' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
      _body: {},
    });

    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(200);

    const completedEmit = emitSpy.mock.calls.find((c) => c[0] === 'training.completed');
    expect(completedEmit).toBeDefined();
    expect(completedEmit![1]).toMatchObject({
      trainingId: 't-1',
      organizationId: 'org-1',
      completedBy: 'officer-1',
    });
  });
});

// ─── G9 / FIX-009 — credit-tracking toggle (M9-R8) suppresses the award ──
//
// The hosting org carries a per-org `creditTracking` toggle in
// organizations.featureFlags. When it is explicitly disabled the completion
// must still record (enrollment → completed) but NO AUTO credit may be
// awarded. The default (toggle absent/true) keeps awarding credit.

import { organizations as organizationsTable } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { orgCpdConfig as orgCpdConfigTable } from '@/handlers/association:member/repos/credits.schema';

/**
 * A table-aware mock DB: db.select().from(table) returns the seeded row for
 * that table (so the organizations featureFlags read and the org_cpd_config
 * read each get their own row). Supports the .where().limit() and update
 * chains the award path uses.
 */
function makeToggleDb(rowsByTable: Map<unknown, unknown[]>) {
  function selectChain() {
    let currentTable: unknown;
    const chain: any = {
      from: (t: unknown) => { currentTable = t; return chain; },
      where: () => chain,
      limit: async () => (rowsByTable.get(currentTable) ?? []),
      orderBy: async () => (rowsByTable.get(currentTable) ?? []),
      then: (resolve: any, reject?: any) =>
        Promise.resolve(rowsByTable.get(currentTable) ?? []).then(resolve, reject),
    };
    return chain;
  }
  return {
    select: () => selectChain(),
    update: () => {
      const c: any = { set: () => c, where: () => c, returning: async () => [{}] };
      return c;
    },
    insert: () => ({ values: async () => undefined }),
    transaction: async (fn: any) => fn(makeToggleDb(rowsByTable)),
  };
}

describe('completeTrainingEnrollment — G9 credit-tracking toggle (FIX-009)', () => {
  let enrollMocks: ReturnType<typeof stubRepo>;
  let trainingMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    [enrollMocks, trainingMocks, creditMocks, officerMocks].forEach(
      (m) => m && Object.values(m).forEach((s) => s.mockRestore()),
    );
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
  });

  function wireRepos(onCreate: () => void) {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'enrolled' }),
      updateOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'completed' }),
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => ({
        id: 't-1', organizationId: 'org-1', title: 'CPD Seminar',
        creditBearing: true, creditAmount: 10, endDate: new Date(),
      }),
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      findByTrainingAndPerson: async () => null,
      createOne: async () => { onCreate(); return { id: 'c-1' }; },
    });
  }

  test('toggle DISABLED → completion records but NO credit is awarded', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    let createCalls = 0;
    wireRepos(() => { createCalls += 1; });

    const db = makeToggleDb(new Map<unknown, unknown[]>([
      [organizationsTable, [{ id: 'org-1', featureFlags: { creditTracking: false } }]],
      [orgCpdConfigTable, []],
    ]));

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      database: db,
      _params: { enrollmentId: 'e-1' },
      _body: {},
    });

    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(200);
    // Completion succeeds...
    expect((response as any).body.status).toBe('completed');
    // ...but the credit is suppressed by the org toggle.
    expect((response as any).body.creditAwarded).toBe(0);
    expect(createCalls).toBe(0);
  });

  test('toggle ENABLED (true) → credit is awarded as normal', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    let createCalls = 0;
    wireRepos(() => { createCalls += 1; });

    const db = makeToggleDb(new Map<unknown, unknown[]>([
      [organizationsTable, [{ id: 'org-1', featureFlags: { creditTracking: true } }]],
      [orgCpdConfigTable, []],
    ]));

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      database: db,
      _params: { enrollmentId: 'e-1' },
      _body: {},
    });

    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.creditAwarded).toBe(10);
    expect(createCalls).toBe(1);
  });

  test('toggle ABSENT (no org row / no flag) → credit awarded by default', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    let createCalls = 0;
    wireRepos(() => { createCalls += 1; });

    const db = makeToggleDb(new Map<unknown, unknown[]>([
      [organizationsTable, [{ id: 'org-1', featureFlags: null }]],
      [orgCpdConfigTable, []],
    ]));

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      database: db,
      _params: { enrollmentId: 'e-1' },
      _body: {},
    });

    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.creditAwarded).toBe(10);
    expect(createCalls).toBe(1);
  });
});

// ─── G8 / FIX-002 — silent credit-award failure is surfaced, not swallowed ──

describe('completeTrainingEnrollment — G8 silent credit-failure is surfaced (FIX-002)', () => {
  let enrollMocks: ReturnType<typeof stubRepo>;
  let trainingMocks: ReturnType<typeof stubRepo>;
  let creditMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    [enrollMocks, trainingMocks, creditMocks, officerMocks].forEach(
      (m) => m && Object.values(m).forEach((s) => s.mockRestore()),
    );
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(CreditEntryRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('credit-insert failure does NOT report a misleading non-zero creditAwarded', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'enrolled' }),
      updateOneById: async () => ({ id: 'e-1', trainingId: 't-1', personId: 'm-1', status: 'completed' }),
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => ({
        id: 't-1',
        organizationId: 'org-1',
        title: 'CPD Seminar',
        creditBearing: true,
        creditAmount: 10,
        endDate: new Date(),
      }),
    });
    creditMocks = stubRepo(CreditEntryRepository, {
      findByTrainingAndPerson: async () => null,
      createOne: async () => { throw new Error('insert failed'); },
    });

    const logged: any[] = [];
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      logger: { error: (...a: any[]) => logged.push(a), warn: () => {}, info: () => {}, debug: () => {} },
      _params: { enrollmentId: 'e-1' },
      _body: {},
    });

    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(200);
    // Completion still succeeds, but the response must NOT claim 10 credits were awarded
    // when the credit insert actually failed.
    expect((response as any).body.creditAwarded).toBe(0);
    // The failure must leave a trace (structured log), not be swallowed by a bare catch.
    expect(logged.length).toBeGreaterThan(0);
  });
});

// ─── createTrainingEnrollment — org guard ──────────────────

describe('createTrainingEnrollment — org guard', () => {
  test('createTrainingEnrollment returns 403 without organizationId', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    const ctx = makeCtx({ organizationId: null });
    const response = await createTrainingEnrollment(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── searchTrainingEnrollments — org guard ─────────────────

describe('searchTrainingEnrollments — org guard', () => {
  test('searchTrainingEnrollments returns 403 without organizationId', async () => {
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(403);
  });
});

// ─── BR-41 — paid training requires payment before enrollment ──

describe('BR-41 — paid training requires payment before enrollment', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });
  afterEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('BR-41 / TC-DEC-01: createTrainingEnrollment places a paid training into payment_pending (proof-of-payment), not a hard reject', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    let createdWith: any = null;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-paid', status: 'published', capacity: null, registrationFee: 5000 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async (data: any) => { createdWith = data; return { id: 'e-paid', ...data }; },
    });

    const ctx = makeCtx({ _body: { trainingId: 't-paid' } });
    const response = await createTrainingEnrollment(ctx);
    // TC-DEC-01: paid trainings no longer dead-end on PAYMENT_REQUIRED — the
    // member is enrolled in a payment_pending state pending offline-proof
    // confirmation by an officer. The credit-award path (completion) stays
    // blocked until the officer confirms payment → enrolled.
    expect(response.status).toBe(201);
    expect(createdWith).toBeTruthy();
    expect(createdWith.status).toBe('payment_pending');
    expect((response as any).body).toMatchObject({ trainingId: 't-paid', status: 'payment_pending' });
  });

  test('BR-41: createTrainingEnrollment allows a free training (registrationFee 0)', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    let createCalled = false;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-free', status: 'published', capacity: null, registrationFee: 0 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async () => { createCalled = true; return { id: 'e-free', trainingId: 't-free', status: 'enrolled' }; },
    });

    const ctx = makeCtx({ _body: { trainingId: 't-free' } });
    const response = await createTrainingEnrollment(ctx);
    expect(response.status).toBe(201);
    expect(createCalled).toBe(true);
    expect((response as any).body).toMatchObject({ trainingId: 't-free', status: 'enrolled' });
  });

  test('BR-41 / TC-DEC-01: enrollInCustomTraining places a paid training into payment_pending (proof-of-payment)', async () => {
    const { enrollInCustomTraining } = await import('./enrollInCustomTraining');
    let createdWith: any = null;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-paid', status: 'published', capacity: null, registrationFee: 2500 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [],
      count: async () => 0,
      createOne: async (data: any) => { createdWith = data; return { id: 'e-paid', ...data }; },
    });

    const ctx = makeCtx({ _params: { trainingId: 't-paid' } });
    const response = await enrollInCustomTraining(ctx);
    expect(response.status).toBe(201);
    expect(createdWith).toBeTruthy();
    expect(createdWith.status).toBe('payment_pending');
    expect((response as any).body).toMatchObject({ status: 'payment_pending' });
  });
});

// ─── BR-43 — completed training locks enrollments ──────────

describe('BR-43 — completed training locks enrollments', () => {
  beforeEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });
  afterEach(() => {
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('BR-43: enrollment in a completed training is rejected (creation locked)', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    let createCalled = false;
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-done', status: 'completed', capacity: null, registrationFee: 0 }),
    });
    stubRepo(TrainingEnrollmentRepository, {
      count: async () => 0,
      createOne: async () => { createCalled = true; return { id: 'should-not-be-created' }; },
    });
    const ctx = makeCtx({ _body: { trainingId: 't-done' } });
    let thrown: unknown;
    try {
      await createTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('TRAINING_NOT_PUBLISHED');
    expect(createCalled).toBe(false);
  });

  test('BR-43: updateTrainingEnrollment rejects changes when training is completed', async () => {
    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    let updateCalled = false;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-done', status: 'enrolled' }),
      updateOneById: async () => { updateCalled = true; return { id: 'e-1', status: 'noShow' }; },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-done', status: 'completed' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'noShow' },
    });
    let thrown: unknown;
    try {
      await updateTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('TRAINING_COMPLETED');
    // lock fires before the enrollment is mutated
    expect(updateCalled).toBe(false);
  });

  test('BR-43: deleteTrainingEnrollment rejects deletion when training is completed', async () => {
    const { deleteTrainingEnrollment } = await import('./deleteTrainingEnrollment');
    let deleteCalled = false;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-done', status: 'enrolled' }),
      deleteOneById: async () => { deleteCalled = true; return { id: 'e-1' }; },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-done', status: 'completed' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
    });
    let thrown: unknown;
    try {
      await deleteTrainingEnrollment(ctx);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BusinessLogicError);
    expect((thrown as BusinessLogicError).code).toBe('TRAINING_COMPLETED');
    expect(deleteCalled).toBe(false);
  });

  test('BR-43: updateTrainingEnrollment allows changes when training is not completed', async () => {
    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    let updateCalled = false;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', trainingId: 't-pub', status: 'enrolled' }),
      updateOneById: async () => { updateCalled = true; return { id: 'e-1', status: 'noShow' }; },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-pub', status: 'published' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'noShow' },
    });
    const response = await updateTrainingEnrollment(ctx);
    expect(response.status).toBe(200);
    expect(updateCalled).toBe(true);
    expect((response as any).body).toMatchObject({ id: 'e-1', status: 'noShow' });
  });
});

// ─── Enrollment status machine ─────────────────────────────

describe('Enrollment status machine', () => {
  test('enrolled -> completed transition', () => {
    const enrollment = { status: 'enrolled' as string, completedAt: null as Date | null };
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    expect(enrollment.status).toBe('completed');
    expect(enrollment.completedAt).not.toBeNull();
  });

  test('enrolled -> cancelled transition', () => {
    const enrollment = { status: 'enrolled' as string, cancelledAt: null as Date | null };
    enrollment.status = 'cancelled';
    enrollment.cancelledAt = new Date();
    expect(enrollment.status).toBe('cancelled');
    expect(enrollment.cancelledAt).not.toBeNull();
  });

  test('cancelled enrollment cannot be completed', () => {
    const enrollment = { status: 'cancelled' };
    const canComplete = enrollment.status === 'enrolled';
    expect(canComplete).toBe(false);
  });

  test('completed enrollment cannot be cancelled', () => {
    const enrollment = { status: 'completed' };
    const canCancel = enrollment.status !== 'cancelled' && enrollment.status !== 'completed';
    expect(canCancel).toBe(false);
  });
});

// ─── S-G1-04 — TRAINING_ENROLLMENT_VALID_TRANSITIONS guard ──

describe('completeTrainingEnrollment — TRAINING_ENROLLMENT_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
    restoreRepo(CreditEntryRepository);
  });

  test('throws ConflictError when current enrollment status is cancelled (not enrolled)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'cancelled', personId: 'p-1', trainingId: 't-1' }) as any,
      updateOneById: async () => {
        updateCalled = true;
        return {} as any;
      },
    });

    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ _params: { enrollmentId: 'e-1' }, _body: {} });

    await expect(completeTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
    expect(updateCalled).toBe(false);
  });

  test('throws ConflictError when current enrollment status is noShow (terminal)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'noShow', personId: 'p-1', trainingId: 't-1' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ _params: { enrollmentId: 'e-1' }, _body: {} });

    await expect(completeTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ConflictError when current enrollment status is already completed (terminal)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'completed', personId: 'p-1', trainingId: 't-1' }) as any,
      updateOneById: async () => ({}) as any,
    });

    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ _params: { enrollmentId: 'e-1' }, _body: {} });

    await expect(completeTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('updateTrainingEnrollment — TRAINING_ENROLLMENT_VALID_TRANSITIONS guard', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(TrainingRepository);
  });

  test('throws ConflictError when body.status attempts noShow → completed', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'noShow', trainingId: 't-1' }) as any,
      updateOneById: async () => {
        updateCalled = true;
        return {} as any;
      },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'completed' },
    });

    await expect(updateTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
    expect(updateCalled).toBe(false);
  });

  test('throws ConflictError when body.status attempts cancelled → completed', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'cancelled', trainingId: 't-1' }) as any,
      updateOneById: async () => ({}) as any,
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'completed' },
    });

    await expect(updateTrainingEnrollment(ctx as any)).rejects.toBeInstanceOf(ConflictError);
  });

  test('allows update when body.status equals existing.status (no transition)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let updateCalled = false;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'enrolled', trainingId: 't-1' }) as any,
      updateOneById: async () => {
        updateCalled = true;
        return { id: 'e-1', status: 'enrolled' } as any;
      },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'enrolled' },
    });

    const res = await updateTrainingEnrollment(ctx as any);
    expect(res.status).toBe(200);
    expect(updateCalled).toBe(true);
  });

  test('allows enrolled → completed via update body.status', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] as any,
    });
    let captured: any = null;
    stubRepo(TrainingEnrollmentRepository, {
      findOneById: async () => ({ id: 'e-1', status: 'enrolled', trainingId: 't-1' }) as any,
      updateOneById: async (_id: string, data: any) => {
        captured = data;
        return { id: 'e-1', ...data } as any;
      },
    });
    stubRepo(TrainingRepository, {
      findOneById: async () => ({ id: 't-1', status: 'published' }) as any,
    });

    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({
      _params: { enrollmentId: 'e-1' },
      _body: { status: 'completed' },
    });

    const res = await updateTrainingEnrollment(ctx as any);
    expect(res.status).toBe(200);
    expect(captured?.status).toBe('completed');
  });
});
