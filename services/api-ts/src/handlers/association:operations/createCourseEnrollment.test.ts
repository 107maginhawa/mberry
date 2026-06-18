import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createCourseEnrollment } from './createCourseEnrollment';
import { CourseRepository, CourseEnrollmentRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';

describe('createCourseEnrollment — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: { courseId: 'c-1' } });
    const response = await createCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { courseId: 'c-1' } });
    const response = await createCourseEnrollment(ctx);
    expect(response.status).toBe(403);
  });
});

describe('createCourseEnrollment — business logic', () => {
  let courseMocks: ReturnType<typeof stubRepo>;
  let enrollMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(CourseRepository);
    restoreRepo(CourseEnrollmentRepository);
  });

  afterEach(() => {
    if (courseMocks) Object.values(courseMocks).forEach((m) => m.mockRestore());
    if (enrollMocks) Object.values(enrollMocks).forEach((m) => m.mockRestore());
    restoreRepo(CourseRepository);
    restoreRepo(CourseEnrollmentRepository);
  });

  test('creates enrollment with enrolled status and 0 progress', async () => {
    const course = { id: 'course-1', title: 'CPR Basics' };
    let capturedData: any = null;
    courseMocks = stubRepo(CourseRepository, {
      findOneById: async () => course,
    });
    enrollMocks = stubRepo(CourseEnrollmentRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'enr-1', ...data };
      },
    });

    const ctx = makeCtx({
      _body: { courseId: 'course-1' },
    });
    const response = await createCourseEnrollment(ctx);
    expect(response.status).toBe(201);
    expect(capturedData.status).toBe('enrolled');
    expect(capturedData.progress).toBe(0);
    expect(capturedData.courseId).toBe('course-1');
  });

  test('defaults personId to authenticated user', async () => {
    const course = { id: 'course-1' };
    let capturedData: any = null;
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    enrollMocks = stubRepo(CourseEnrollmentRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'enr-1', ...data };
      },
    });

    const ctx = makeCtx({
      user: { id: 'user-42', role: 'user', twoFactorEnabled: true },
      _body: { courseId: 'course-1' },
    });
    await createCourseEnrollment(ctx);
    expect(capturedData.personId).toBe('user-42');
  });

  test('uses explicit personId when provided in body', async () => {
    const course = { id: 'course-1' };
    let capturedData: any = null;
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    enrollMocks = stubRepo(CourseEnrollmentRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'enr-1', ...data };
      },
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _body: { courseId: 'course-1', personId: 'member-99' },
    });
    await createCourseEnrollment(ctx);
    expect(capturedData.personId).toBe('member-99');
  });

  test('enrollment gets correct organizationId from context', async () => {
    const course = { id: 'course-1' };
    let capturedData: any = null;
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    enrollMocks = stubRepo(CourseEnrollmentRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'enr-1', ...data };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-abc',
      _body: { courseId: 'course-1' },
    });
    await createCourseEnrollment(ctx);
    expect(capturedData.organizationId).toBe('org-abc');
  });

  test('throws NotFoundError when course does not exist', async () => {
    courseMocks = stubRepo(CourseRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _body: { courseId: 'nonexistent-course' } });
    await expect(createCourseEnrollment(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returned body has enrollment id and data', async () => {
    const course = { id: 'course-1' };
    courseMocks = stubRepo(CourseRepository, { findOneById: async () => course });
    enrollMocks = stubRepo(CourseEnrollmentRepository, {
      createOne: async (data: any) => ({ id: 'enr-xyz', ...data }),
    });

    const ctx = makeCtx({ _body: { courseId: 'course-1' } });
    const response = await createCourseEnrollment(ctx);
    expect((response as any).body.id).toBe('enr-xyz');
    expect((response as any).body.courseId).toBe('course-1');
  });
});
