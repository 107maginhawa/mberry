/**
 * Real-PG integration suite for the training repos, replacing the fake-db
 * illusion (training.repo.test.ts) and the static tree checks
 * (training.repo.type-filter.test.ts, training-enroll-index.schema.test.ts).
 *
 * Proves the type filter, publish lifecycle, the uq_training_enroll_active
 * partial-unique race fix THROUGH the repo insert path, and course/quiz scoping.
 * Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  TrainingRepository,
  TrainingEnrollmentRepository,
  CourseRepository,
  CourseEnrollmentRepository,
  QuizAttemptRepository,
} from './training.repo';
import { NotFoundError } from '@/core/errors';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let trainings: TrainingRepository;
let enrolls: TrainingEnrollmentRepository;
let courses: CourseRepository;
let courseEnrolls: CourseEnrollmentRepository;
let quizzes: QuizAttemptRepository;

const ORG = '00000000-0000-4000-8000-0000000000a1';

function trainingData(o: Partial<Record<string, unknown>> = {}) {
  return {
    organizationId: ORG, title: 'Course',
    startDate: new Date('2030-05-01T09:00:00Z'), endDate: new Date('2030-05-01T17:00:00Z'),
    ...o,
  } as never;
}
const pgCode = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;

beforeAll(async () => {
  H = await createScratch(['training', 'training_enrollment', 'course', 'course_enrollment', 'quiz_attempt']);
  if (!H.dbReachable) return;
  trainings = new TrainingRepository(H.db as never);
  enrolls = new TrainingEnrollmentRepository(H.db as never);
  courses = new CourseRepository(H.db as never);
  courseEnrolls = new CourseEnrollmentRepository(H.db as never);
  quizzes = new QuizAttemptRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('TrainingRepository — real-PG filters + publish', () => {
  test('findMany filters by organizationId / status / type (FIX-007) against real WHERE', async () => {
    if (!H.dbReachable) return;
    await trainings.createOne(trainingData({ type: 'seminar', status: 'published' }));
    await trainings.createOne(trainingData({ type: 'workshop', status: 'published' }));
    await trainings.createOne(trainingData({ type: 'seminar', status: 'draft' }));

    expect((await trainings.findMany({ type: 'seminar' } as never)).every((t) => t.type === 'seminar')).toBe(true);
    expect((await trainings.findMany({ type: 'seminar' } as never)).length).toBe(2);
    expect((await trainings.findMany({ organizationId: ORG, status: 'published' } as never)).length).toBe(2);
    expect((await trainings.findMany({ type: 'workshop' } as never)).length).toBe(1);
  });

  test('publish sets published + publishedAt; NotFoundError on a missing id', async () => {
    if (!H.dbReachable) return;
    const t = await trainings.createOne(trainingData({ status: 'draft' }));
    const pub = await trainings.publish(t.id);
    expect(pub.status).toBe('published');
    expect(pub.publishedAt).not.toBeNull();
    await expect(trainings.publish(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('TrainingEnrollmentRepository — uq_training_enroll_active through the repo insert path', () => {
  test('a second active enrollment for (training,person) raises 23505; a cancelled prior allows re-enroll', async () => {
    if (!H.dbReachable) return;
    const t = await trainings.createOne(trainingData());
    const person = crypto.randomUUID();
    await enrolls.createOne({ organizationId: ORG, trainingId: t.id, personId: person, status: 'enrolled' } as never);

    let code: string | undefined;
    try {
      await enrolls.createOne({ organizationId: ORG, trainingId: t.id, personId: person, status: 'enrolled' } as never);
    } catch (e) { code = pgCode(e); }
    expect(code).toBe('23505');

    // Re-enroll allowed once the prior row is cancelled (predicate excludes 'cancelled').
    const t2 = await trainings.createOne(trainingData());
    const p2 = crypto.randomUUID();
    await enrolls.createOne({ organizationId: ORG, trainingId: t2.id, personId: p2, status: 'cancelled' } as never);
    const ok = await enrolls.createOne({ organizationId: ORG, trainingId: t2.id, personId: p2, status: 'enrolled' } as never);
    expect(ok.status).toBe('enrolled');
  });

  test('findMany scopes by trainingId / personId / status', async () => {
    if (!H.dbReachable) return;
    const t = await trainings.createOne(trainingData());
    const person = crypto.randomUUID();
    await enrolls.createOne({ organizationId: ORG, trainingId: t.id, personId: person, status: 'enrolled' } as never);
    expect((await enrolls.findMany({ trainingId: t.id } as never)).length).toBe(1);
    expect((await enrolls.findMany({ personId: person } as never)).every((e) => e.personId === person)).toBe(true);
    expect((await enrolls.findMany({ trainingId: t.id, status: 'completed' } as never)).length).toBe(0);
  });
});

describe('Course / CourseEnrollment / QuizAttempt — real-PG scoping', () => {
  test('each repo scopes by its keys against real rows', async () => {
    if (!H.dbReachable) return;
    const c = await courses.createOne({ organizationId: ORG, title: 'Anatomy' } as never);
    expect((await courses.findMany({ organizationId: ORG } as never)).some((x) => x.id === c.id)).toBe(true);

    const person = crypto.randomUUID();
    await courseEnrolls.createOne({ organizationId: ORG, courseId: c.id, personId: person, status: 'enrolled' } as never);
    expect((await courseEnrolls.findMany({ courseId: c.id } as never)).length).toBe(1);
    expect((await courseEnrolls.findMany({ personId: person } as never)).every((e) => e.personId === person)).toBe(true);

    await quizzes.createOne({ organizationId: ORG, courseId: c.id, personId: person } as never);
    expect((await quizzes.findMany({ courseId: c.id } as never)).length).toBe(1);
    expect((await quizzes.findMany({ personId: person } as never)).length).toBe(1);
  });
});
