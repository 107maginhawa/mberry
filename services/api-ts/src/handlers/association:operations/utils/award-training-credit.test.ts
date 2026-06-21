/**
 * BR test for awardTrainingCredit (MISSING dedicated coverage — previously only
 * exercised indirectly via check-in). Real-PG so the cross-module write into
 * association:member's CreditEntryRepository, the org featureFlags read, and the
 * org_cpd_config cycle resolution all hit real SQL. Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { awardTrainingCredit } from './award-training-credit';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { stubRepo } from '@/test-utils/make-ctx';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
const ORG = '00000000-0000-4000-8000-0000000000a1';

function training(o: Partial<Record<string, unknown>> = {}) {
  return {
    id: crypto.randomUUID(), organizationId: ORG, title: 'CPR Seminar',
    creditBearing: true, creditAmount: 1.5, endDate: new Date('2030-05-01T17:00:00Z'),
    ...o,
  } as never;
}

async function creditRows(trainingId: string, personId: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT type, verification_status, credit_amount, activity_date, cycle_start, cycle_end
       FROM "${H.schema}".credit_entry WHERE training_id = $1 AND person_id = $2`,
    [trainingId, personId],
  );
  return rows;
}

async function countByTraining(trainingId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS c FROM "${H.schema}".credit_entry WHERE training_id = $1`, [trainingId]);
  return rows[0]?.c ?? 0;
}

async function seedOrgCpdConfig() {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".org_cpd_config (id, organization_id, cycle_start_month, cycle_length_years)
     VALUES ($1,$2,1,3)`,
    [crypto.randomUUID(), ORG],
  );
}

async function seedOrgWithFlags(orgId: string, flags: Record<string, boolean>) {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization (id, association_id, name, slug, org_type, feature_flags)
     VALUES ($1,$2,'Org',$3,'society'::org_type,$4::jsonb)`,
    [orgId, crypto.randomUUID(), `slug-${orgId.slice(0, 8)}`, JSON.stringify(flags)],
  );
}

beforeAll(async () => {
  H = await createScratch(['credit_entry', 'organization', 'org_cpd_config']);
  if (H.dbReachable) await seedOrgCpdConfig();
});
afterAll(async () => { await H?.teardown(); });

describe('awardTrainingCredit — real-PG', () => {
  test('non-credit-bearing or creditAmount<=0 → 0, zero rows inserted', async () => {
    if (!H.dbReachable) return;
    const t1 = training({ creditBearing: false });
    expect(await awardTrainingCredit(H.db as never, null, t1, crypto.randomUUID())).toEqual({ creditAwarded: 0 });
    const t2 = training({ creditAmount: 0 });
    expect(await awardTrainingCredit(H.db as never, null, t2, crypto.randomUUID())).toEqual({ creditAwarded: 0 });
    expect(await countByTraining((t1 as { id: string }).id)).toBe(0);
    expect(await countByTraining((t2 as { id: string }).id)).toBe(0);
  });

  test('credit-bearing → one AUTO verified credit_entry with fractional amount + resolved cycle', async () => {
    if (!H.dbReachable) return;
    const t = training({ creditAmount: 1.5 });
    const person = crypto.randomUUID();
    const res = await awardTrainingCredit(H.db as never, null, t, person);
    expect(res).toEqual({ creditAwarded: 1.5 });

    const rows = await creditRows((t as { id: string }).id, person);
    expect(rows.length).toBe(1);
    expect(rows[0]!.type).toBe('auto');
    expect(rows[0]!.verification_status).toBe('verified'); // TC-DEC-02: AUTO bypasses the pending gate
    expect(rows[0]!.credit_amount).toBe(1.5); // float8 round-trip (not a string)
    // activity_date = training.endDate; cycle brackets it (resolved from org_cpd_config).
    const activity = new Date(rows[0]!.activity_date).getTime();
    expect(new Date(rows[0]!.cycle_start).getTime()).toBeLessThanOrEqual(activity);
    expect(new Date(rows[0]!.cycle_end).getTime()).toBeGreaterThan(activity);
  });

  test('[AC-M10-002] idempotent: a second call awards 0 and leaves exactly one row', async () => {
    if (!H.dbReachable) return;
    const t = training();
    const person = crypto.randomUUID();
    expect(await awardTrainingCredit(H.db as never, null, t, person)).toEqual({ creditAwarded: 1.5 });
    expect(await awardTrainingCredit(H.db as never, null, t, person)).toEqual({ creditAwarded: 0 });
    expect((await creditRows((t as { id: string }).id, person)).length).toBe(1);
  });

  test('[M9-R8] org toggle off → 0, no row; absent org defaults ON (awards)', async () => {
    if (!H.dbReachable) return;
    const offOrg = crypto.randomUUID();
    await seedOrgWithFlags(offOrg, { creditTracking: false });
    const tOff = training({ organizationId: offOrg });
    const person = crypto.randomUUID();
    expect(await awardTrainingCredit(H.db as never, null, tOff, person)).toEqual({ creditAwarded: 0 });
    expect((await creditRows((tOff as { id: string }).id, person)).length).toBe(0);

    // ORG has no organization row → default ON → awards (proven in the credit-bearing test above).
  });

  test('[G8/FIX-002] a credit-insert failure surfaces as 0 (not swallowed as success) and logs', async () => {
    if (!H.dbReachable) return;
    let errorLogged = false;
    const logger = { error: () => { errorLogged = true; }, debug: () => {} };
    const mocks = stubRepo(CreditEntryRepository, {
      createOne: async () => { throw new Error('forced insert failure'); },
      // findByTrainingAndPerson stays real (returns null) so we reach the insert.
    });
    try {
      const res = await awardTrainingCredit(H.db as never, logger, training(), crypto.randomUUID());
      expect(res).toEqual({ creditAwarded: 0 });
      expect(errorLogged).toBe(true);
    } finally {
      Object.values(mocks).forEach((m) => m.mockRestore());
    }
  });
});
