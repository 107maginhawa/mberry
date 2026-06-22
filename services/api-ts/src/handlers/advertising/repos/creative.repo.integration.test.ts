/**
 * CreativeRepository — real-Postgres integration coverage (createScratch).
 *
 * Exercises filter branches (org, campaign, status), approve/reject/pause
 * transitions, report persistence (createReport), and the report counters
 * (countReports + countReportsWithinDays rolling window).
 *
 * Migrated off the shared-`public` transaction-rollback harness onto an isolated
 * `createScratch` schema; the `capturePristine`/`restorePristine` prototype-restore
 * hack is gone (per-schema pool removes the cross-file `mock()` pollution it worked
 * around). Skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { CreativeRepository } from './creative.repo';
import type { NewCreative } from './advertising.schema';
import { seedAdvertiser, seedCampaign } from './advertiser.repo.integration.test';

function newCreative(
  orgId: string,
  campaignId: string,
  overrides: Partial<NewCreative> = {},
): NewCreative {
  return {
    organizationId: orgId,
    campaignId,
    title: 'Creative',
    bodyText: 'body',
    status: 'pending',
    sponsoredLabel: true,
    ...overrides,
  } as NewCreative;
}

/** Seed advertiser → campaign, return the campaign id (creative parent). */
async function mkCampaign(H: ScratchDb, orgId: string): Promise<string> {
  const advId = await seedAdvertiser(H, orgId);
  return seedCampaign(H, orgId, advId);
}

describe('CreativeRepository (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch(['advertiser', 'ad_campaign', 'ad_creative', 'ad_report']);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  test('filters: org / campaign / status + org-scoping isolation', async () => {
    if (!H.dbReachable) return;
    const repo = new CreativeRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const campA = await mkCampaign(H, orgA);
    const campB = await mkCampaign(H, orgB);
    await repo.createOne(newCreative(orgA, campA, { status: 'approved' }));
    await repo.createOne(newCreative(orgA, campA, { status: 'pending' }));
    await repo.createOne(newCreative(orgB, campB)); // foreign org

    expect(await repo.findMany()).not.toBeUndefined(); // undefined-filter branch

    const orgAList = await repo.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((c) => c.organizationId === orgA)).toBe(true);

    expect((await repo.findMany({ campaignId: campA })).length).toBe(2);
    expect((await repo.findMany({ organizationId: orgA, status: 'approved' })).length).toBe(1);
  });

  test('approveCreative / rejectCreative / pauseCreative transitions', async () => {
    if (!H.dbReachable) return;
    const repo = new CreativeRepository(H.db as never);
    const org = crypto.randomUUID();
    const camp = await mkCampaign(H, org);
    const admin = crypto.randomUUID();

    const c1 = await repo.createOne(newCreative(org, camp));
    const approved = await repo.approveCreative(c1.id, admin);
    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe(admin);
    expect(approved.reviewedAt).not.toBeNull();

    const c2 = await repo.createOne(newCreative(org, camp));
    const rejected = await repo.rejectCreative(c2.id, admin, 'off-brand');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('off-brand');

    // pauseCreative reverts an approved creative back to pending (no enum 'paused')
    const paused = await repo.pauseCreative(c1.id);
    expect(paused.status).toBe('pending');

    // read-back the persisted status, not just the returned object
    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [c1.id],
    );
    expect(rows[0].status).toBe('pending');
  });

  test('createReport persists a row; counters reflect total + rolling window', async () => {
    if (!H.dbReachable) return;
    const repo = new CreativeRepository(H.db as never);
    const org = crypto.randomUUID();
    const camp = await mkCampaign(H, org);
    const c = await repo.createOne(newCreative(org, camp));

    // default actorId branch (actorId undefined → reporterPersonId used)
    const reporter = crypto.randomUUID();
    const report = await repo.createReport({
      organizationId: org,
      creativeId: c.id,
      reporterPersonId: reporter,
      reason: 'spam',
    });
    expect(report.creativeId).toBe(c.id);
    expect(report.createdBy).toBe(reporter);

    // explicit actorId branch
    await repo.createReport({
      organizationId: org,
      creativeId: c.id,
      reporterPersonId: crypto.randomUUID(),
      reason: 'offensive',
      actorId: crypto.randomUUID(),
    });

    expect(await repo.countReports(c.id)).toBe(2);

    // Backdate the 'offensive' report 10 days to test the rolling-window cutoff.
    await H.scopedPool.query(
      `UPDATE "${H.schema}".ad_report SET created_at = now() - interval '10 days'
         WHERE creative_id = $1 AND reason = 'offensive'`,
      [c.id],
    );

    expect(await repo.countReportsWithinDays(c.id, 7)).toBe(1); // only the recent one
    expect(await repo.countReportsWithinDays(c.id, 30)).toBe(2); // both inside window
    // unknown creative → 0 (?? fallback branch)
    expect(await repo.countReports(crypto.randomUUID())).toBe(0);
  });
});
