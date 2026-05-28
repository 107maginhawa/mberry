import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import {
  TrainingRepository,
  TrainingEnrollmentRepository,
  CourseRepository,
} from './repos/training.repo';
import { EventRegistrationRepository } from './repos/events.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

/**
 * Financial & lifecycle tests for untested association:operations handlers.
 *
 * Covers:
 *   - refundEventRegistration (financial mutation)
 *   - publishTraining (lifecycle gate)
 *   - createTraining (officer-gated creation)
 *   - createCourse (officer-gated creation)
 *   - completeCustomTraining (enrollment lifecycle)
 *   - cancelCustomTraining (enrollment lifecycle)
 *   - listMyCustomTrainings (personal query)
 */

// ─── refundEventRegistration ────────────────────────────────────────────────

describe('refundEventRegistration — financial guard', () => {
  let regMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  const confirmedReg = {
    id: 'reg-1',
    eventId: 'evt-1',
    personId: 'person-1',
    organizationId: 'org-1',
    status: 'confirmed',
    refundedAt: null,
  };

  afterEach(() => {
    if (regMocks) Object.values(regMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRegistrationRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await refundEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('requires officer position to refund', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    const response = await refundEventRegistration(ctx);
    expect(response.status).toBe(403);
  });

  test('throws NotFoundError for missing registration', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => null,
    });
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-missing' } });
    await expect(refundEventRegistration(ctx)).rejects.toThrow('Event registration not found');
  });

  test('throws on already-refunded registration', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => ({ ...confirmedReg, status: 'refunded' }),
    });
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    await expect(refundEventRegistration(ctx)).rejects.toThrow('Registration is already refunded');
  });

  test('refunds confirmed registration and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => confirmedReg,
      updateOneById: async (_id: string, data: any) => ({
        ...confirmedReg,
        ...data,
      }),
    });
    const { refundEventRegistration } = await import('./refundEventRegistration');
    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    const response = await refundEventRegistration(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('refunded');
    expect(response.body.refundedAt).not.toBeNull();
  });
});

// ─── publishTraining ─────────────────────────────────────────────────────────

describe('publishTraining — lifecycle gate', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  const draftTraining = {
    id: 'tr-1',
    organizationId: 'org-1',
    title: 'CPD Seminar',
    status: 'draft',
  };

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 'tr-1' } });
    const response = await publishTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('requires officer position to publish', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    const response = await publishTraining(ctx);
    expect(response.status).toBe(403);
  });

  test('throws NotFoundError for missing training', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => null,
    });
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-missing' } });
    await expect(publishTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('rejects publishing already-published training', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => ({ ...draftTraining, status: 'published' }),
    });
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    await expect(publishTraining(ctx)).rejects.toThrow(/Cannot transition training/);
  });

  test('publishes draft training and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, {
      findOneById: async () => draftTraining,
      publish: async () => ({ ...draftTraining, status: 'published', publishedAt: new Date() }),
    });
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    const response = await publishTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('published');
  });
});

// ─── createTraining ──────────────────────────────────────────────────────────

describe('createTraining — officer-gated creation', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ user: null, _body: {} });
    const response = await createTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organization context', async () => {
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ organizationId: null, _body: {} });
    const response = await createTraining(ctx);
    expect(response.status).toBe(403);
  });

  test('non-officers cannot create trainings', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ _body: { title: 'Test Training' } });
    const response = await createTraining(ctx);
    expect(response.status).toBe(403);
  });

  test('officers create training with draft status', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, {
      createOne: async (data: any) => ({
        id: 'tr-new',
        ...data,
        status: 'draft',
      }),
    });
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({
      _body: {
        title: 'CPD Seminar 2026',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        creditBearing: true,
        creditAmount: 4,
      },
    });
    const response = await createTraining(ctx);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
    expect(response.body.title).toBe('CPD Seminar 2026');
  });
});

// ─── createCourse ────────────────────────────────────────────────────────────

describe('createCourse — officer-gated creation', () => {
  let courseMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (courseMocks) Object.values(courseMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({ user: null, _body: {} });
    const response = await createCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organization context', async () => {
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({ organizationId: null, _body: {} });
    const response = await createCourse(ctx);
    expect(response.status).toBe(403);
  });

  test('non-officers cannot create courses', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({ _body: { title: 'Anatomy 101', creditAmount: 2 } });
    const response = await createCourse(ctx);
    expect(response.status).toBe(403);
  });

  test('officers create course with draft status', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    courseMocks = stubRepo(CourseRepository, {
      createOne: async (data: any) => ({
        id: 'course-new',
        ...data,
        status: 'draft',
      }),
    });
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({
      _body: { title: 'Dental Radiology', creditAmount: 3, description: 'X-ray fundamentals' },
    });
    const response = await createCourse(ctx);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
    expect(response.body.title).toBe('Dental Radiology');
  });
});

