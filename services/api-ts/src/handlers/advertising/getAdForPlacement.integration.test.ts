/**
 * getAdForPlacement serving gate — real-PG workflow characterization (createScratch).
 *
 * Slice W3 advertising S5 (axis workflow). The mock-ctx unit suite
 * (getAdForPlacement.test.ts) stubs every repo prototype and so never proves the
 * gate against PERSISTED campaign/creative/opt-out rows. This suite drives the
 * REAL handler (getAdForPlacement) — which constructs real CreativeRepository /
 * CampaignRepository / MemberAdOptOutRepository against an isolated scratch schema —
 * and asserts the serve decision from real data. This is the revenue/leak surface:
 *
 *  - AC-M16-004: opt-out wins SERVER-SIDE (a member_ad_opt_out row → ad:null,
 *    reason:'member_opted_out') even if the parent campaign is active + in-window
 *    and the creative is approved, and regardless of any client `optedOut` query flag.
 *  - AC-M16-001: only `approved` creatives serve (pending/rejected → no_approved_ads;
 *    adding an approved one serves it).
 *  - M16-R6 / FIX-010: serving is gated on the parent campaign being `active` AND
 *    within its starts_at..ends_at window (paused / future-start / past-end → not served).
 *  - cross-org leak guard: an approved+active+in-window creative in orgB must NEVER
 *    serve to a user scoped to orgA (getAdForPlacement.ts:50/62 org filters).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { getAdForPlacement } from './getAdForPlacement';
import { seedAdvertiser, seedCampaign, seedCreative } from './repos/advertiser.repo.integration.test';

const DAY = 24 * 60 * 60 * 1000;

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => noopLogger,
};

/** Build a ValidatedContext-shaped object backed by the real scratch db. */
function makePlacementCtx(
  H: ScratchDb,
  opts: { userId: string; orgId: string; query?: Record<string, unknown> },
) {
  let captured: { data: any; status: number } = { data: null, status: 0 };
  return {
    get: (key: string) =>
      ({
        user: { id: opts.userId, name: 'Member' },
        database: H.db,
        logger: noopLogger,
        organizationId: opts.orgId,
        requestId: 'trace-placement',
      })[key],
    set: () => {},
    req: { valid: (type: string) => (type === 'query' ? (opts.query ?? {}) : {}) },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

/** Seed a member_ad_opt_out row directly (FKs dropped by LIKE). */
async function seedOptOut(H: ScratchDb, orgId: string, personId: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".member_ad_opt_out (organization_id, person_id, created_by, updated_by)
     VALUES ($1, $2, $2, $2)`,
    [orgId, personId],
  );
}

/** Seed an advertiser → active in-window campaign → approved creative; returns creativeId. */
async function seedServableCreative(H: ScratchDb, orgId: string): Promise<string> {
  const advId = await seedAdvertiser(H, orgId);
  const campId = await seedCampaign(H, orgId, advId, {
    status: 'active',
    startsAt: new Date(Date.now() - DAY),
    endsAt: new Date(Date.now() + DAY),
  });
  return seedCreative(H, orgId, campId, { status: 'approved' });
}

describe('getAdForPlacement serving gate (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch([
      'advertiser',
      'ad_campaign',
      'ad_creative',
      'member_ad_opt_out',
      'ad_report',
    ]);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  // ── opt-out wins server-side (AC-M16-004) ────────────────────────────────
  test('opt-out row wins over an approved+active+in-window creative → member_opted_out', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    // A fully servable creative exists for this org...
    const creativeId = await seedServableCreative(H, org);
    // ...but the member has opted out.
    await seedOptOut(H, org, member);

    const ctx = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.ad).toBeNull();
    expect(data.generic).toBe(true);
    expect(data.reason).toBe('member_opted_out');

    // Sanity: the servable creative really exists + is approved (proves opt-out, not
    // a missing-ad, drove the null).
    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(rows[0].status).toBe('approved');
  });

  test('opt-out wins regardless of a client optedOut=false query flag (server-side authority)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    await seedServableCreative(H, org);
    await seedOptOut(H, org, member);

    // Client tries to override with optedOut=false — must be ignored.
    const ctx = makePlacementCtx(H, { userId: member, orgId: org, query: { optedOut: 'false' } });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('member_opted_out');
  });

  // ── approval gate (AC-M16-001) ───────────────────────────────────────────
  test('approval gate: only pending/rejected creatives present → no_approved_ads, then approved serves', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId, {
      status: 'active',
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
    });
    // No approved creatives yet — only a pending and a rejected one.
    await seedCreative(H, org, campId, { status: 'pending' });
    await seedCreative(H, org, campId, { status: 'rejected' });

    const ctx1 = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx1);
    expect(ctx1._captured().data.ad).toBeNull();
    expect(ctx1._captured().data.reason).toBe('no_approved_ads');

    // Now add an approved creative on the same active+in-window campaign → it serves.
    const approvedId = await seedCreative(H, org, campId, { status: 'approved' });
    const ctx2 = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx2);
    const { data } = ctx2._captured();
    expect(data.generic).toBe(false);
    expect(data.ad).not.toBeNull();
    expect(data.ad.id).toBe(approvedId);
    expect(data.ad.status).toBe('approved');
    expect(data.ad.sponsoredLabel).toBe(true);
  });

  // ── campaign status/schedule gate (M16-R6 / FIX-010) ─────────────────────
  test('M16-R6: approved creative under a PAUSED campaign does not serve', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId, {
      status: 'paused',
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
    });
    await seedCreative(H, org, campId, { status: 'approved' });

    const ctx = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('no_approved_ads');
  });

  test('M16-R6: approved creative under an ACTIVE-but-not-yet-started campaign does not serve', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId, {
      status: 'active',
      startsAt: new Date(Date.now() + DAY), // starts tomorrow
      endsAt: new Date(Date.now() + 10 * DAY),
    });
    await seedCreative(H, org, campId, { status: 'approved' });

    const ctx = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('no_approved_ads');
  });

  test('M16-R6: approved creative under an ACTIVE-but-ended campaign does not serve', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId, {
      status: 'active',
      startsAt: new Date(Date.now() - 10 * DAY),
      endsAt: new Date(Date.now() - DAY), // ended yesterday
    });
    await seedCreative(H, org, campId, { status: 'approved' });

    const ctx = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('no_approved_ads');
  });

  test('M16-R6: only the ACTIVE + in-window campaign serves when paused/expired siblings exist', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);

    // Paused campaign with an approved creative — must NOT serve.
    const pausedCamp = await seedCampaign(H, org, advId, {
      status: 'paused',
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
    });
    await seedCreative(H, org, pausedCamp, { status: 'approved' });

    // Active + in-window campaign with an approved creative — the only servable one.
    const liveCamp = await seedCampaign(H, org, advId, {
      status: 'active',
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
    });
    const liveCreativeId = await seedCreative(H, org, liveCamp, { status: 'approved' });

    const ctx = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.generic).toBe(false);
    expect(data.ad).not.toBeNull();
    expect(data.ad.id).toBe(liveCreativeId);
    expect(data.ad.campaignId).toBe(liveCamp);
  });

  // ── cross-org leak guard ─────────────────────────────────────────────────
  test('cross-org leak guard: an approved+active+in-window creative in orgB never serves to an orgA user', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const memberA = crypto.randomUUID();

    // A fully servable creative exists ONLY in orgB.
    const orgBCreative = await seedServableCreative(H, orgB);

    // The orgA user has nothing servable in their org.
    const ctx = makePlacementCtx(H, { userId: memberA, orgId: orgA });
    await getAdForPlacement(ctx);
    const { data } = ctx._captured();
    expect(data.ad).toBeNull();
    expect(data.reason).toBe('no_approved_ads');

    // Sanity: orgB's creative really is approved + would be servable to an orgB user.
    const ctxB = makePlacementCtx(H, { userId: crypto.randomUUID(), orgId: orgB });
    await getAdForPlacement(ctxB);
    const dataB = ctxB._captured().data;
    expect(dataB.generic).toBe(false);
    expect(dataB.ad.id).toBe(orgBCreative);
  });
});
