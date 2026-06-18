import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateCourseEnrollment } from './updateCourseEnrollment';
import { CourseEnrollmentRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('updateCourseEnrollment — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' }, _body: {} });
    const response = await updateCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateCourseEnrollment — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseEnrollmentRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseEnrollmentRepository);
  });

  test('returns updated enrollment on success', async () => {
    const existing = { id: 'ce-1', courseId: 'c-1', personId: 'p-1', status: 'enrolled' };
    const updated = { ...existing, status: 'completed' };
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'ce-1' },
      _body: { status: 'completed' },
    });
    const response = await updateCourseEnrollment(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.status).toBe('completed');
    expect((response as any).body.id).toBe('ce-1');
  });

  test('throws NotFoundError when enrollment not found', async () => {
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'no-such-enrollment' },
      _body: { status: 'completed' },
    });
    await expect(updateCourseEnrollment(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('partial update — only provided fields forwarded to repo', async () => {
    const existing = { id: 'ce-1', courseId: 'c-1', personId: 'p-1', status: 'enrolled', grade: null };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async () => existing,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...existing, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'ce-1' },
      _body: { grade: 'A' },
    });
    await updateCourseEnrollment(ctx);
    expect(capturedUpdates['grade']).toBe('A');
    expect(capturedUpdates['status']).toBeUndefined();
  });

  test('calls repo with correct enrollmentId', async () => {
    const existing = { id: 'ce-77', courseId: 'c-1', personId: 'p-1', status: 'enrolled' };
    let calledWithId = '';
    mocks = stubRepo(CourseEnrollmentRepository, {
      findOneById: async (id: string) => { calledWithId = id; return existing; },
      updateOneById: async () => existing,
    });

    const ctx = makeCtx({
      _params: { enrollmentId: 'ce-77' },
      _body: { status: 'completed' },
    });
    await updateCourseEnrollment(ctx);
    expect(calledWithId).toBe('ce-77');
  });
});
