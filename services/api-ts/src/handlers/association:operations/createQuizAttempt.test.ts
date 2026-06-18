import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createQuizAttempt } from './createQuizAttempt';
import { CourseRepository, QuizAttemptRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('createQuizAttempt — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: { courseId: 'c-1', answers: [] } });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { courseId: 'c-1', answers: [] } });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(403);
  });
});

describe('createQuizAttempt — business logic', () => {
  let courseMocks: ReturnType<typeof stubRepo>;
  let quizMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseRepository);
    restoreRepo(QuizAttemptRepository);
  });

  afterEach(() => {
    if (courseMocks) Object.values(courseMocks).forEach((m) => m.mockRestore());
    if (quizMocks) Object.values(quizMocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseRepository);
    restoreRepo(QuizAttemptRepository);
  });

  test('creates quiz attempt with computed pass=true at 70%', async () => {
    const course = { id: 'course-1', title: 'First Aid' };
    courseMocks = stubRepo(CourseRepository, {
      findOneById: async () => course,
    });
    quizMocks = stubRepo(QuizAttemptRepository, {
      createOne: async (data: any) => ({ id: 'qa-1', ...data }),
    });

    const ctx = makeCtx({
      _body: { courseId: 'course-1', score: 70, maxScore: 100, answers: [] },
    });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(201);
    expect((response as any).body.passed).toBe(true);
    expect((response as any).body.score).toBe(70);
    expect((response as any).body.maxScore).toBe(100);
  });

  test('pass=false when score is below 70%', async () => {
    const course = { id: 'course-1', title: 'First Aid' };
    courseMocks = stubRepo(CourseRepository, {
      findOneById: async () => course,
    });
    quizMocks = stubRepo(QuizAttemptRepository, {
      createOne: async (data: any) => ({ id: 'qa-2', ...data }),
    });

    const ctx = makeCtx({
      _body: { courseId: 'course-1', score: 69, maxScore: 100, answers: [] },
    });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(201);
    expect((response as any).body.passed).toBe(false);
  });

  test('pass=true at exactly 70% boundary', async () => {
    const course = { id: 'course-1' };
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    quizMocks = stubRepo(QuizAttemptRepository, {
      createOne: async (data: any) => ({ id: 'qa-3', ...data }),
    });

    const ctx = makeCtx({
      _body: { courseId: 'course-1', score: 7, maxScore: 10, answers: [] },
    });
    const response = await createQuizAttempt(ctx);
    expect((response as any).body.passed).toBe(true);
  });

  test('pass=false when score is 69/100 (just below threshold)', async () => {
    const course = { id: 'course-1' };
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    quizMocks = stubRepo(QuizAttemptRepository, {
      createOne: async (data: any) => ({ id: 'qa-4', ...data }),
    });

    const ctx = makeCtx({
      _body: { courseId: 'course-1', score: 69, maxScore: 100, answers: [] },
    });
    const response = await createQuizAttempt(ctx);
    expect((response as any).body.passed).toBe(false);
  });

  test('pass=false when maxScore is 0 (avoids division by zero)', async () => {
    const course = { id: 'course-1' };
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    quizMocks = stubRepo(QuizAttemptRepository, {
      createOne: async (data: any) => ({ id: 'qa-5', ...data }),
    });

    const ctx = makeCtx({
      _body: { courseId: 'course-1', score: 0, maxScore: 0, answers: [] },
    });
    const response = await createQuizAttempt(ctx);
    expect((response as any).body.passed).toBe(false);
  });

  test('defaults personId to current user when not provided', async () => {
    const course = { id: 'course-1' };
    let capturedData: any = null;
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    quizMocks = stubRepo(QuizAttemptRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'qa-6', ...data };
      },
    });

    const ctx = makeCtx({
      user: { id: 'user-99', role: 'user', twoFactorEnabled: true },
      _body: { courseId: 'course-1', score: 80, maxScore: 100, answers: [] },
    });
    await createQuizAttempt(ctx);
    expect(capturedData.personId).toBe('user-99');
  });

  test('throws NotFoundError when course does not exist', async () => {
    courseMocks = stubRepo(CourseRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _body: { courseId: 'no-such-course', score: 80, maxScore: 100, answers: [] },
    });
    await expect(createQuizAttempt(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
