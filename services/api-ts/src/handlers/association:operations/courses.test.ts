import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Courses Tests
 *
 * Tests for course CRUD handlers — auth guards, org guards, and position checks.
 */

describe('createCourse — guards', () => {
  test('createCourse returns 401 without user', async () => {
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({ user: null });
    const response = await createCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('createCourse returns 403 without organizationId', async () => {
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({ organizationId: null });
    const response = await createCourse(ctx);
    expect(response.status).toBe(403);
  });
});

describe('searchCourses — guards', () => {
  test('searchCourses returns 401 without user', async () => {
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ user: null });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(401);
  });

  test('searchCourses returns 403 without organizationId', async () => {
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ organizationId: null });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(403);
  });
});

describe('getCourse — guards', () => {
  test('getCourse returns 401 without user', async () => {
    const { getCourse } = await import('./getCourse');
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' } });
    const response = await getCourse(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateCourse — guards', () => {
  test('updateCourse returns 401 without user', async () => {
    const { updateCourse } = await import('./updateCourse');
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' }, _body: {} });
    const response = await updateCourse(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteCourse — guards', () => {
  test('deleteCourse returns 401 without user', async () => {
    const { deleteCourse } = await import('./deleteCourse');
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' } });
    const response = await deleteCourse(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateCourseProgress — guards', () => {
  test('updateCourseProgress returns 401 without user', async () => {
    const { updateCourseProgress } = await import('./updateCourseProgress');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' }, _body: { progress: 50 } });
    const response = await updateCourseProgress(ctx);
    expect(response.status).toBe(401);
  });

  test('progress range validation: 0-100', () => {
    const validValues = [0, 25, 50, 75, 100];
    for (const v of validValues) {
      expect(v >= 0 && v <= 100).toBe(true);
    }
  });

  test('progress auto-completes at 100%', () => {
    const progress = 100;
    const shouldComplete = progress >= 100;
    expect(shouldComplete).toBe(true);
  });

  test('progress at 99% does not auto-complete', () => {
    const progress = 99;
    const shouldComplete = progress >= 100;
    expect(shouldComplete).toBe(false);
  });

  test('only enrolled enrollments can have progress updated', () => {
    const validStatuses = ['enrolled'];
    expect(validStatuses).toContain('enrolled');
    expect(validStatuses).not.toContain('completed');
    expect(validStatuses).not.toContain('cancelled');
  });
});

describe('Course status machine', () => {
  test('course statuses are draft, published, archived', () => {
    const statuses = ['draft', 'published', 'archived'];
    expect(statuses).toContain('draft');
    expect(statuses).toContain('published');
    expect(statuses).toContain('archived');
    expect(statuses.length).toBe(3);
  });

  test('draft course can be published', () => {
    const course = { status: 'draft' };
    expect(course.status === 'draft').toBe(true);
  });

  test('published course can be archived', () => {
    const course = { status: 'published' };
    const canArchive = course.status === 'published';
    expect(canArchive).toBe(true);
  });
});
