/**
 * Real-Postgres integration coverage for OnboardingStateRepository
 * (src/handlers/onboarding/repos/onboarding.repo.ts).
 *
 * W3 onboarding S1: migrated off the hand-rolled `new Pool` + shared-`public`
 * seeding + `if (process.env['CI']) return` gate onto the isolated `createScratch`
 * harness. `CREATE TABLE <scratch>.onboarding_state (LIKE public.onboarding_state
 * INCLUDING ALL)` copies the live NOT NULL / UNIQUE / jsonb DEFAULT exactly, and
 * LIKE drops the FK to organization(id) — so NO parent org row is needed (the old
 * org-seed dance disappears) and the suite now runs in CI (gated only on
 * `dbReachable`). Asserts are real persisted rows read back via `H.scopedPool`.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { OnboardingStateRepository } from './onboarding.repo';
import { onboardingStates } from './onboarding.schema';

const MISSING_ORG_ID = crypto.randomUUID();

let H: ScratchDb;
let repo: OnboardingStateRepository;

beforeAll(async () => {
  H = await createScratch(['onboarding_state']);
  if (H.dbReachable) {
    repo = new OnboardingStateRepository(H.db as never);
  }
});

afterAll(async () => {
  await H?.teardown();
});

describe('OnboardingStateRepository (real-PG, scratch schema)', () => {
  test('findByOrg miss returns undefined before any create', async () => {
    if (!H.dbReachable) return;
    expect(await repo.findByOrg(MISSING_ORG_ID)).toBeUndefined();
  });

  test('create persists explicit fields; read-back confirms columns', async () => {
    if (!H.dbReachable) return;
    const orgId = crypto.randomUUID();
    const createdBy = crypto.randomUUID();
    const updatedBy = crypto.randomUUID();

    const created = await repo.create({
      organizationId: orgId,
      currentStep: 1,
      stepsCompleted: [1],
      createdBy,
      updatedBy,
    });
    expect(created.organizationId).toBe(orgId);
    expect(created.currentStep).toBe(1);

    const hit = await repo.findByOrg(orgId);
    expect(hit?.id).toBe(created.id);

    // Read back the raw persisted row — not the repo's return value.
    const { rows } = await H.scopedPool.query(
      `SELECT current_step, steps_completed, version, created_by, updated_by, completed_at
         FROM "${H.schema}".onboarding_state WHERE organization_id = $1`,
      [orgId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(1);
    expect(rows[0].steps_completed).toEqual([1]);
    expect(rows[0].version).toBe(1);
    expect(rows[0].created_by).toBe(createdBy);
    expect(rows[0].updated_by).toBe(updatedBy);
    expect(rows[0].completed_at).toBeNull();
  });

  test('create with no step/jsonb fields fires live DB defaults (current_step=1, steps_completed=[])', async () => {
    if (!H.dbReachable) return;
    const orgId = crypto.randomUUID();

    // Intentionally omit currentStep + stepsCompleted so the live column DEFAULTs
    // (DEFAULT 1, DEFAULT '[]'::jsonb) must fire — the old test always passed them.
    const created = await repo.create({ organizationId: orgId } as never);
    expect(created.organizationId).toBe(orgId);

    const { rows } = await H.scopedPool.query(
      `SELECT current_step, steps_completed, version
         FROM "${H.schema}".onboarding_state WHERE organization_id = $1`,
      [orgId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].current_step).toBe(1);
    expect(rows[0].steps_completed).toEqual([]);
    expect(rows[0].version).toBe(1);
  });

  test('update applies fields, bumps updated_at, persists jsonb array', async () => {
    if (!H.dbReachable) return;
    const orgId = crypto.randomUUID();
    await repo.create({ organizationId: orgId, currentStep: 1, stepsCompleted: [1] });

    const before = await repo.findByOrg(orgId);
    expect(before).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));

    const completedAt = new Date();
    const updated = await repo.update(orgId, {
      currentStep: 3,
      stepsCompleted: [1, 2, 3],
      completedAt,
    });
    expect(updated?.currentStep).toBe(3);
    expect(updated?.stepsCompleted).toEqual([1, 2, 3]);
    expect(updated?.completedAt).toBeTruthy();
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.updatedAt).getTime(),
    );

    // Read back the persisted jsonb + completed_at to confirm it landed in PG.
    const { rows } = await H.scopedPool.query(
      `SELECT current_step, steps_completed, completed_at
         FROM "${H.schema}".onboarding_state WHERE organization_id = $1`,
      [orgId],
    );
    expect(rows[0].current_step).toBe(3);
    expect(rows[0].steps_completed).toEqual([1, 2, 3]);
    expect(rows[0].completed_at).not.toBeNull();
  });

  test('update returns undefined when org has no state row', async () => {
    if (!H.dbReachable) return;
    const result = await repo.update(MISSING_ORG_ID, { currentStep: 2 });
    expect(result).toBeUndefined();
  });
});

/**
 * W3 onboarding S2 — per-org singleton invariant proofs against the LIVE
 * constraints copied by `LIKE … INCLUDING ALL`:
 *   - UNIQUE onboarding_state_organization_id_unique → raw SQLSTATE 23505
 *   - organization_id NOT NULL → raw SQLSTATE 23502
 *   - positive: two distinct orgs each own a separate row (no false collision)
 * Asserts the raw Postgres error codes, not a stubbed throw.
 */
