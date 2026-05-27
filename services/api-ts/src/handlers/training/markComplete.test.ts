// Business Rules: [BR-11] [BR-13]
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeTraining as createFakeTraining, fakeEnrollment as createFakeEnrollment } from '@/test-utils/factories';
import { markComplete } from './markComplete';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { OrganizationRepository, AssociationRepository } from '../platformadmin/repos/platform-admin.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

const fakeTraining = createFakeTraining({
  organizationId: 'org-1',
  title: 'CPD Seminar',
  status: 'completed',
  capacity: 50,
  creditAmount: 8,
  endDate: new Date('2024-01-01'), // Past date — BR-20 requires activity to have ended
});

const fakeEnrollment = createFakeEnrollment({
  orgId: 'org-1',
  trainingId: 'training-1',
  personId: 'person-1',
  status: 'enrolled',
  cancelledAt: null,
});

describe('markComplete', () => {
  let mocks: ReturnType<typeof stubRepo>;

  // Default officer stub — all tests assume caller is an officer (auth-enforcement.test.ts covers non-officer case)
  function stubOfficer() {
    return stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }],
    });
  }

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OrganizationRepository);
    restoreRepo(AssociationRepository);
  });

  // Default org/association stubs for credit-path tests (2yr cycle, no fixed start)
  function stubOrgAssocDefaults(overrides?: { creditCyclePeriod?: number; cycleStartMonth?: number | null; cycleStartDay?: number | null }) {
    const orgMock = stubRepo(OrganizationRepository, {
      findById: async () => ({ id: 'org-1', associationId: 'assoc-1', name: 'Test Org', status: 'active' }),
    });
    const assocMock = stubRepo(AssociationRepository, {
      findById: async () => ({
        id: 'assoc-1',
        name: 'Test Association',
        creditCyclePeriod: overrides?.creditCyclePeriod ?? 2,
        requiredCreditsPerCycle: 40,
        carryoverEnabled: false,
        cycleStartMonth: overrides?.cycleStartMonth ?? null,
        cycleStartDay: overrides?.cycleStartDay ?? null,
      }),
    });
    return { orgMock, assocMock };
  }

  test('marks enrollment as completed and returns 201', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('completed');
  });

  test('throws NotFoundError when training does not exist', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => undefined,
      getEnrollmentCount: async () => 0,
      listEnrollments: async () => [],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-id', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Training not found');
  });

  test('throws ConflictError when no active enrollment exists', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 0,
      listEnrollments: async () => [],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('No active enrollment found');
  });

  test('throws NotFoundError when person is not enrolled', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{ ...fakeEnrollment, personId: 'other-person' }],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Enrollment not found');
  });

  test('throws ConflictError when already completed', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{
        ...fakeEnrollment,
        status: 'completed',
        completedAt: new Date(),
      }],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('Already marked as completed');
  });

  // ─── [BR-13] Auto-credit creation ─────────────────────

  test('[BR-13] creates auto credit entry for credit-bearing training', async () => {
    stubOfficer();
    let creditCreated: any = null;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    // Also stub credit repo
    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    // Stub membership repo for registration date lookup
    const memberMock = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2023-06-01',
        status: 'active',
      }),
    });

    stubOrgAssocDefaults();

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();
    expect(creditCreated.type).toBe('auto');
    expect(creditCreated.trainingId).toBe('training-1');
    expect(creditCreated.creditAmount).toBe(8);
    expect(creditCreated.personId).toBe('person-1');

    Object.values(creditMock).forEach((m) => m.mockRestore());
    Object.values(memberMock).forEach((m) => m.mockRestore());
  });

  test('[BR-13] skips credit creation for non-credit-bearing training', async () => {
    stubOfficer();
    let creditCreated = false;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, creditAmount: 0 }),
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCreated = true; return {} as any; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await markComplete(ctx);
    expect(creditCreated).toBe(false);

    Object.values(creditMock).forEach((m) => m.mockRestore());
  });

  // ─── [M9-R7] Duplicate credit prevention (idempotent) ──────

  test('[M9-R7] already-completed enrollment prevents duplicate credit award', async () => {
    stubOfficer();
    let creditCallCount = 0;
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{
        ...fakeEnrollment,
        completedAt: new Date('2026-01-15'),
      }],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async () => { creditCallCount++; return {} as any; },
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    // Should throw before reaching credit creation
    await expect(markComplete(ctx)).rejects.toThrow('Already marked as completed');
    expect(creditCallCount).toBe(0);

    Object.values(creditMock).forEach((m) => m.mockRestore());
  });

  // ─── [BR-20] Cancelled training blocks completion ──────────

  test('[BR-20] cancelled training blocks markComplete', async () => {
    stubOfficer();
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, status: 'cancelled' }),
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('cancelled');
  });

  // ─── [BR-20] Future end date blocks completion ──────────

  test('[BR-20] future end date blocks markComplete', async () => {
    stubOfficer();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => ({ ...fakeTraining, status: 'published', endDate: futureDate }),
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async () => fakeEnrollment,
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow('has not ended yet');
  });

  // ─── [V-12] Credit cycle anchored to member registration date ──────

  test('[V-12] credit cycle is anchored to member registration date, not activity date', async () => {
    stubOfficer();
    let creditCreated: any = null;

    // Member registered Jan 2023, training ends Dec 2025
    // Cycle should anchor to Jan 2023, NOT Dec 2025
    const trainingWithLateEnd = {
      ...fakeTraining,
      endDate: new Date('2025-12-15'),
      organizationId: 'org-1',
    };

    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => trainingWithLateEnd,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    const memberMock = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2023-01-15',
        status: 'active',
      }),
    });

    stubOrgAssocDefaults();

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();

    // With registration Jan 15 2023 and 2-year cycles, the cycle containing Dec 2025 is:
    // Cycle 1: ~Jan 14 2025 to ~Jan 14 2027 (anchored to registration date)
    // Bug behavior: cycle start = Dec 15 2025 (activity date used as anchor)
    // Fixed behavior: cycle start ~= Jan 14 2025 (registration-anchored)
    const cycleStart = creditCreated.cycleStart;
    // Cycle start must NOT equal the activity date (Dec 15 2025)
    expect(cycleStart.getMonth()).not.toBe(11); // Not December
    // Should be anchored near registration month (January)
    expect(cycleStart.getMonth()).toBe(0); // January

    Object.values(creditMock).forEach((m) => m.mockRestore());
    Object.values(memberMock).forEach((m) => m.mockRestore());
  });

  test('[V-12] two members get different cycles based on their registration dates', async () => {
    stubOfficer();
    const creditEntries: any[] = [];

    const trainingDec2025 = {
      ...fakeTraining,
      endDate: new Date('2025-12-01'),
      organizationId: 'org-1',
    };

    // First member: registered Jan 2022
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => trainingDec2025,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{ ...fakeEnrollment, personId: 'person-A' }],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        personId: 'person-A',
        status,
      }),
    });

    const creditMock1 = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditEntries.push({ ...data, person: 'A' }); return { id: 'c-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    const memberMock1 = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-A',
        personId: 'person-A',
        organizationId: 'org-1',
        startDate: '2022-01-01',
        status: 'active',
      }),
    });

    const { orgMock: orgMock1, assocMock: assocMock1 } = stubOrgAssocDefaults();

    const ctx1 = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-A' },
    });

    await markComplete(ctx1);
    Object.values(creditMock1).forEach((m) => m.mockRestore());
    Object.values(memberMock1).forEach((m) => m.mockRestore());
    Object.values(orgMock1).forEach((m) => m.mockRestore());
    Object.values(assocMock1).forEach((m) => m.mockRestore());
    Object.values(mocks).forEach((m) => m.mockRestore());

    // Second member: registered Jul 2024
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => trainingDec2025,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [{ ...fakeEnrollment, personId: 'person-B' }],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        personId: 'person-B',
        status,
      }),
    });

    const creditMock2 = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditEntries.push({ ...data, person: 'B' }); return { id: 'c-2', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    const memberMock2 = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-B',
        personId: 'person-B',
        organizationId: 'org-1',
        startDate: '2024-07-01',
        status: 'active',
      }),
    });

    stubOrgAssocDefaults();

    const ctx2 = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-B' },
    });

    await markComplete(ctx2);
    Object.values(creditMock2).forEach((m) => m.mockRestore());
    Object.values(memberMock2).forEach((m) => m.mockRestore());

    // Both should have credit entries
    expect(creditEntries.length).toBe(2);
    const entryA = creditEntries.find((e) => e.person === 'A');
    const entryB = creditEntries.find((e) => e.person === 'B');

    // Different registration dates → different cycle starts
    // A: registered Jan 2022, 2-year cycles → cycle 1 starts ~Jan 2024
    // B: registered Jul 2024, 2-year cycles → cycle 0 starts Jul 2024
    // Both anchored differently, so cycle starts differ
    expect(entryA!.cycleStart.getTime()).not.toBe(entryB!.cycleStart.getTime());

    // A's cycle start should be in January (anchored to Jan registration)
    expect(entryA!.cycleStart.getMonth()).toBe(0); // January
    // B's cycle start should be in July (anchored to Jul registration)
    expect(entryB!.cycleStart.getMonth()).toBe(6); // July
  });

  test('[V-12] falls back to activity date when no membership found', async () => {
    stubOfficer();
    let creditCreated: any = null;
    const trainingDec2025 = {
      ...fakeTraining,
      endDate: new Date('2025-12-15'),
      organizationId: 'org-1',
    };

    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => trainingDec2025,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    // No membership found
    const memberMock = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
    });

    stubOrgAssocDefaults();

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();

    // Falls back to activity date (Dec 2025)
    expect(creditCreated.cycleStart.getFullYear()).toBe(2025);

    Object.values(creditMock).forEach((m) => m.mockRestore());
    Object.values(memberMock).forEach((m) => m.mockRestore());
  });

  // ─── [BR-11] Credit cycle configurable per association ──────

  test('[BR-11] uses association creditCyclePeriod instead of hardcoded 2', async () => {
    stubOfficer();
    let creditCreated: any = null;

    // Association configured with 3-year cycle
    const trainingPast = {
      ...fakeTraining,
      endDate: new Date('2024-06-01'),
      organizationId: 'org-1',
    };

    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => trainingPast,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    const memberMock = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2022-01-01',
        status: 'active',
      }),
    });

    // 3-year cycle configured on association
    stubOrgAssocDefaults({ creditCyclePeriod: 3 });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();

    // With 3-year cycle from Jan 2022: cycle 0 = Jan 2022 → Jan 2025, cycle 1 = Jan 2025 → Jan 2028
    // Activity Jun 2024 falls in cycle 0 (Jan 2022 → Jan 2025)
    const cycleStart = creditCreated.cycleStart;
    expect(cycleStart.getFullYear()).toBe(2022);
    expect(cycleStart.getMonth()).toBe(0); // January

    Object.values(creditMock).forEach((m) => m.mockRestore());
    Object.values(memberMock).forEach((m) => m.mockRestore());
  });

  test('[BR-11] uses fixed cycleStartMonth when configured on association', async () => {
    stubOfficer();
    let creditCreated: any = null;

    const trainingPast = {
      ...fakeTraining,
      endDate: new Date('2025-09-15'),
      organizationId: 'org-1',
    };

    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => trainingPast,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    const memberMock = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2023-03-01',
        status: 'active',
      }),
    });

    // Fixed July 1 start, 2-year cycle
    stubOrgAssocDefaults({ creditCyclePeriod: 2, cycleStartMonth: 7, cycleStartDay: 1 });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();

    // Fixed July 1 start with 2-year cycle: epoch-aligned
    // Sep 2025 falls in a cycle starting July 1 of an even year (2024 or 2026)
    const cycleStart = creditCreated.cycleStart;
    expect(cycleStart.getMonth()).toBe(6); // July (0-indexed)
    expect(cycleStart.getDate()).toBe(1);

    Object.values(creditMock).forEach((m) => m.mockRestore());
    Object.values(memberMock).forEach((m) => m.mockRestore());
  });

  test('[BR-11] defaults to 2-year cycle when association has no creditCyclePeriod', async () => {
    stubOfficer();
    let creditCreated: any = null;

    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => fakeTraining,
      getEnrollmentCount: async () => 1,
      listEnrollments: async () => [fakeEnrollment],
      updateEnrollmentStatus: async (_id: string, status: string) => ({
        ...fakeEnrollment,
        status,
      }),
    });

    const creditMock = stubRepo(CreditEntryRepository, {
      createOne: async (data: any) => { creditCreated = data; return { id: 'credit-1', ...data }; },
      findByTrainingAndPerson: async () => null,
    });

    const memberMock = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({
        id: 'mem-1',
        personId: 'person-1',
        organizationId: 'org-1',
        startDate: '2023-01-01',
        status: 'active',
      }),
    });

    // Association with null creditCyclePeriod — should default to 2
    const orgMock = stubRepo(OrganizationRepository, {
      findById: async () => ({ id: 'org-1', associationId: 'assoc-1', name: 'Test Org', status: 'active' }),
    });
    const assocMock = stubRepo(AssociationRepository, {
      findById: async () => ({
        id: 'assoc-1',
        name: 'Test Association',
        creditCyclePeriod: null,
        requiredCreditsPerCycle: null,
        carryoverEnabled: false,
        cycleStartMonth: null,
        cycleStartDay: null,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    const response = await markComplete(ctx);
    expect(response.status).toBe(201);
    expect(creditCreated).not.toBeNull();
    // Should still produce valid cycle dates (defaulting to 2yr)
    expect(creditCreated.cycleStart).toBeInstanceOf(Date);
    expect(creditCreated.cycleEnd).toBeInstanceOf(Date);

    Object.values(creditMock).forEach((m) => m.mockRestore());
    Object.values(memberMock).forEach((m) => m.mockRestore());
    Object.values(orgMock).forEach((m) => m.mockRestore());
    Object.values(assocMock).forEach((m) => m.mockRestore());
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(TrainingRepository, {
      getByOrg: async () => { throw new Error('should not reach'); },
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      database: undefined,
      _params: { id: 'training-1', organizationId: 'org-1' },
      _body: { personId: 'person-1' },
    });

    await expect(markComplete(ctx)).rejects.toThrow();
  });
});
