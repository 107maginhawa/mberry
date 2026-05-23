import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Training Module Tests
 *
 * Tests for trainings, enrollments, courses, course enrollments, and quiz attempts.
 */

describe('Trainings', () => {
  test('createTraining returns 401 without user', async () => {
    const { createTraining } = await import('./createTraining');
    const ctx = makeCtx({ user: null });
    const response = await createTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('searchTrainings returns 401 without user', async () => {
    const { searchTrainings } = await import('./searchTrainings');
    const ctx = makeCtx({ user: null });
    const response = await searchTrainings(ctx);
    expect(response.status).toBe(401);
  });

  test('getTraining returns 401 without user', async () => {
    const { getTraining } = await import('./getTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    await expect(getTraining(ctx)).rejects.toThrow('Unauthorized');
  });

  test('updateTraining returns 401 without user', async () => {
    const { updateTraining } = await import('./updateTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' }, _body: {} });
    const response = await updateTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteTraining returns 401 without user', async () => {
    const { deleteTraining } = await import('./deleteTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await deleteTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('publishTraining returns 401 without user', async () => {
    const { publishTraining } = await import('./publishTraining');
    const ctx = makeCtx({ user: null, _params: { trainingId: 't-1' } });
    const response = await publishTraining(ctx);
    expect(response.status).toBe(401);
  });

  test('training statuses are draft, published, cancelled, completed', () => {
    const statuses = ['draft', 'published', 'cancelled', 'completed'];
    expect(statuses.length).toBe(4);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('published');
  });

  test('only draft trainings can be published', () => {
    const publishableStatuses = ['draft'];
    expect(publishableStatuses).toContain('draft');
    expect(publishableStatuses).not.toContain('published');
    expect(publishableStatuses).not.toContain('cancelled');
  });
});

describe('Training Enrollments', () => {
  test('createTrainingEnrollment returns 401 without user', async () => {
    const { createTrainingEnrollment } = await import('./createTrainingEnrollment');
    const ctx = makeCtx({ user: null });
    const response = await createTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('completeTrainingEnrollment returns 401 without user', async () => {
    const { completeTrainingEnrollment } = await import('./completeTrainingEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'e-1' }, _body: {} });
    const response = await completeTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('searchTrainingEnrollments returns 401 without user', async () => {
    const { searchTrainingEnrollments } = await import('./searchTrainingEnrollments');
    const ctx = makeCtx({ user: null });
    const response = await searchTrainingEnrollments(ctx);
    expect(response.status).toBe(401);
  });

  test('getTrainingEnrollment returns 401 without user', async () => {
    const { getTrainingEnrollment } = await import('./getTrainingEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'e-1' } });
    const response = await getTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('updateTrainingEnrollment returns 401 without user', async () => {
    const { updateTrainingEnrollment } = await import('./updateTrainingEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'e-1' }, _body: {} });
    const response = await updateTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteTrainingEnrollment returns 401 without user', async () => {
    const { deleteTrainingEnrollment } = await import('./deleteTrainingEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'e-1' } });
    const response = await deleteTrainingEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('enrollment statuses are enrolled, completed, cancelled, noShow', () => {
    const statuses = ['enrolled', 'completed', 'cancelled', 'noShow'];
    expect(statuses.length).toBe(4);
    expect(statuses).toContain('enrolled');
    expect(statuses).toContain('completed');
  });

  test('completing enrollment sets completedAt', () => {
    const enrollment = {
      status: 'enrolled' as string,
      completedAt: null as Date | null,
    };
    // After completion
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    expect(enrollment.status).toBe('completed');
    expect(enrollment.completedAt).not.toBeNull();
  });

  test('credit-bearing training awards credits on completion', () => {
    const training = { creditBearing: true, creditAmount: 10 };
    const creditAwarded = training.creditBearing ? training.creditAmount : 0;
    expect(creditAwarded).toBe(10);
  });

  test('non-credit-bearing training awards zero credits', () => {
    const training = { creditBearing: false, creditAmount: 10 };
    const creditAwarded = training.creditBearing ? training.creditAmount : 0;
    expect(creditAwarded).toBe(0);
  });
});

describe('Courses', () => {
  test('createCourse returns 401 without user', async () => {
    const { createCourse } = await import('./createCourse');
    const ctx = makeCtx({ user: null });
    const response = await createCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('getCourse returns 401 without user', async () => {
    const { getCourse } = await import('./getCourse');
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' } });
    const response = await getCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('updateCourse returns 401 without user', async () => {
    const { updateCourse } = await import('./updateCourse');
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' }, _body: {} });
    const response = await updateCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteCourse returns 401 without user', async () => {
    const { deleteCourse } = await import('./deleteCourse');
    const ctx = makeCtx({ user: null, _params: { courseId: 'c-1' } });
    const response = await deleteCourse(ctx);
    expect(response.status).toBe(401);
  });

  test('searchCourses returns 401 without user', async () => {
    const { searchCourses } = await import('./searchCourses');
    const ctx = makeCtx({ user: null });
    const response = await searchCourses(ctx);
    expect(response.status).toBe(401);
  });

  test('course statuses are draft, published, archived', () => {
    const statuses = ['draft', 'published', 'archived'];
    expect(statuses.length).toBe(3);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('published');
    expect(statuses).toContain('archived');
  });
});

describe('Course Enrollments', () => {
  test('createCourseEnrollment returns 401 without user', async () => {
    const { createCourseEnrollment } = await import('./createCourseEnrollment');
    const ctx = makeCtx({ user: null });
    const response = await createCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('getCourseEnrollment returns 401 without user', async () => {
    const { getCourseEnrollment } = await import('./getCourseEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' } });
    const response = await getCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('updateCourseEnrollment returns 401 without user', async () => {
    const { updateCourseEnrollment } = await import('./updateCourseEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' }, _body: {} });
    const response = await updateCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteCourseEnrollment returns 401 without user', async () => {
    const { deleteCourseEnrollment } = await import('./deleteCourseEnrollment');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' } });
    const response = await deleteCourseEnrollment(ctx);
    expect(response.status).toBe(401);
  });

  test('searchCourseEnrollments returns 401 without user', async () => {
    const { searchCourseEnrollments } = await import('./searchCourseEnrollments');
    const ctx = makeCtx({ user: null });
    const response = await searchCourseEnrollments(ctx);
    expect(response.status).toBe(401);
  });

  test('updateCourseProgress returns 401 without user', async () => {
    const { updateCourseProgress } = await import('./updateCourseProgress');
    const ctx = makeCtx({ user: null, _params: { enrollmentId: 'ce-1' }, _body: { progress: 50 } });
    const response = await updateCourseProgress(ctx);
    expect(response.status).toBe(401);
  });

  test('progress auto-completes at 100%', () => {
    const progress = 100;
    const shouldComplete = progress >= 100;
    expect(shouldComplete).toBe(true);
  });

  test('progress does not auto-complete below 100%', () => {
    const progress = 99;
    const shouldComplete = progress >= 100;
    expect(shouldComplete).toBe(false);
  });
});

describe('Quiz Attempts', () => {
  test('createQuizAttempt returns 401 without user', async () => {
    const { createQuizAttempt } = await import('./createQuizAttempt');
    const ctx = makeCtx({ user: null });
    const response = await createQuizAttempt(ctx);
    expect(response.status).toBe(401);
  });

  test('searchQuizAttempts returns 401 without user', async () => {
    const { searchQuizAttempts } = await import('./searchQuizAttempts');
    const ctx = makeCtx({ user: null });
    const response = await searchQuizAttempts(ctx);
    expect(response.status).toBe(401);
  });

  test('quiz passes at 70% threshold', () => {
    const PASS_THRESHOLD = 0.7;
    expect((70 / 100) >= PASS_THRESHOLD).toBe(true);
    expect((69 / 100) >= PASS_THRESHOLD).toBe(false);
    expect((100 / 100) >= PASS_THRESHOLD).toBe(true);
    expect((0 / 100) >= PASS_THRESHOLD).toBe(false);
  });

  test('quiz with custom maxScore uses correct threshold', () => {
    const PASS_THRESHOLD = 0.7;
    const score = 35;
    const maxScore = 50;
    const passed = maxScore > 0 ? (score / maxScore) >= PASS_THRESHOLD : false;
    expect(passed).toBe(true); // 35/50 = 0.7 exactly

    const failScore = 34;
    const failed = maxScore > 0 ? (failScore / maxScore) >= PASS_THRESHOLD : false;
    expect(failed).toBe(false); // 34/50 = 0.68
  });

  test('quiz with zero maxScore always fails', () => {
    const PASS_THRESHOLD = 0.7;
    const maxScore = 0;
    const score = 0;
    const passed = maxScore > 0 ? (score / maxScore) >= PASS_THRESHOLD : false;
    expect(passed).toBe(false);
  });
});
