/**
 * Workflow test for completeTrainingEnrollment (handler previously UNTESTED for
 * the enrollment-completion route — award was only proven via the check-in route).
 * Drives the REAL handler against a createScratch Postgres + a captured
 * domainEvents listener; asserts real persisted outcomes, not a 200 heading.
 * Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { completeTrainingEnrollment } from './completeTrainingEnrollment';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { NotFoundError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let trainingRepo: TrainingRepository;
let enrollRepo: TrainingEnrollmentRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';

let completedEvents: Record<string, unknown>[] = [];
const capture = async (p: Record<string, unknown>) => { completedEvents.push(p); };

function makeTraining(o: Partial<Record<string, unknown>> = {}) {
  return {
    organizationId: ORG, title: 'BLS', startDate: new Date('2030-05-01T09:00:00Z'),
    endDate: new Date('2030-05-01T17:00:00Z'), creditBearing: true, creditAmount: 2,
    ...o,
  } as never;
}

async function enrollmentRow(id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT status, completed_at FROM "${H.schema}".training_enrollment WHERE id = $1`, [id]);
  return rows[0];
}

function ctxFor(enrollmentId: string) {
  return makeCtx({ user: { id: 'officer-1' }, database: H.db, _params: { enrollmentId }, _body: {} });
}

beforeAll(async () => {
  H = await createScratch(['training_enrollment', 'training', 'credit_entry', 'organization', 'org_cpd_config']);
  if (!H.dbReachable) return;
  trainingRepo = new TrainingRepository(H.db as never);
  enrollRepo = new TrainingEnrollmentRepository(H.db as never);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".org_cpd_config (id, organization_id, cycle_start_month, cycle_length_years) VALUES ($1,$2,1,3)`,
    [crypto.randomUUID(), ORG]);
});
afterAll(async () => { await H?.teardown(); });

async function seedEnrollment(trainingId: string, status = 'enrolled'): Promise<string> {
  const e = await enrollRepo.createOne({ organizationId: ORG, trainingId, personId: crypto.randomUUID(), status } as never);
  return e.id;
}

describe('completeTrainingEnrollment — real handler over real PG', () => {
  test('enrolled → completed + completedAt; credit awarded; training.completed emitted once', async () => {
    if (!H.dbReachable) return;
    completedEvents = [];
    domainEvents.on('training.completed', capture);
    try {
      const t = await trainingRepo.createOne(makeTraining({ creditAmount: 2 }));
      const enrollmentId = await seedEnrollment(t.id);

      const res = await completeTrainingEnrollment(ctxFor(enrollmentId)) as unknown as { status: number; body: { status: string; creditAwarded: number } };
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.creditAwarded).toBe(2);

      const row = await enrollmentRow(enrollmentId);
      expect(row.status).toBe('completed');
      expect(row.completed_at).not.toBeNull();

      const { rows: credits } = await H.scopedPool.query(
        `SELECT count(*)::int AS c FROM "${H.schema}".credit_entry WHERE training_id = $1`, [t.id]);
      expect(credits[0].c).toBe(1);

      await Promise.resolve();
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toMatchObject({ trainingId: t.id, organizationId: ORG, completedBy: 'officer-1' });
    } finally {
      domainEvents.off('training.completed', capture);
    }
  });

  test('non-credit-bearing training → creditAwarded 0, no credit row', async () => {
    if (!H.dbReachable) return;
    const t = await trainingRepo.createOne(makeTraining({ creditBearing: false }));
    const enrollmentId = await seedEnrollment(t.id);
    const res = await completeTrainingEnrollment(ctxFor(enrollmentId)) as unknown as { body: { creditAwarded: number } };
    expect(res.body.creditAwarded).toBe(0);
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".credit_entry WHERE training_id = $1`, [t.id]);
    expect(rows[0].c).toBe(0);
  });

  test('FSM guard: a terminal enrollment cannot be completed (throws) and stays unchanged', async () => {
    if (!H.dbReachable) return;
    const t = await trainingRepo.createOne(makeTraining());
    const enrollmentId = await seedEnrollment(t.id, 'cancelled');
    await expect(completeTrainingEnrollment(ctxFor(enrollmentId))).rejects.toThrow();
    expect((await enrollmentRow(enrollmentId)).status).toBe('cancelled'); // unchanged
  });

  test('[BR-44] completing twice is blocked by the FSM (second call throws)', async () => {
    if (!H.dbReachable) return;
    const t = await trainingRepo.createOne(makeTraining());
    const enrollmentId = await seedEnrollment(t.id);
    await completeTrainingEnrollment(ctxFor(enrollmentId)); // enrolled → completed
    await expect(completeTrainingEnrollment(ctxFor(enrollmentId))).rejects.toThrow(); // completed → completed blocked
  });

  test('enrollment not found → NotFoundError', async () => {
    if (!H.dbReachable) return;
    await expect(completeTrainingEnrollment(ctxFor(crypto.randomUUID()))).rejects.toBeInstanceOf(NotFoundError);
  });
});
