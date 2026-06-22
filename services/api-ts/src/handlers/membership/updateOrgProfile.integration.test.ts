/**
 * [AC-M04] Organization profile update (real PG).
 *
 * R1-3 backfill. `updateOrgProfile` (PUT /membership/org-profile/:organizationId,
 * President-restricted) is wired in the OpenAPI registry. Its only test was a
 * pure-fn characterization (association:member/ac-m04.org-admin.test.ts
 * re-implements updateOrgSettings inline). No test exercised the real
 * OrganizationRepository against Postgres, so a drift in the persisted columns
 * would pass unnoticed.
 *
 * This suite drives the REAL handler against a `createScratch` copy of the
 * `organization` table: it seeds an org, updates name/contactEmail/region, and
 * asserts the persisted row changed (not just the response echo), and that an
 * unknown org id throws NotFound.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { NotFoundError } from '@/core/errors';
import { updateOrgProfile } from './updateOrgProfile';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['organization']);
});
afterAll(async () => {
  await H?.teardown();
});

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  };
  l['child'] = () => l;
  return l;
}

interface OrgResp { data: Record<string, unknown> }

function makeCtx(orgId: string, body: unknown) {
  let captured: { body: OrgResp; status: number } = { body: { data: {} }, status: 0 };
  const store: Record<string, unknown> = { database: H.db, logger: makeLogger() };
  const ctx = {
    get: (k: string) => store[k],
    req: {
      param: (_k: string) => orgId,
      json: async () => body,
    },
    json: (b: OrgResp, status: number) => { captured = { body: b, status }; return new Response(JSON.stringify(b), { status }); },
    _captured: () => captured,
  };
  return ctx as never;
}
function cap(ctx: never): { body: OrgResp; status: number } {
  return (ctx as unknown as { _captured: () => { body: OrgResp; status: number } })._captured();
}

async function seedOrgRow(): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization (id, association_id, name, org_type, status, slug)
     VALUES ($1,$2,'Old Name','society','active',$3)`,
    [id, crypto.randomUUID(), `old-slug-${id.slice(0, 8)}`],
  );
  return id;
}

describe('[AC-M04] updateOrgProfile (real PG)', () => {
  test('persists name/contactEmail/region to the organization row', async () => {
    if (!H.dbReachable) return;
    const orgId = await seedOrgRow();

    const ctx = makeCtx(orgId, { name: 'New Name', contactEmail: 'new@org.ph', region: 'NCR' });
    const res = await updateOrgProfile(ctx);
    expect(res.status).toBe(200);
    expect(cap(ctx).body.data['name']).toBe('New Name');

    // Read-back the ACTUAL row — the response echo isn't proof of persistence.
    const { rows } = await H.scopedPool.query<{ name: string; contact_email: string; region: string }>(
      `SELECT name, contact_email, region FROM "${H.schema}".organization WHERE id=$1`, [orgId]);
    expect(rows[0]!.name).toBe('New Name');
    expect(rows[0]!.contact_email).toBe('new@org.ph');
    expect(rows[0]!.region).toBe('NCR');
  });

  test('unknown organization id throws NotFound', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx(crypto.randomUUID(), { name: 'X' });
    await expect(updateOrgProfile(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
