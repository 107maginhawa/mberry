import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteCourseEnrollment } from './deleteCourseEnrollment';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('deleteCourseEnrollment — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' } });
    const response = await deleteCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteCourseEnrollment — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseEnrollmentRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseEnrollmentRepository);
  });

  test('returns success on delete', async () => {
    const existing = { id: 'ce-1', courseId: 'c-1', personId: 'p-1', status: 'enrolled' };
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => existing,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { enrollmentId: 'ce-1' } });
    const response = await deleteCourseEnrollment(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.success).toBe(true);
  });

  test('throws NotFoundError when enrollment not found', async () => {
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { enrollmentId: 'no-such-enrollment' } });
    await expect(deleteCourseEnrollment(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('calls deleteOneById with correct enrollmentId', async () => {
    const existing = { id: 'ce-77', courseId: 'c-1', personId: 'p-1', status: 'enrolled' };
    let deletedId = '';
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => existing,
      deleteOneById: async (id: string) => { deletedId = id; return undefined; },
    });

    const ctx = makeCtx({ _params: { enrollmentId: 'ce-77' } });
    await deleteCourseEnrollment(ctx);
    expect(deletedId).toBe('ce-77');
  });
});
