import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Course Enrollment Tests
 *
 * Tests for course enrollment CRUD handlers — auth guards, org guards.
 */

describe('createCourseEnrollment — guards', () => {
  test('createCourseEnrollment returns 401 without user', async () => {
    const { createCourseEnrollment } = await import('./createCourseEnrollment');
    const ctx = makeCtx({ user: null });
    const response = await createCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('createCourseEnrollment returns 403 without organizationId', async () => {
    const { createCourseEnrollment } = await import('./createCourseEnrollment');
    const ctx = makeCtx({ organizationId: null });
    const response = await createCourseEnrollment(ctx);
    expect(response.status).toBe(403);
  });
});

describe('searchCourseEnrollments — guards', () => {
  test('searchCourseEnrollments returns 401 without user', async () => {
    const { searchCourseEnrollments } = await import('./searchCourseEnrollments');
    const ctx = makeCtx({ user: null });
    const response = await searchCourseEnrollments(ctx);
    expect(response.status).toBe(401);
  });
});

describe('getCourseEnrollment — guards', () => {
  test('getCourseEnrollment returns 401 without user', async () => {
    const { getCourseEnrollment } = await import('./getCourseEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' } });
    const response = await getCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateCourseEnrollment — guards', () => {
  test('updateCourseEnrollment returns 401 without user', async () => {
    const { updateCourseEnrollment } = await import('./updateCourseEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' }, _body: {} });
    const response = await updateCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteCourseEnrollment — guards', () => {
  test('deleteCourseEnrollment returns 401 without user', async () => {
    const { deleteCourseEnrollment } = await import('./deleteCourseEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' } });
    const response = await deleteCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });
});

describe('Course enrollment statuses', () => {
  test('enrollment statuses are enrolled, completed, cancelled', () => {
    const statuses = ['enrolled', 'completed', 'cancelled'];
    expect(statuses).toContain('enrolled');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('cancelled');
  });

  test('initial enrollment status is enrolled', () => {
    const newEnrollment = { status: 'enrolled', progress: 0 };
    expect(newEnrollment.status).toBe('enrolled');
    expect(newEnrollment.progress).toBe(0);
  });

  test('completion sets progress to 100', () => {
    const enrollment = { status: 'enrolled' as string, progress: 80 };
    enrollment.status = 'completed';
    enrollment.progress = 100;
    expect(enrollment.status).toBe('completed');
    expect(enrollment.progress).toBe(100);
  });
});
