/**
 * Real-Postgres integration test for the MISSING half of the AXIS-3 inter-module
 * contract:  credit/CPD write  →  compliance_standings matview refresh.
 *
 * The PRODUCER side is already covered: the 5 credit-write handlers
 * (awardManualCredit / verifyCreditEntry / rejectCreditEntry / adjustCreditEntry /
 * voidCreditEntry) each `domainEvents.emit('compliance.recompute', { organizationId,
 * reason })` after persisting the entry, and their unit suites assert that emit.
 *
 * The CONSUMER side is NOT tested. The `compliance.recompute` handler in
 * `core/domain-event-consumers.ts` (lines ~1135-1144) is the *other* half of the
 * contract — it runs:
 *
 *     await deps.db.execute(
 *       sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`
 *     )
 *
 * and is wrapped in try/catch that swallows + logs any failure (fire-and-forget).
 * Because emit() resolves even when the refresh throws, nothing proves the matview
 * actually RE-MATERIALIZES the freshly written credits. A regression — a renamed
 * matview, a dropped unique index (CONCURRENTLY needs one), a search-path miss, a
 * broken JOIN to org_cpd_config — would leave the consumer silently logging an
 * error while every test stays green.
 *
 * This suite closes that gap end-to-end against REAL Postgres:
 *   1. Stands up a scratch schema with LIKE-copies of the real `credit_entry` +
 *      `org_cpd_config` tables (all real cols/enums/defaults; no FKs).
 *   2. Recreates the REAL `compliance_standings` materialized view + its unique
 *      index VERBATIM from migration 0075 (`0075_wise_shaman.sql`) inside the
 *      scratch schema (so CONCURRENTLY can resolve a populated, indexed matview).
 *   3. Seeds `credit_entry` (+ `org_cpd_config`) rows, then invokes the CONSUMER's
 *      refresh path directly — `registerDomainEventConsumers({ db: H.db, … })`
 *      followed by `await domainEvents.emit('compliance.recompute', …)`, the exact
 *      wiring the producer triggers.
 *   4. Asserts the matview ACTUALLY re-materialized: a standing row exists with
 *      total/general/major/sdl credits + compliance_status reflecting the seeded
 *      credits — and that NEW credits written *after* a refresh only show up *after*
 *      the next refresh (proving the matview, not a live view, is what we read).
 *
 * Isolation: the shared `createScratch` harness; search_path is pinned via the
 * libpq startup option (no pool-churn race). FKs are dropped by LIKE so we seed
 * credit_entry rows without standing up org/person parents.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres is
 * unreachable the suite skips cleanly (`if (!H.dbReachable) return`).
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { domainEvents } from '@/core/domain-events';
import {
  registerDomainEventConsumers,
  type DomainEventMembershipRepo,
} from '@/core/domain-event-consumers';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

// The compliance.recompute consumer never touches the membership repo, but
// registerDomainEventConsumers requires one — give it an inert stub.
const noopMembershipRepo: DomainEventMembershipRepo = {
  findByPersonAndOrg: async () => null,
  updateOneById: async () => ({}),
};

function freshId(): string {
  return crypto.randomUUID();
}

// A wide cycle window that contains every activityDate we seed below.
const CYCLE_START = new Date('2026-01-01T00:00:00.000Z');
const CYCLE_END = new Date('2026-12-31T23:59:59.000Z');

/**
 * Recreate the REAL `compliance_standings` materialized view + its unique index
 * inside the scratch schema, VERBATIM from migration 0075 (0075_wise_shaman.sql).
 *
 * The matview is part of public's migrated schema, but `createScratch` only LIKE-
 * copies *tables*, not views — so we must stand the matview up ourselves against
 * the scratch-schema `credit_entry` / `org_cpd_config` copies. search_path is
 * pinned to the scratch schema (via the scopedPool startup option), so the
 * unqualified `FROM credit_entry` / `JOIN org_cpd_config` resolve to our copies,
 * and the consumer's later `REFRESH MATERIALIZED VIEW CONCURRENTLY
 * compliance_standings` resolves to THIS matview.
 *
 * CREATE … AS populates the matview immediately (no WITH NO DATA), and the unique
 * index satisfies CONCURRENTLY's precondition.
 */
