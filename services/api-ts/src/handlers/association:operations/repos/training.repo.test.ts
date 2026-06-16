/**
 * Unit suite for the training repositories (fake-DB harness, ./__fake-db).
 *
 * Covers every buildWhereConditions branch across TrainingRepository,
 * TrainingEnrollmentRepository, CourseRepository, CourseEnrollmentRepository,
 * and QuizAttemptRepository (driven via inherited findMany/findOne/count),
 * plus TrainingRepository.publish success + NotFound paths.
 *
 * Note: training.repo.type-filter.test.ts already covers the FIX-007 `type`
 * filter against a real engine; this suite adds the remaining branch + override
 * coverage at the unit level.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  TrainingRepository,
  TrainingEnrollmentRepository,
  CourseRepository,
  CourseEnrollmentRepository,
  QuizAttemptRepository,
} from './training.repo';
import {
  trainings,
  trainingEnrollments,
  courses,
  courseEnrollments,
  quizAttempts,
} from './training.schema';
import { NotFoundError } from '@/core/errors';
import { makeFakeDb, type FakeDb } from './__fake-db';

let fake: FakeDb;

beforeEach(() => {
  fake = makeFakeDb();
});

describe('TrainingRepository', () => {
  let repo: TrainingRepository;
  beforeEach(() => {
    repo = new TrainingRepository(fake.db);
  });

  test('findMany exercises id + org + status + type filter branches', async () => {
    fake.seed(trainings, [
      { id: 't1', organizationId: 'org-1', status: 'published', type: 'online' },
    ]);
    const out = await repo.findMany({
      id: 't1',
      organizationId: 'org-1',
      status: 'published',
      type: 'online',
    });
    expect(out).toHaveLength(1);
  });

  test('findOne with no filters skips where', async () => {
    fake.seed(trainings, [{ id: 't1' }]);
    expect((await repo.findOne({}))?.id).toBe('t1');
  });

  test('count with org filter', async () => {
    fake.seed(trainings, [{ id: 't1', organizationId: 'org-1' }]);
    expect(await repo.count({ organizationId: 'org-1' })).toBe(1);
  });

  test('publish sets published + publishedAt', async () => {
    fake.seed(trainings, [{ id: 't1', status: 'draft' }]);
    const out = await repo.publish('t1');
    expect(out.status).toBe('published');
    expect(out.publishedAt).toBeInstanceOf(Date);
  });

  test('publish throws NotFoundError when missing', async () => {
    fake.seed(trainings, []);
    await expect(repo.publish('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('TrainingEnrollmentRepository.buildWhereConditions branches', () => {
  test('training + person + status filters', async () => {
    const repo = new TrainingEnrollmentRepository(fake.db);
    fake.seed(trainingEnrollments, [
      { id: 'en1', trainingId: 't1', personId: 'p1', status: 'enrolled' },
    ]);
    expect(
      await repo.findMany({ trainingId: 't1', personId: 'p1', status: 'enrolled' }),
    ).toHaveLength(1);
  });
});

describe('CourseRepository.buildWhereConditions branches', () => {
  test('org + status filters', async () => {
    const repo = new CourseRepository(fake.db);
    fake.seed(courses, [{ id: 'co1', organizationId: 'org-1', status: 'published' }]);
    expect(await repo.findMany({ organizationId: 'org-1', status: 'published' })).toHaveLength(1);
  });
});

describe('CourseEnrollmentRepository.buildWhereConditions branches', () => {
  test('course + person + status filters', async () => {
    const repo = new CourseEnrollmentRepository(fake.db);
    fake.seed(courseEnrollments, [
      { id: 'ce1', courseId: 'co1', personId: 'p1', status: 'active' },
    ]);
    expect(
      await repo.findMany({ courseId: 'co1', personId: 'p1', status: 'active' }),
    ).toHaveLength(1);
  });
});

describe('QuizAttemptRepository.buildWhereConditions branches', () => {
  test('course + person filters', async () => {
    const repo = new QuizAttemptRepository(fake.db);
    fake.seed(quizAttempts, [{ id: 'qa1', courseId: 'co1', personId: 'p1' }]);
    expect(await repo.findMany({ courseId: 'co1', personId: 'p1' })).toHaveLength(1);
  });
});
