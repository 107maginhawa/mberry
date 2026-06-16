import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteCourse } from './deleteCourse';
import { CourseRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('deleteCourse — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' } });
    const response = await deleteCourse(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteCourse — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseRepository);
  });

  test('returns success on delete', async () => {
    const existing = { id: 'c-1', title: 'Course 1', organizationId: 'org-1' };
    mocks = stubRepo(CourseRepository, {
      findOneById: async () => existing,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { courseId: 'c-1' } });
    const response = await deleteCourse(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.success).toBe(true);
  });

  test('throws NotFoundError when course not found', async () => {
    mocks = stubRepo(CourseRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { courseId: 'no-such-course' } });
    await expect(deleteCourse(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('calls deleteOneById with correct courseId', async () => {
    const existing = { id: 'c-42', title: 'Course', organizationId: 'org-1' };
    let deletedId = '';
    mocks = stubRepo(CourseRepository, {
      findOneById: async () => existing,
      deleteOneById: async (id: string) => { deletedId = id; return undefined; },
    });

    const ctx = makeCtx({ _params: { courseId: 'c-42' } });
    await deleteCourse(ctx);
    expect(deletedId).toBe('c-42');
  });
});
