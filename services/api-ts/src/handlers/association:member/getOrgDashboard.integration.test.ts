/**
 * getOrgDashboard — real-PG aggregation (R4-4).
 *
 * The org dashboard is the officer landing aggregation (member/finance/activity
 * counts + officer list) built from inline SQL across 8 tables, behind a
 * President/Treasurer/Secretary position gate — and it had ZERO integration
 * coverage. This drives the REAL handler against a createScratch schema, seeding
 * memberships/applications/officer-term and asserting the member-count
 * aggregation + the officer list against persisted rows.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { getOrgDashboard } from './getOrgDashboard';

let H: ScratchDb;
const ORG = '00000000-0000-4000-8000-0000000b8701';
const PRESIDENT = '00000000-0000-4000-8000-0000000b8700';

beforeAll(async () => {
  H = await createScratch([
    'membership', 'membership_application', 'dues_invoice',
    'event', 'training', 'officer_term', 'position', 'person',
  ]);
  if (!H.dbReachable) return;
  // The caller: a President officer so requirePosition passes + appears in the
  // officer list.
  const positionId = crypto.randomUUID();
  await H.scopedPool.query(`INSERT INTO "${H.schema}".person (id, first_name, last_name) VALUES ($1,'Pres','Ident')`, [PRESIDENT]);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (id, organization_id, title, level, term_length_months) VALUES ($1,$2,'President','chapter',12)`,
    [positionId, ORG]);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".officer_term (id, position_id, person_id, organization_id, status, start_date) VALUES ($1,$2,$3,$4,'active', now())`,
    [crypto.randomUUID(), positionId, PRESIDENT, ORG]);
});
afterAll(async () => {
  await H?.teardown();
});

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
  l['child'] = () => l;
  return l;
}

interface Dash { data: { members: { active: number; pending: number; expiring: number; total: number }; officers: Array<{ personId: string; position: string }> } }

function makeCtx() {
  let captured: { body: Dash; status: number } = { body: { data: { members: { active: 0, pending: 0, expiring: 0, total: 0 }, officers: [] } }, status: 0 };
  const store: Record<string, unknown> = {
    user: { id: PRESIDENT, twoFactorEnabled: false },
    session: { user: { id: PRESIDENT } },
    database: H.db,
    logger: makeLogger(),
  };
  const ctx = {
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => { store[k] = v; }, // getOrgDashboard sets organizationId, requirePosition reads it
    req: { param: (_k: string) => ORG },
    json: (b: Dash, status: number) => { captured = { body: b, status }; return new Response(JSON.stringify(b), { status }); },
    _captured: () => captured,
  };
  return ctx as never;
}

async function seedMembership(status: string, expiresInDays: number | null): Promise<void> {
  const expiry = expiresInDays === null ? null : new Date(Date.now() + expiresInDays * 86_400_000).toISOString().slice(0, 10);
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, grace_period_days, status, joined_at, dues_expiry_date)
     VALUES ($1,$2,$3,$4, CURRENT_DATE, 0, $5::membership_status, now(), $6::date)`,
    [crypto.randomUUID(), ORG, crypto.randomUUID(), crypto.randomUUID(), status, expiry],
  );
}
async function seedApplication(status: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership_application
       (id, organization_id, person_id, tier_id, application_date, status)
     VALUES ($1,$2,$3,$4, CURRENT_DATE, $5::application_status)`,
    [crypto.randomUUID(), ORG, crypto.randomUUID(), crypto.randomUUID(), status],
  );
}

describe('getOrgDashboard aggregation (real PG)', () => {
  test('member counts aggregate active/total/expiring/pending; officer list reflects the term', async () => {
    if (!H.dbReachable) return;
    // 3 active (one expiring within 30d) + 1 non-active → active=3, total=4, expiring=1.
    await seedMembership('active', 200);
    await seedMembership('active', 200);
    await seedMembership('active', 15); // expiring this month
    await seedMembership('pendingPayment', null);
    // 2 applications awaiting review → pending=2.
    await seedApplication('submitted');
    await seedApplication('underReview');

    const ctx = makeCtx();
    const res = await getOrgDashboard(ctx);
    expect(res.status).toBe(200);

    const { body } = (ctx as unknown as { _captured: () => { body: Dash } })._captured();
    expect(body.data.members.active).toBe(3);
    expect(body.data.members.total).toBe(4);
    expect(body.data.members.expiring).toBe(1);
    expect(body.data.members.pending).toBe(2);
    // The seeded President shows in the officer list.
    expect(body.data.officers.some((o) => o.personId === PRESIDENT && o.position === 'President')).toBe(true);
  });

  test('a non-officer caller is denied (requirePosition gate)', async () => {
    if (!H.dbReachable) return;
    const store: Record<string, unknown> = {
      user: { id: crypto.randomUUID(), twoFactorEnabled: false },
      session: { user: { id: 'x' } },
      database: H.db,
      logger: makeLogger(),
    };
    const ctx = {
      get: (k: string) => store[k],
      set: (k: string, v: unknown) => { store[k] = v; },
      req: { param: () => ORG },
      json: (b: unknown, status: number) => new Response(JSON.stringify(b), { status }),
    } as never;
    const res = await getOrgDashboard(ctx);
    expect(res.status).toBe(403);
  });
});
