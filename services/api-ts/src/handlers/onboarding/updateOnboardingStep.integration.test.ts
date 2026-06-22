/**
 * Real-PG integration suite for updateOnboardingStep (PUT /onboarding/step).
 *
 * Drives the REAL OnboardingStateRepository over an isolated createScratch
 * schema (NOT stubRepo) so the M01-004 ordering BRs and the Set(...).sort
 * dedup land as actual persisted rows in a real jsonb column. The PUT handler
 * does not call the officer check inline (requireOfficerMiddleware owns that on
 * the route), so the ctx only needs a `user` + `database=H.db`.
 *
 * Companion to the stub-only onboarding.test.ts: that proves the branch logic
 * against a fake repo; this proves the SAME BRs as committed rows (current_step
 * advance actually written, steps_completed deduped+sorted in the column,
 * created_by/updated_by threaded). Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateOnboardingStep } from './updateOnboardingStep';
import { OnboardingStateRepository } from './repos/onboarding.repo';
import { BusinessLogicError } from '@/core/errors';

let H: ScratchDb;

const USER_ID = '00000000-0000-4000-8000-00000000a001';

// Unique org per scenario so the shared scratch table stays collision-free.
const ORG_BOOTSTRAP = '00000000-0000-4000-8000-0000000b0001';
const ORG_OOO_BOOT = '00000000-0000-4000-8000-0000000b0002';
const ORG_SKIP = '00000000-0000-4000-8000-0000000b0003';
const ORG_RESAVE = '00000000-0000-4000-8000-0000000b0004';
const ORG_DEDUP = '00000000-0000-4000-8000-0000000b0005';

function putCtx(orgId: string, step: number) {
  return makeCtx({
    user: { id: USER_ID, role: 'user', twoFactorEnabled: true },
    database: H.db,
    logger: null,
    _body: { orgId, step },
  });
}

async function rowFor(orgId: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT current_step, steps_completed, completed_at, created_by, updated_by
       FROM "${H.schema}".onboarding_state WHERE organization_id = $1`,
    [orgId],
  );
  return rows;
}

beforeAll(async () => {
  H = await createScratch(['onboarding_state']);
});
afterAll(async () => {
  await H?.teardown();
});

describe('updateOnboardingStep — M01-004 ordering against real repo+PG', () => {
  test('bootstrap fresh org at step 1 creates row current_step=2 steps=[1] createdBy=updatedBy=user', async () => {
    if (!H.dbReachable) return;

    const ctx = putCtx(ORG_BOOTSTRAP, 1);
    const res = (await updateOnboardingStep(ctx)) as unknown as { body: { saved: boolean; currentStep: number; stepsCompleted: number[] } };

    expect(res.body.saved).toBe(true);
    expect(res.body.currentStep).toBe(2);
    expect(res.body.stepsCompleted).toEqual([1]);

    const rows = await rowFor(ORG_BOOTSTRAP);
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(2);
    expect(rows[0].steps_completed).toEqual([1]);
    expect(rows[0].completed_at).toBeNull();
    // createdBy/updatedBy threaded from user.id (updateOnboardingStep.ts:46-47).
    expect(rows[0].created_by).toBe(USER_ID);
    expect(rows[0].updated_by).toBe(USER_ID);
  });

  test('out-of-order bootstrap step 3 throws M01-004 and persists NO row', async () => {
    if (!H.dbReachable) return;

    const ctx = putCtx(ORG_OOO_BOOT, 3);
    let code: string | undefined;
    try {
      await updateOnboardingStep(ctx);
      throw new Error('expected BusinessLogicError');
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessLogicError);
      code = (e as BusinessLogicError).code;
    }
    expect(code).toBe('M01-004');

    // Guard fires before any insert — count must be 0.
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".onboarding_state WHERE organization_id = $1`,
      [ORG_OOO_BOOT],
    );
    expect(rows[0].n).toBe(0);
  });

  test('skip-ahead (seed currentStep=2, save step 4) throws M01-004 and leaves the row unchanged', async () => {
    if (!H.dbReachable) return;

    const repo = new OnboardingStateRepository(H.db as never);
    await repo.create({
      organizationId: ORG_SKIP,
      currentStep: 2,
      stepsCompleted: [1],
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });

    const ctx = putCtx(ORG_SKIP, 4);
    let code: string | undefined;
    try {
      await updateOnboardingStep(ctx);
      throw new Error('expected BusinessLogicError');
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessLogicError);
      code = (e as BusinessLogicError).code;
    }
    expect(code).toBe('M01-004');

    const rows = await rowFor(ORG_SKIP);
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(2); // unchanged
    expect(rows[0].steps_completed).toEqual([1]); // unchanged
  });

  test('re-save earlier step (seed currentStep=3 steps=[1,2], save step 1) — no advance, no duplicate', async () => {
    if (!H.dbReachable) return;

    const repo = new OnboardingStateRepository(H.db as never);
    await repo.create({
      organizationId: ORG_RESAVE,
      currentStep: 3,
      stepsCompleted: [1, 2],
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });

    const ctx = putCtx(ORG_RESAVE, 1);
    const res = (await updateOnboardingStep(ctx)) as unknown as { body: { currentStep: number; stepsCompleted: number[] } };

    // step !== currentStep → no advance.
    expect(res.body.currentStep).toBe(3);
    expect(res.body.stepsCompleted).toEqual([1, 2]);

    const rows = await rowFor(ORG_RESAVE);
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(3);
    // 1 already present → deduped, no [1,1,...] in the persisted jsonb.
    expect(rows[0].steps_completed).toEqual([1, 2]);
  });

  test('sort+dedup (seed currentStep=3 steps=[3,1] out of order, save step 3) → persisted [1,3] sorted', async () => {
    if (!H.dbReachable) return;

    const repo = new OnboardingStateRepository(H.db as never);
    await repo.create({
      organizationId: ORG_DEDUP,
      currentStep: 3,
      stepsCompleted: [3, 1],
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });

    const ctx = putCtx(ORG_DEDUP, 3);
    const res = (await updateOnboardingStep(ctx)) as unknown as { body: { currentStep: number; stepsCompleted: number[] } };

    // step === currentStep && step < TOTAL_STEPS → advance to 4.
    expect(res.body.currentStep).toBe(4);
    expect(res.body.stepsCompleted).toEqual([1, 3]);

    const rows = await rowFor(ORG_DEDUP);
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(4);
    // Array.from(new Set([3,1,3])).sort → [1,3] clean sorted+deduped in the real column.
    expect(rows[0].steps_completed).toEqual([1, 3]);
  });
});
