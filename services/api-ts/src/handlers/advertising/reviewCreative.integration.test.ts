/**
 * reviewCreative + sponsored-label enforcement — real-PG characterization (createScratch).
 *
 * Slice W3 advertising S4 (axis BR). The mock-ctx unit suite (reviewCreative.test.ts)
 * stubs the repo and only inspects the JSON response; it never proves the approval/
 * rejection actually PERSISTS the right columns, nor that the "only pending creatives
 * can be reviewed" guard performs NO DB write. This suite drives the REAL handlers
 * (reviewCreative + getAdForPlacement) against an isolated scratch schema and asserts
 * the persisted ad_creative rows (status / reviewed_by / reviewed_at / rejection_reason)
 * via raw read-back — real data, not the stubbed return value.
 *
 * BR-47 / AC-M16-003: getAdForPlacement always overrides sponsoredLabel:true even when
 * the stored creative row had sponsored_label=false (getAdForPlacement.ts:88).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { reviewCreative } from './reviewCreative';
import { getAdForPlacement } from './getAdForPlacement';
import { ValidationError, BusinessLogicError } from '@/core/errors';
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
function makeReviewCtx(
  H: ScratchDb,
  opts: { userId: string; orgId: string; creativeId: string; body: Record<string, unknown> },
) {
  let captured: { data: any; status: number } = { data: null, status: 0 };
  return {
    get: (key: string) =>
      ({
        user: { id: opts.userId, name: 'Admin' },
        database: H.db,
        logger: noopLogger,
        organizationId: opts.orgId,
        requestId: 'trace-1',
      })[key],
    set: () => {},
    req: {
      valid: (type: string) =>
        type === 'param' ? { creativeId: opts.creativeId } : type === 'json' ? opts.body : {},
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

function makePlacementCtx(H: ScratchDb, opts: { userId: string; orgId: string }) {
  let captured: { data: any; status: number } = { data: null, status: 0 };
  return {
    get: (key: string) =>
      ({
        user: { id: opts.userId, name: 'Member' },
        database: H.db,
        logger: noopLogger,
        organizationId: opts.orgId,
        requestId: 'trace-2',
      })[key],
    set: () => {},
    req: { valid: () => ({}) },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

async function readCreative(H: ScratchDb, id: string) {
  const { rows } = await H.scopedPool.query(
    `SELECT status, reviewed_by, reviewed_at, rejection_reason
       FROM "${H.schema}".ad_creative WHERE id=$1`,
    [id],
  );
  return rows[0];
}

describe('reviewCreative + sponsored-label (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch(['advertiser', 'ad_campaign', 'ad_creative', 'member_ad_opt_out', 'ad_report']);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  test('approved=true on a pending creative persists status=approved + reviewed_by + reviewed_at', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const admin = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId);
    const creativeId = await seedCreative(H, org, campId, { status: 'pending' });

    const ctx = makeReviewCtx(H, { userId: admin, orgId: org, creativeId, body: { approved: true } });
    await reviewCreative(ctx);
    expect(ctx._captured().status).toBe(200);

    const row = await readCreative(H, creativeId);
    expect(row.status).toBe('approved');
    expect(row.reviewed_by).toBe(admin);
    expect(row.reviewed_at).not.toBeNull();
    expect(row.rejection_reason).toBeNull();
  });

  test('approved=false with a rejectionReason persists status=rejected + rejection_reason', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const admin = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId);
    const creativeId = await seedCreative(H, org, campId, { status: 'pending' });

    const ctx = makeReviewCtx(H, {
      userId: admin,
      orgId: org,
      creativeId,
      body: { approved: false, rejectionReason: '  off-brand imagery  ' },
    });
    await reviewCreative(ctx);
    expect(ctx._captured().status).toBe(200);

    const row = await readCreative(H, creativeId);
    expect(row.status).toBe('rejected');
    expect(row.reviewed_by).toBe(admin);
    expect(row.rejection_reason).toBe('off-brand imagery'); // trimmed (reviewCreative.ts:50)
  });

  test('approved=false WITHOUT a rejectionReason throws ValidationError and writes nothing', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const admin = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId);
    const creativeId = await seedCreative(H, org, campId, { status: 'pending' });

    const ctx = makeReviewCtx(H, {
      userId: admin,
      orgId: org,
      creativeId,
      body: { approved: false }, // no reason
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(ValidationError);

    // No DB write — still pending, no reviewer stamped.
    const row = await readCreative(H, creativeId);
    expect(row.status).toBe('pending');
    expect(row.reviewed_by).toBeNull();
    expect(row.rejection_reason).toBeNull();
  });

  test('state-machine guard: reviewing an already-approved creative throws BusinessLogicError + NO DB write', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const firstAdmin = crypto.randomUUID();
    const secondAdmin = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId);
    const creativeId = await seedCreative(H, org, campId, { status: 'pending' });

    // First review approves it.
    await reviewCreative(
      makeReviewCtx(H, { userId: firstAdmin, orgId: org, creativeId, body: { approved: true } }),
    );
    const before = await readCreative(H, creativeId);
    expect(before.status).toBe('approved');
    expect(before.reviewed_by).toBe(firstAdmin);

    // Second review (try to reject the already-approved one) must be rejected by the guard.
    const ctx = makeReviewCtx(H, {
      userId: secondAdmin,
      orgId: org,
      creativeId,
      body: { approved: false, rejectionReason: 'changed my mind' },
    });
    await expect(reviewCreative(ctx)).rejects.toBeInstanceOf(BusinessLogicError);

    // Read-back proves NO write happened — status still approved, reviewer still the FIRST admin.
    const after = await readCreative(H, creativeId);
    expect(after.status).toBe('approved');
    expect(after.reviewed_by).toBe(firstAdmin);
    expect(after.rejection_reason).toBeNull();
  });

  test('BR-47 / AC-M16-003: getAdForPlacement overrides sponsoredLabel:true even when the row has sponsored_label=false', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const member = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    // active + in-window campaign so the creative is servable
    const campId = await seedCampaign(H, org, advId, {
      status: 'active',
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + DAY),
    });
    // approved creative with the sponsored label deliberately FALSE in storage
    const creativeId = await seedCreative(H, org, campId, {
      status: 'approved',
      sponsoredLabel: false,
    });

    // Sanity: the persisted row really has sponsored_label=false.
    const { rows: stored } = await H.scopedPool.query(
      `SELECT sponsored_label FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(stored[0].sponsored_label).toBe(false);

    const ctx = makePlacementCtx(H, { userId: member, orgId: org });
    await getAdForPlacement(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.generic).toBe(false);
    expect(data.ad).not.toBeNull();
    expect(data.ad.id).toBe(creativeId);
    // The always-enforce override (getAdForPlacement.ts:88) wins over the stored false.
    expect(data.ad.sponsoredLabel).toBe(true);
  });
});