describe('OnboardingStateRepository — per-org UNIQUE + org_id NOT NULL (real SQLSTATE)', () => {
  test('second create for the same org raises 23505 from onboarding_state_organization_id_unique', async () => {
    if (!H.dbReachable) return;
    const orgId = crypto.randomUUID();

    const first = await repo.create({ organizationId: orgId, currentStep: 1, stepsCompleted: [1] });
    expect(first.organizationId).toBe(orgId);

    let code: string | undefined;
    let constraint: string | undefined;
    try {
      // Different surrogate id, SAME organization_id — the unique constraint must reject it.
      await repo.create({ organizationId: orgId, currentStep: 1, stepsCompleted: [1] });
    } catch (e) {
      // drizzle wraps the pg driver error in `.cause`; prefer it.
      const pg = (e as { cause?: { code?: string; constraint?: string } }).cause ?? e;
      code = (pg as { code?: string }).code;
      constraint = (pg as { constraint?: string }).constraint;
    }
    expect(code).toBe('23505');
    expect(constraint).toBe('onboarding_state_organization_id_key');

    // The original singleton row is untouched — still exactly one row for the org.
    const { rows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".onboarding_state WHERE organization_id = $1`,
      [orgId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first.id);
  });

  test('insert omitting organization_id raises 23502 (live NOT NULL)', async () => {
    if (!H.dbReachable) return;

    let code: string | undefined;
    let column: string | undefined;
    try {
      // Omit organization_id entirely — the live NOT NULL must reject it (org_id has no default).
      await H.db.insert(onboardingStates).values({} as never);
    } catch (e) {
      // drizzle wraps the pg driver error in `.cause`; prefer it.
      const pg = (e as { cause?: { code?: string; column?: string } }).cause ?? e;
      code = (pg as { code?: string }).code;
      column = (pg as { column?: string }).column;
    }
    expect(code).toBe('23502');
    expect(column).toBe('organization_id');
  });

  test('two different orgs each get their own state row — no false collision', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();

    const a = await repo.create({ organizationId: orgA, currentStep: 1, stepsCompleted: [1] });
    const b = await repo.create({ organizationId: orgB, currentStep: 1, stepsCompleted: [1] });
    expect(a.id).not.toBe(b.id);

    const hitA = await repo.findByOrg(orgA);
    const hitB = await repo.findByOrg(orgB);
    expect(hitA?.id).toBe(a.id);
    expect(hitB?.id).toBe(b.id);
    expect(hitA?.id).not.toBe(hitB?.id);
    expect(hitA?.organizationId).toBe(orgA);
    expect(hitB?.organizationId).toBe(orgB);
  });
});
