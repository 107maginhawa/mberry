import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateCourseProgress } from './updateCourseProgress';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

describe('updateCourseProgress — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'enr-1' }, _body: { progress: 50 } });
    const response = await updateCourseProgress(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateCourseProgress — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseEnrollmentRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseEnrollmentRepository);
  });

  test('updates progress for enrolled enrollment', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'user-1', status: 'enrolled', progress: 30 };
    const updated = { ...enrollment, progress: 60 };
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => enrollment,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'enr-1' },
      _body: { progress: 60 },
    });
    const response = await updateCourseProgress(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.progress).toBe(60);
  });

  test('auto-completes enrollment when progress reaches 100', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'user-1', status: 'enrolled', progress: 80 };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => enrollment,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...enrollment, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'enr-1' },
      _body: { progress: 100 },
    });
    const response = await updateCourseProgress(ctx);
    expect(response.status).toBe(200);
    expect(capturedUpdates['status']).toBe('completed');
    expect(capturedUpdates['progress']).toBe(100);
    expect(capturedUpdates['completedAt']).toBeInstanceOf(Date);
  });

  test('auto-completes when progress exceeds 100', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'user-1', status: 'enrolled', progress: 90 };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => enrollment,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...enrollment, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'enr-1' },
      _body: { progress: 105 },
    });
    await updateCourseProgress(ctx);
    // clamps to 100 on completion
    expect(capturedUpdates['progress']).toBe(100);
    expect(capturedUpdates['status']).toBe('completed');
  });

  test('throws NotFoundError for missing enrollment', async () => {
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'no-such' },
      _body: { progress: 50 },
    });
    await expect(updateCourseProgress(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when enrollment is not enrolled status', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'user-1', status: 'completed', progress: 100 };
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => enrollment,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'enr-1' },
      _body: { progress: 50 },
    });
    await expect(updateCourseProgress(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when enrollment is cancelled', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'user-1', status: 'cancelled', progress: 0 };
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => enrollment,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'enr-1' },
      _body: { progress: 10 },
    });
    await expect(updateCourseProgress(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('progress below 100 does not set completed status', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'user-1', status: 'enrolled', progress: 40 };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => enrollment,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...enrollment, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'enr-1' },
      _body: { progress: 99 },
    });
    await updateCourseProgress(ctx);
    expect(capturedUpdates['status']).toBeUndefined();
    expect(capturedUpdates['completedAt']).toBeUndefined();
    expect(capturedUpdates['progress']).toBe(99);
  });
});
