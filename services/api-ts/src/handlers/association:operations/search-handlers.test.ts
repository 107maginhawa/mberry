import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import {
  TrainingRepository,
  TrainingEnrollmentRepository,
  CourseRepository,
  CourseEnrollmentRepository,
  QuizAttemptRepository,
} from './repos/training.repo';
import { EventRegistrationRepository } from './repos/events.repo';

/**
 * Search Handlers Tests
 *
 * Happy-path + auth guard tests for search/list handlers that use
 * the standard findMany/count repo pattern with pagination.
 */

// ═══════════════════════════════════════════════════════════════════════════
// searchTrainings
// ═══════════════════════════════════════════════════════════════════════════

describe('searchTrainings', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(TrainingRepository);
  });

  test('returns 401 without user', async () => {
    const { searchTrainings } = await import('./searchTrainings');
    const ctx = makeCtx({ user: null });
    const response = await searchTrainings(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { searchTrainings } = await import('./searchTrainings');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchTrainings(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 200 with empty results', async () => {
    mocks = stubRepo(TrainingRepository, {
      findMany: async () => [],
      count: async () => 0,
    });
    const { searchTrainings } = await import('./searchTrainings');
    const ctx = makeCtx({ _query: {} });
    const response = await searchTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalCount).toBe(0);
  });

  test('returns 200 with paginated results', async () => {
    const fakeTrainings = [
      { id: 'tr-1', title: 'CPD Workshop', status: 'published' },
      { id: 'tr-2', title: 'Ethics Seminar', status: 'draft' },
    ];
    mocks = stubRepo(TrainingRepository, {
      findMany: async () => fakeTrainings,
      count: async () => 5,
    });
    const { searchTrainings } = await import('./searchTrainings');
    const ctx = makeCtx({ _query: { limit: '2', offset: '0' } });
    const response = await searchTrainings(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(2);
    expect(response.body.pagination.totalCount).toBe(5);
    expect(response.body.pagination.hasNextPage).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// searchCourses
// ═══════════════════════════════════════════════════════════════════════════

describe('searchCourses', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(CourseRepository);
  });

  test('returns 401 without user', async () => {
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ user: null });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 200 with course results', async () => {
    const fakeCourses = [
      { id: 'crs-1', title: 'Dental Anatomy 101', status: 'active' },
    ];
    mocks = stubRepo(CourseRepository, {
      findMany: async () => fakeCourses,
      count: async () => 1,
    });
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ _query: { limit: '10', offset: '0' } });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.totalCount).toBe(1);
  });

  test('returns 200 with empty results', async () => {
    mocks = stubRepo(CourseRepository, {
      findMany: async () => [],
      count: async () => 0,
    });
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ _query: {} });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.totalCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// searchQuizAttempts
// ═══════════════════════════════════════════════════════════════════════════

describe('searchQuizAttempts', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(QuizAttemptRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(QuizAttemptRepository);
  });

  test('returns 401 without user', async () => {
    const { searchQuizAttempts } = await import('./searchQuizAttempts');
    const ctx = makeCtx({ user: null });
    const response = await searchQuizAttempts(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { searchQuizAttempts } = await import('./searchQuizAttempts');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchQuizAttempts(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 200 with quiz attempt results', async () => {
    const fakeAttempts = [
      { id: 'qa-1', courseId: 'crs-1', personId: 'p-1', score: 85, passed: true },
    ];
    mocks = stubRepo(QuizAttemptRepository, {
      findMany: async () => fakeAttempts,
      count: async () => 1,
    });
    const { searchQuizAttempts } = await import('./searchQuizAttempts');
    const ctx = makeCtx({ _query: { courseId: 'crs-1' } });
    const response = await searchQuizAttempts(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.totalCount).toBe(1);
  });

  test('returns 200 with empty results when no attempts match', async () => {
    mocks = stubRepo(QuizAttemptRepository, {
      findMany: async () => [],
      count: async () => 0,
    });
    const { searchQuizAttempts } = await import('./searchQuizAttempts');
    const ctx = makeCtx({ _query: {} });
    const response = await searchQuizAttempts(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// searchEventRegistrations
// ═══════════════════════════════════════════════════════════════════════════

describe('searchEventRegistrations', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRegistrationRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(EventRegistrationRepository);
  });

  test('returns 401 without user', async () => {
    const { searchEventRegistrations } = await import('./searchEventRegistrations');
    const ctx = makeCtx({ user: null });
    const response = await searchEventRegistrations(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { searchEventRegistrations } = await import('./searchEventRegistrations');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchEventRegistrations(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 200 with registration results', async () => {
    const fakeRegs = [
      { id: 'reg-1', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' },
      { id: 'reg-2', eventId: 'evt-1', personId: 'p-2', status: 'waitlisted' },
    ];
    mocks = stubRepo(EventRegistrationRepository, {
      findMany: async () => fakeRegs,
      count: async () => 2,
    });
    const { searchEventRegistrations } = await import('./searchEventRegistrations');
    const ctx = makeCtx({ _query: { eventId: 'evt-1' } });
    const response = await searchEventRegistrations(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(2);
    expect(response.body.totalCount).toBe(2);
  });

  test('filters by status when provided', async () => {
    const fakeRegs = [
      { id: 'reg-1', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' },
    ];
    mocks = stubRepo(EventRegistrationRepository, {
      findMany: async () => fakeRegs,
      count: async () => 1,
    });
    const { searchEventRegistrations } = await import('./searchEventRegistrations');
    const ctx = makeCtx({ _query: { status: 'confirmed' } });
    const response = await searchEventRegistrations(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// searchTrainingEnrollments
// ═══════════════════════════════════════════════════════════════════════════

describe('searchTrainingEnrollments', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(TrainingEnrollmentRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(TrainingEnrollmentRepository);
  });

  test('returns 401 without user', async () => {
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ user: null });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 200 with enrollment results', async () => {
    const fakeEnrollments = [
      { id: 'enr-1', trainingId: 'tr-1', personId: 'p-1', status: 'enrolled' },
    ];
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => fakeEnrollments,
      count: async () => 1,
    });
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ _query: { trainingId: 'tr-1' } });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.totalCount).toBe(1);
  });

  test('returns 200 with empty results', async () => {
    mocks = stubRepo(TrainingEnrollmentRepository, {
      findMany: async () => [],
      count: async () => 0,
    });
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ _query: {} });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.totalCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// searchCourseEnrollments
// ═══════════════════════════════════════════════════════════════════════════

describe('searchCourseEnrollments', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseEnrollmentRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
    restoreRepo(CourseEnrollmentRepository);
  });

  test('returns 401 without user', async () => {
    const { searchCourseEnrollments } = await import('./searchCourseEnrollments');
    const ctx = makeCtx({ user: null });
    const response = await searchCourseEnrollments(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const { searchCourseEnrollments } = await import('./searchCourseEnrollments');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchCourseEnrollments(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 200 with enrollment results', async () => {
    const fakeEnrollments = [
      { id: 'cenr-1', courseId: 'crs-1', personId: 'p-1', status: 'active' },
    ];
    mocks = stubRepo(CourseEnrollmentRepository, {
      findMany: async () => fakeEnrollments,
      count: async () => 1,
    });
    const { searchCourseEnrollments } = await import('./searchCourseEnrollments');
    const ctx = makeCtx({ _query: { courseId: 'crs-1' } });
    const response = await searchCourseEnrollments(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.totalCount).toBe(1);
  });
});
