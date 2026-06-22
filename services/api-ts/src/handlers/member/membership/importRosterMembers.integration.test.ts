/**
 * [BR-22] Member Matching on Import — match-or-create (real PG).
 *
 * R1-3 backfill. `importRosterMembers` (POST /association/member/roster/import,
 * D1) is wired in the OpenAPI registry and is the prod roster-import path. Its
 * only tests were a pure-fn characterization (person/ac-m01.auth-onboarding.test.ts
 * re-implements matchCsvRowToPerson inline) and a stubRepo unit test — neither
 * exercises the real PersonRepository.findByEmailOrLicense / MembershipRepository
 * dedup against Postgres, so a schema/repo drift (e.g. matching the wrong column)
 * would pass them.
 *
 * This suite drives the REAL handler — through the real `requirePosition`
 * officer gate (seeded officer term) — against a `createScratch` schema and
 * asserts the persisted outcome: existing person matched by email (no duplicate
 * person), new person created when unmatched, already-member skipped, and the
 * 500-row batch cap rejected at the wire.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { importRosterMembers } from './importRosterMembers';

let H: ScratchDb;

const ORG = '00000000-0000-4000-8000-0000000a2201';
const TIER = '00000000-0000-4000-8000-0000000a2202';

beforeAll(async () => {
  H = await createScratch(['person', 'membership', 'membership_tier', 'position', 'officer_term']);
  if (!H.dbReachable) return;
  // A Secretary officer term for the importer so requirePosition passes.
  const importer = '00000000-0000-4000-8000-0000000a2200';
  const positionId = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name) VALUES ($1,'Importer')`, [importer]);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (id, organization_id, title, level, term_length_months)
     VALUES ($1,$2,'Secretary','chapter',12)`, [positionId, ORG]);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".officer_term (id, position_id, person_id, organization_id, status, start_date)
     VALUES ($1,$2,$3,$4,'active', now())`, [crypto.randomUUID(), positionId, importer, ORG]);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership_tier (id, organization_id, name, code, annual_fee, currency, status)
     VALUES ($1,$2,'Regular','REG',150000,'PHP','active')`, [TIER, ORG]);
});
afterAll(async () => {
  await H?.teardown();
});

const IMPORTER = '00000000-0000-4000-8000-0000000a2200';

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  };
  l['child'] = () => l;
  return l;
}

interface ImportResult { imported: number; skipped: number; failed: number; errors: unknown[] }

function makeCtx(body: unknown) {
  let captured: { body: ImportResult; status: number } = { body: { imported: 0, skipped: 0, failed: 0, errors: [] }, status: 0 };
  const store: Record<string, unknown> = {
    user: { id: IMPORTER, twoFactorEnabled: false },
    session: { user: { id: IMPORTER } },
    organizationId: ORG,
    database: H.db,
    logger: makeLogger(),
  };
  const ctx = {
    get: (k: string) => store[k],
    set: (_k: string, _v: unknown) => {},
    req: { valid: (_k: 'json') => body },
    json: (b: ImportResult, status: number) => { captured = { body: b, status }; return new Response(JSON.stringify(b), { status }); },
    _captured: () => captured,
  };
  return ctx as never;
}

function cap(ctx: never): { body: ImportResult; status: number } {
  return (ctx as unknown as { _captured: () => { body: ImportResult; status: number } })._captured();
}

async function membershipCount(personId: string): Promise<number> {
  const { rows } = await H.scopedPool.query<{ n: string }>(
    `SELECT count(*) n FROM "${H.schema}".membership WHERE person_id=$1 AND organization_id=$2`, [personId, ORG]);
  return Number(rows[0]!.n);
}
async function personCountByEmail(email: string): Promise<number> {
  const { rows } = await H.scopedPool.query<{ n: string }>(
    `SELECT count(*) n FROM "${H.schema}".person WHERE contact_info->>'email'=$1`, [email]);
  return Number(rows[0]!.n);
}

describe('[BR-22] importRosterMembers match-or-create (real PG)', () => {
  test('matches an existing person by email and creates a membership (no duplicate person)', async () => {
    if (!H.dbReachable) return;
    const alice = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".person (id, first_name, contact_info)
       VALUES ($1,'Alice', '{"email":"alice@x.com"}'::jsonb)`, [alice]);

    const ctx = makeCtx({ tierId: TIER, members: [{ email: 'alice@x.com' }] });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(cap(ctx).body.imported).toBe(1);
    expect(cap(ctx).body.skipped).toBe(0);
    // Membership created for the EXISTING person, and no second Alice was minted.
    expect(await membershipCount(alice)).toBe(1);
    expect(await personCountByEmail('alice@x.com')).toBe(1);
  });

  test('creates a new PII-only person when unmatched, then the membership', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx({ tierId: TIER, members: [{ email: 'bob@x.com', firstName: 'Bob' }] });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(200);
    expect(cap(ctx).body.imported).toBe(1);
    expect(await personCountByEmail('bob@x.com')).toBe(1);
    const { rows } = await H.scopedPool.query<{ id: string }>(
      `SELECT id FROM "${H.schema}".person WHERE contact_info->>'email'='bob@x.com'`);
    expect(await membershipCount(rows[0]!.id)).toBe(1);
  });

  test('skips a person who is already a member of this org (clean skip, not failed)', async () => {
    if (!H.dbReachable) return;
    const ctx1 = makeCtx({ tierId: TIER, members: [{ email: 'carol@x.com', firstName: 'Carol' }] });
    await importRosterMembers(ctx1);
    expect(cap(ctx1).body.imported).toBe(1);
    // Re-import the same person — already a member → skipped, not re-imported.
    const ctx2 = makeCtx({ tierId: TIER, members: [{ email: 'carol@x.com', firstName: 'Carol' }] });
    await importRosterMembers(ctx2);
    expect(cap(ctx2).body.imported).toBe(0);
    expect(cap(ctx2).body.skipped).toBe(1);
  });

  test('rejects a batch over the 500-row cap with 400 (abuse guard)', async () => {
    if (!H.dbReachable) return;
    const members = Array.from({ length: 501 }, (_, i) => ({ email: `bulk${i}@x.com`, firstName: 'B' }));
    const ctx = makeCtx({ tierId: TIER, members });
    const res = await importRosterMembers(ctx);
    expect(res.status).toBe(400);
    expect(String((cap(ctx).body as unknown as { error: string }).error)).toContain('maximum of 500');
  });
});