// ─── completeCustomTraining ──────────────────────────────────────────────────

describe('completeCustomTraining — enrollment lifecycle', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  const activeTraining = { id: 'tr-1', organizationId: 'org-1', status: 'published' };
  const activeEnrollment = { id: 'enroll-1', trainingId: 'tr-1', personId: 'user-1', status: 'enrolled' };

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (enrollMocks) Object.values(enrollMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { completeCustomTraining } = await import('./completeCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 'tr-1' } });
    const response = await completeCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('throws NotFoundError when training does not exist', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => null });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, { findMany: async () => [] });
    const { completeCustomTraining } = await import('./completeCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-missing' } });
    await expect(completeCustomTraining(ctx)).rejects.toThrow('Training not found');
  });

  test('throws when user has no enrollment', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => activeTraining });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, { findMany: async () => [] });
    const { completeCustomTraining } = await import('./completeCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    await expect(completeCustomTraining(ctx)).rejects.toThrow('No enrollment found for this training');
  });

  test('throws when completing already-completed enrollment', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => activeTraining });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [{ ...activeEnrollment, status: 'completed' }],
    });
    const { completeCustomTraining } = await import('./completeCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    await expect(completeCustomTraining(ctx)).rejects.toThrow('Enrollment is already completed');
  });

  test('marks active enrollment as completed with timestamp', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => activeTraining });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [activeEnrollment],
      updateOneById: async (_id: string, data: any) => ({ ...activeEnrollment, ...data }),
    });
    const { completeCustomTraining } = await import('./completeCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    const response = await completeCustomTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.completedAt).not.toBeNull();
  });
});

// ─── cancelCustomTraining ────────────────────────────────────────────────────

describe('cancelCustomTraining — enrollment lifecycle', () => {
  let trainingMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  const activeTraining = { id: 'tr-1', organizationId: 'org-1', status: 'published' };
  const activeEnrollment = { id: 'enroll-1', trainingId: 'tr-1', personId: 'user-1', status: 'enrolled' };

  afterEach(() => {
    if (trainingMocks) Object.values(trainingMocks).forEach((m) => m.mockRestore());
    if (enrollMocks) Object.values(enrollMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingRepository);
    restoreRepo(TrainingEnrollmentRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { cancelCustomTraining } = await import('./cancelCustomTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 'tr-1' } });
    const response = await cancelCustomTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('throws when already cancelled', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => activeTraining });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [{ ...activeEnrollment, status: 'cancelled' }],
    });
    const { cancelCustomTraining } = await import('./cancelCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    await expect(cancelCustomTraining(ctx)).rejects.toThrow('Enrollment is already cancelled');
  });

  test('throws when trying to cancel completed enrollment', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => activeTraining });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [{ ...activeEnrollment, status: 'completed' }],
    });
    const { cancelCustomTraining } = await import('./cancelCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    await expect(cancelCustomTraining(ctx)).rejects.toThrow('Cannot cancel a completed enrollment');
  });

  test('cancels active enrollment and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    trainingMocks = stubRepo(TrainingRepository, { findOneById: async () => activeTraining });
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [activeEnrollment],
      updateOneById: async (_id: string, data: any) => ({ ...activeEnrollment, ...data }),
    });
    const { cancelCustomTraining } = await import('./cancelCustomTraining');
    const ctx = makeCtx({ _params: { trainingId: 'tr-1' } });
    const response = await cancelCustomTraining(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('cancelled');
    expect(response.body.cancelledAt).not.toBeNull();
  });
});

// ─── listMyCustomTrainings ───────────────────────────────────────────────────

describe('listMyCustomTrainings — personal enrollment query', () => {
  let enrollMocks: ReturnType<typeof stubRepo>;

  const sampleEnrollments = [
    { id: 'enroll-1', trainingId: 'tr-1', personId: 'user-1', status: 'enrolled' },
    { id: 'enroll-2', trainingId: 'tr-2', personId: 'user-1', status: 'completed' },
  ];

  afterEach(() => {
    if (enrollMocks) Object.values(enrollMocks).forEach((m) => m.mockRestore());
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('returns 401 without authenticated user', async () => {
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({ user: null });
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(401);
  });

  test('returns list of enrollments for authenticated user', async () => {
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => sampleEnrollments,
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({});
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.total).toBe(2);
  });

  test('returns empty list when user has no enrollments', async () => {
    enrollMocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [],
    });
    const { listMyCustomTrainings } = await import('./listMyCustomTrainings');
    const ctx = makeCtx({});
    const response = await listMyCustomTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.total).toBe(0);
  });
});
