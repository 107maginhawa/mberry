/**
 * Real-PG integration suite for getOnboardingState (GET /onboarding/state).
 *
 * The GET route (generated/openapi/routes.ts:3395-3399) has ONLY
 * authMiddleware({roles:['user']}) + query validator — there is NO
 * requireOfficerMiddleware. The inline officer check at
 * getOnboardingState.ts:30-34 is therefore the SOLE authorization gate.
 * A regression that dropped that inline check would silently expose an org's
 * onboarding progress, so this drives the handler end-to-end over a real
 * persisted state row (createScratch) while stubbing only
 * OfficerTermRepository.findActiveByPersonAndOrg to flip officer/non-officer.
 *
 * FKs are dropped by LIKE … INCLUDING ALL, so no organization parent row is
 * needed. Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { OnboardingStateRepository } from './repos/onboarding.repo';
import { getOnboardingState } from './getOnboardingState';
import { ForbiddenError, NotFoundError } from '@/core/errors';

let H: ScratchDb;

const ORG_A = '00000000-0000-4000-8000-00000000a501';
const ORG_B = '00000000-0000-4000-8000-00000000b502';
const USER_ID = '00000000-0000-4000-8000-00000000c503';

function asOfficer(org: string) {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 't1', organizationId: org }],
  });
}

function asNonOfficer() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [],
  });
}

let mocks: Array<ReturnType<typeof stubRepo>> = [];

beforeAll(async () => {
  H = await createScratch(['onboarding_state']);
});
afterAll(async () => {
  await H?.teardown();
});
afterEach(() => {
  mocks.forEach((m) => Object.values(m).forEach((x) => x.mockRestore()));
  mocks = [];
});

describe('getOnboardingState — real-PG + inline officer gate (GET route has NO officer middleware)', () => {
  test('officer + seeded state → response body matches the persisted row read-back', async () => {
    if (!H.dbReachable) return;
    const repo = new OnboardingStateRepository(H.db as never);
    const completedAt = new Date('2030-03-04T05:06:07.000Z');
    await repo.create({
      organizationId: ORG_A,
      currentStep: 3,
      stepsCompleted: [1, 2],
      completedAt,
    } as never);

    mocks.push(asOfficer(ORG_A));
    const ctx = makeCtx({ database: H.db, _query: { orgId: ORG_A } });
    const res = (await getOnboardingState(ctx)) as unknown as { body: any };

    // Read the persisted row back and assert the handler echoes it faithfully.
    const { rows } = await H.scopedPool.query(
      `SELECT current_step, steps_completed, completed_at FROM "${H.schema}".onboarding_state WHERE organization_id=$1`,
      [ORG_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(3);
    expect(rows[0].steps_completed).toEqual([1, 2]);

    expect(res.body.organizationId).toBe(ORG_A);
    expect(res.body.currentStep).toBe(rows[0].current_step);
    expect(res.body.stepsCompleted).toEqual(rows[0].steps_completed);
    expect(res.body.completedAt).toBe(completedAt.toISOString());
  });

  test('officer + NO state row → NotFoundError(OnboardingState)', async () => {
    if (!H.dbReachable) return;
    // ORG_B has no row; confirm absence first.
    const { rows } = await H.scopedPool.query(
      `SELECT 1 FROM "${H.schema}".onboarding_state WHERE organization_id=$1`,
      [ORG_B],
    );
    expect(rows).toHaveLength(0);

    mocks.push(asOfficer(ORG_B));
    const ctx = makeCtx({ database: H.db, _query: { orgId: ORG_B } });
    await expect(getOnboardingState(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('non-officer → ForbiddenError even when a state row EXISTS (gate not bypassable by a populated row)', async () => {
    if (!H.dbReachable) return;
    // ORG_A already has a persisted state row from the first test; the inline
    // officer check precedes the repo read (lines 31-37), so a populated row
    // must NOT let a non-officer through.
    const { rows } = await H.scopedPool.query(
      `SELECT 1 FROM "${H.schema}".onboarding_state WHERE organization_id=$1`,
      [ORG_A],
    );
    expect(rows).toHaveLength(1);

    mocks.push(asNonOfficer());
    const ctx = makeCtx({
      database: H.db,
      user: { id: USER_ID, role: 'user', twoFactorEnabled: true },
      _query: { orgId: ORG_A },
    });
    await expect(getOnboardingState(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('unauthenticated (user:null) → 401', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx({ database: H.db, user: null, session: null, _query: { orgId: ORG_A } });
    await expect(getOnboardingState(ctx)).rejects.toMatchObject({ statusCode: 401 });
  });
});