async function createComplianceStandingsMatview(): Promise<void> {
  await H.scopedPool.query(`
    CREATE MATERIALIZED VIEW compliance_standings AS
    SELECT ce.person_id,ce.organization_id,COALESCE(SUM(ce.credit_amount),0) AS total_credits,
    COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='General'),0) AS general_credits,
    COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Major'),0) AS major_credits,
    COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Self-Directed'),0) AS sdl_credits,
    COUNT(*) AS entry_count,COALESCE(occ.required_credits,60) AS required_credits,
    COALESCE(occ.sdl_cap_percent,40) AS sdl_cap_percent,
    CASE WHEN COALESCE(occ.required_credits,60)=0 THEN 100 ELSE LEAST(ROUND((COALESCE(SUM(ce.credit_amount),0)::numeric/COALESCE(occ.required_credits,60))*100,1),100) END AS compliance_percent,
    CASE WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60) THEN 'compliant' WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60)*0.6 THEN 'at_risk' ELSE 'non_compliant' END AS compliance_status,
    MAX(ce.updated_at) AS last_credit_at
    FROM credit_entry ce LEFT JOIN org_cpd_config occ ON occ.organization_id=ce.organization_id WHERE ce.status='active' AND ce.verification_status='verified' GROUP BY ce.person_id,ce.organization_id,occ.required_credits,occ.sdl_cap_percent
  `);
  await H.scopedPool.query(
    `CREATE UNIQUE INDEX idx_compliance_standings_pk ON compliance_standings (person_id,organization_id)`,
  );
}

/**
 * Insert a credit_entry row directly via raw SQL and return its id. Raw SQL (not a
 * repo) lets us seed arbitrary status / verificationStatus / category / amount
 * combinations the write-path wouldn't normally produce, so the matview's
 * active+verified GROUP BY / FILTER math is proven against adversarial data.
 *
 * Enum columns ($N) are cast with ::<enum> and dates are passed as JS Dates
 * (node-postgres binds timestamptz directly).
 */
async function insertCredit(opts: {
  id?: string;
  personId?: string;
  organizationId?: string;
  type?: 'auto' | 'manual';
  activityDate?: Date;
  creditAmount?: number;
  category?: 'General' | 'Major' | 'Self-Directed' | null;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  status?: 'active' | 'voided' | 'disputed';
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO credit_entry
       (id, person_id, organization_id, type, activity_name, activity_date,
        credit_amount, cycle_start, cycle_end, category, verification_status, status)
     VALUES ($1,$2,$3,$4::credit_entry_type,$5,$6,$7,$8,$9,$10::credit_cpd_category,$11::credit_verification_status,$12::credit_status)`,
    [
      id,
      opts.personId ?? freshId(),
      opts.organizationId ?? freshId(),
      opts.type ?? 'manual',
      'CPD Activity',
      opts.activityDate ?? new Date('2026-06-01T00:00:00.000Z'),
      opts.creditAmount ?? 1,
      CYCLE_START,
      CYCLE_END,
      'category' in opts ? opts.category : 'General',
      opts.verificationStatus ?? 'verified',
      opts.status ?? 'active',
    ],
  );
  return id;
}

/** Read the single standing row for a person+org out of the matview (or null). */
async function readStanding(personId: string, organizationId: string): Promise<any | null> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM compliance_standings WHERE person_id = $1 AND organization_id = $2`,
    [personId, organizationId],
  );
  return rows[0] ?? null;
}

/**
 * Invoke the CONSUMER's refresh path exactly as the producer would: reset the bus,
 * wire the REAL consumers onto the REAL scratch H.db, then `await emit(...)`. emit()
 * awaits Promise.allSettled of every handler, so the matview REFRESH is complete
 * (whether it succeeded or its try/catch swallowed an error) when this resolves.
 */
async function runRecompute(organizationId: string): Promise<void> {
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo: noopMembershipRepo, db: H.db as any }, noopLogger);
  await domainEvents.emit('compliance.recompute', { organizationId, reason: 'manual_award' });
}

beforeAll(async () => {
  H = await createScratch(['credit_entry', 'org_cpd_config']);
  if (H.dbReachable) {
    await createComplianceStandingsMatview();
  }
});

afterAll(async () => {
  domainEvents.reset();
  await H?.teardown();
});

beforeEach(() => {
  // Each test wires its own consumers; clear cross-test handler accumulation.
  domainEvents.reset();
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 1 — the consumer re-materializes newly written credits.
// ═══════════════════════════════════════════════════════════════════════════

describe('compliance.recompute consumer — re-materializes credits (real DB)', () => {
  test('a freshly seeded active+verified credit appears in the matview only AFTER the consumer refreshes', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();

    // Seed AFTER the matview was created+populated in beforeAll → the matview is
    // stale and has NO row for this person yet (proving it's a snapshot, not live).
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 7 });
    expect(await readStanding(personId, orgId)).toBeNull();

    // CONSUMER: emit compliance.recompute → REFRESH MATERIALIZED VIEW CONCURRENTLY.
    await runRecompute(orgId);

    // The matview now reflects the seeded credit.
    const standing = await readStanding(personId, orgId);
    expect(standing).not.toBeNull();
    expect(Number(standing.total_credits)).toBe(7);
    expect(Number(standing.entry_count)).toBe(1);
  });

  test('the consumer aggregates by category — General/Major/Self-Directed roll up into the right buckets', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();

    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 3 });
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 2.5 }); // fractional CPD
    await insertCredit({ personId, organizationId: orgId, category: 'Major', creditAmount: 4 });
    await insertCredit({ personId, organizationId: orgId, category: 'Self-Directed', creditAmount: 1.5 });

    await runRecompute(orgId);

    const standing = await readStanding(personId, orgId);
    expect(standing).not.toBeNull();
    // total = 3 + 2.5 + 4 + 1.5 = 11 (float8 preserves the half-credits).
    expect(Number(standing.total_credits)).toBe(11);
    expect(Number(standing.general_credits)).toBe(5.5);
    expect(Number(standing.major_credits)).toBe(4);
    expect(Number(standing.sdl_credits)).toBe(1.5);
    expect(Number(standing.entry_count)).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 2 — the matview's active+verified gate is respected through the refresh.
