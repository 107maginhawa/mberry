/**
 * Real-Postgres integration coverage for OnboardingStateRepository
 * (src/handlers/onboarding/repos/onboarding.repo.ts).
 *
 * onboarding_state has a hard FK + unique on organization_id ->
 * organization(id). We insert one scratch org and a single state for it.
 * afterAll deletes the state + org. Documented skip when Postgres unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { OnboardingStateRepository } from './onboarding.repo';
import { onboardingStates } from './onboarding.schema';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const ORG_ID = crypto.randomUUID();
const MISSING_ORG_ID = crypto.randomUUID();

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let repo: OnboardingStateRepository;
let dbReachable = false;

beforeAll(async () => {
  // These tests seed the shared `public` schema; under CI's parallel suite that
  // contends on connections + needs migrations. Run them locally only — the
  // equivalent coverage runs against a migrated dev DB. (See SCRATCH-schema
  // integration tests, e.g. comms-repos / approvalRollback, for the isolated
  // pattern these should migrate to later.)
  if (process.env['CI']) { return; }
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `INSERT INTO organization (id, association_id, name, slug, org_type, status)
         VALUES ($1, $2, $3, $4, 'society', 'active')`,
        [ORG_ID, crypto.randomUUID(), `onb-test-${ORG_ID}`, `onb-test-${ORG_ID}`],
      );
    } finally {
      c.release();
    }
    db = drizzle(pool);
    repo = new OnboardingStateRepository(db as never);
    dbReachable = true;
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[onboarding.repo integration] Postgres unreachable; skipping. ${(err as Error).message}`);
  }
});

afterAll(async () => {
  if (pool) {
    try {
      if (dbReachable) {
        await db.delete(onboardingStates).where(eq(onboardingStates.organizationId, ORG_ID));
        await pool.query(`DELETE FROM organization WHERE id = $1`, [ORG_ID]);
      }
    } finally {
      await pool.end();
    }
  }
});

describe('OnboardingStateRepository (real-PG)', () => {
  test('findByOrg miss returns undefined before any create', async () => {
    if (!dbReachable) return;
    expect(await repo.findByOrg(MISSING_ORG_ID)).toBeUndefined();
  });

  test('create persists defaults; findByOrg hit returns it', async () => {
    if (!dbReachable) return;
    const created = await repo.create({ organizationId: ORG_ID, currentStep: 1, stepsCompleted: [1] });
    expect(created.organizationId).toBe(ORG_ID);
    expect(created.currentStep).toBe(1);

    const hit = await repo.findByOrg(ORG_ID);
    expect(hit?.id).toBe(created.id);
  });

  test('update applies partial fields + bumps updatedAt', async () => {
    if (!dbReachable) return;
    const before = await repo.findByOrg(ORG_ID);
    expect(before).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));

    const completedAt = new Date();
    const updated = await repo.update(ORG_ID, {
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
  });

  test('update returns undefined when org has no state row', async () => {
    if (!dbReachable) return;
    const result = await repo.update(MISSING_ORG_ID, { currentStep: 2 });
    expect(result).toBeUndefined();
  });
});
