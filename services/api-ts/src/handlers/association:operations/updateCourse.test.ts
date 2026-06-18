import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateCourse } from './updateCourse';
import { CourseRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('updateCourse — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' }, _body: {} });
    const response = await updateCourse(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateCourse — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseRepository);
  });

  test('returns updated course on success', async () => {
    const existing = { id: 'c-1', title: 'Old Title', status: 'draft', organizationId: 'org-1' };
    const updated = { ...existing, title: 'New Title' };
    mocks = stubRepo(CourseRepository, {
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { courseId: 'c-1' },
      _body: { title: 'New Title' },
    });
    const response = await updateCourse(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.title).toBe('New Title');
    expect((response as any).body.id).toBe('c-1');
  });

  test('throws NotFoundError when course not found', async () => {
    mocks = stubRepo(CourseRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { courseId: 'no-such-course' },
      _body: { title: 'Whatever' },
    });
    await expect(updateCourse(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('partial update — only provided fields sent to repo', async () => {
    const existing = { id: 'c-1', title: 'Original', description: 'Desc', organizationId: 'org-1' };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(CourseRepository, {
      findOneById: async () => existing,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...existing, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { courseId: 'c-1' },
      _body: { description: 'Updated Desc' },
    });
    await updateCourse(ctx);
    expect(capturedUpdates['description']).toBe('Updated Desc');
    expect(capturedUpdates['title']).toBeUndefined();
  });

  test('passes correct courseId to repo', async () => {
    const existing = { id: 'c-99', title: 'Course', organizationId: 'org-1' };
    let calledWithId = '';
    mocks = stubRepo(CourseRepository, {
      findOneById: async (id: string) => { calledWithId = id; return existing; },
      updateOneById: async () => existing,
    });

    const ctx = makeCtx({
      _params: { courseId: 'c-99' },
      _body: { title: 'Updated' },
    });
    await updateCourse(ctx);
    expect(calledWithId).toBe('c-99');
  });
});
