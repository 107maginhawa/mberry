import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotFoundError } from '@/core/errors';
import { getCourseEnrollment } from './getCourseEnrollment';
import { CourseEnrollmentRepository } from './repos/training.repo';

describe('getCourseEnrollment', () => {
  afterEach(() => restoreRepo(CourseEnrollmentRepository));

  test('returns 401 when unauthorized', async () => {
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'enr-1' } });
    const response = await getCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('throws NotFoundError when enrollment missing', async () => {
    stubRepo(CourseEnrollmentRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { enrollmentId: 'missing' } });
    await expect(getCourseEnrollment(ctx)).rejects.toThrow(NotFoundError);
  });

  test('returns 200 with enrollment on happy path', async () => {
    const enrollment = { id: 'enr-1', courseId: 'course-1', personId: 'person-1' };
    stubRepo(CourseEnrollmentRepository, { findOneById: async () => enrollment });
    const ctx = makeCtx({ _params: { enrollmentId: 'enr-1' } });
    const response = await getCourseEnrollment(ctx);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(enrollment);
  });
});
