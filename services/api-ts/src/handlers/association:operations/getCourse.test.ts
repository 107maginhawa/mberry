import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotFoundError } from '@/core/errors';
import { getCourse } from './getCourse';
import { CourseRepository } from './repos/training.repo';

describe('getCourse', () => {
  afterEach(() => restoreRepo(CourseRepository));

  test('returns 401 when unauthorized', async () => {
    const ctx = makeCtx({ user: null, _params: { courseId: 'course-1' } });
    const response = await getCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('throws NotFoundError when course missing', async () => {
    stubRepo(CourseRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { courseId: 'missing' } });
    await expect(getCourse(ctx)).rejects.toThrow(NotFoundError);
  });

  test('returns 200 with course on happy path', async () => {
    const course = { id: 'course-1', title: 'Intro to CPD' };
    stubRepo(CourseRepository, { findOneById: async () => course });
    const ctx = makeCtx({ _params: { courseId: 'course-1' } });
    const response = await getCourse(ctx);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(course);
  });
});