// Voided / pending / rejected entries must NOT count toward the standing.
// ═══════════════════════════════════════════════════════════════════════════

describe('compliance.recompute consumer — active+verified gate (real DB)', () => {
  test('only active+verified credits count; voided + pending/rejected are excluded after refresh', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();

    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 10, status: 'active', verificationStatus: 'verified' });
    // Excluded: voided (status != active).
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 100, status: 'voided', verificationStatus: 'verified' });
    // Excluded: pending / rejected verification.
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 50, status: 'active', verificationStatus: 'pending' });
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 25, status: 'active', verificationStatus: 'rejected' });

    await runRecompute(orgId);

    const standing = await readStanding(personId, orgId);
    expect(standing).not.toBeNull();
    // Only the single active+verified row (10) survives the matview's WHERE gate.
    expect(Number(standing.total_credits)).toBe(10);
    expect(Number(standing.entry_count)).toBe(1);
  });

  test('a person with ONLY excluded credits has NO standing row after refresh', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 9, status: 'voided' });

    await runRecompute(orgId);

    // No active+verified credit → the GROUP BY produces no row for this person.
    expect(await readStanding(personId, orgId)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 3 — org_cpd_config drives required_credits + compliance_status through
// the JOIN; the matview reflects the configured threshold after refresh.
// ═══════════════════════════════════════════════════════════════════════════

describe('compliance.recompute consumer — org_cpd_config threshold + status (real DB)', () => {
  test('uses the org config required_credits and computes compliance_status=compliant when met', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();

    // Org requires 10 credits; member earns exactly 10 → compliant.
    await H.scopedPool.query(
      `INSERT INTO org_cpd_config (id, organization_id, required_credits, cycle_length_years, sdl_cap_percent, cycle_start_month)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [freshId(), orgId, 10, 3, 40, 1],
    );
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 10 });

    await runRecompute(orgId);

    const standing = await readStanding(personId, orgId);
    expect(standing).not.toBeNull();
    // required_credits comes from the JOINed org_cpd_config (10), not the default 60.
    expect(Number(standing.required_credits)).toBe(10);
    expect(standing.compliance_status).toBe('compliant');
    expect(Number(standing.compliance_percent)).toBe(100);
  });

  test('falls back to the default 60-credit threshold when org has no config → non_compliant for a small balance', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();

    // No org_cpd_config row → COALESCE(occ.required_credits, 60) defaults to 60.
    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 5 });

    await runRecompute(orgId);

    const standing = await readStanding(personId, orgId);
    expect(standing).not.toBeNull();
    expect(Number(standing.required_credits)).toBe(60);
    // 5 / 60 = 8.3% (< 60% of threshold) → non_compliant.
    expect(standing.compliance_status).toBe('non_compliant');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT 4 — the consumer is a TRUE matview refresh, not a live read: a credit
// written AFTER one refresh only shows up after the NEXT refresh.
// ═══════════════════════════════════════════════════════════════════════════

describe('compliance.recompute consumer — refresh is a snapshot, repeatable (real DB)', () => {
  test('a credit added after the first refresh is invisible until a second recompute runs', async () => {
    if (!H.dbReachable) return;

    const orgId = freshId();
    const personId = freshId();

    await insertCredit({ personId, organizationId: orgId, category: 'General', creditAmount: 4 });
    await runRecompute(orgId);
    expect(Number((await readStanding(personId, orgId)).total_credits)).toBe(4);

    // Add more credit — the matview is now stale (still shows 4).
    await insertCredit({ personId, organizationId: orgId, category: 'Major', creditAmount: 6 });
    expect(Number((await readStanding(personId, orgId)).total_credits)).toBe(4);

    // The consumer runs again (second emit) → matview re-materializes to 10.
    await runRecompute(orgId);
    const standing = await readStanding(personId, orgId);
    expect(Number(standing.total_credits)).toBe(10);
    expect(Number(standing.general_credits)).toBe(4);
    expect(Number(standing.major_credits)).toBe(6);
  });
});
