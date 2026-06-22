/**
 * CampaignRepository — real-Postgres integration coverage (createScratch).
 *
 * Exercises filter branches (org, advertiser, status, adSlot), pauseCampaign,
 * and findByIds (empty, org-scoped, and unscoped paths — the defense-in-depth
 * cross-org leak guard).
 *
 * Migrated off the shared-`public` transaction-rollback harness onto an isolated
 * `createScratch` schema (LIKE public.<t> INCLUDING ALL — faithful
 * nullability/defaults/CHECKs; FKs dropped). The isolated schema + per-schema pool
 * removes the cross-file `mock()` pollution the old suite worked around, so the
 * `capturePristine`/`restorePristine` prototype-restore hack is gone. The empty-start
 * schema also lets the slot filter assert an EXACT count (no "live rows may use
 * 'sidebar'" caveat). Skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { CampaignRepository } from './campaign.repo';
import type { NewCampaign } from './advertising.schema';
import { seedAdvertiser } from './advertiser.repo.integration.test';

function newCampaign(
  orgId: string,
  advertiserId: string,
  overrides: Partial<NewCampaign> = {},
): NewCampaign {
  return {
    organizationId: orgId,
    advertiserId,
    name: 'Campaign',
    status: 'draft',
    adSlot: 'feed_banner',
    budgetCents: 1000,
    spentCents: 0,
    ...overrides,
  } as NewCampaign;
}

describe('CampaignRepository (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch(['advertiser', 'ad_campaign']);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  test('filters: org / advertiser / status / adSlot + org-scoping isolation', async () => {
    if (!H.dbReachable) return;
    const repo = new CampaignRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const advA = await seedAdvertiser(H, orgA);
    const advB = await seedAdvertiser(H, orgB);
    await repo.createOne(newCampaign(orgA, advA, { status: 'active', adSlot: 'sidebar' }));
    await repo.createOne(newCampaign(orgA, advA, { status: 'draft' }));
    await repo.createOne(newCampaign(orgB, advB, { status: 'active' })); // foreign org

    expect(await repo.findMany()).not.toBeUndefined(); // undefined-filter branch

    const orgAList = await repo.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((c) => c.organizationId === orgA)).toBe(true);

    expect((await repo.findMany({ advertiserId: advA })).length).toBe(2);
    expect((await repo.findMany({ organizationId: orgA, status: 'active' })).length).toBe(1);
    // EXACT count on an empty-start isolated schema — no shared-public re-scoping caveat.
    expect((await repo.findMany({ adSlot: 'sidebar' })).length).toBe(1);
    expect((await repo.findMany({ organizationId: orgA, adSlot: 'sidebar' })).length).toBe(1);
  });

  test('pauseCampaign sets status=paused and updatedBy', async () => {
    if (!H.dbReachable) return;
    const repo = new CampaignRepository(H.db as never);
    const org = crypto.randomUUID();
    const adv = await seedAdvertiser(H, org);
    const c = await repo.createOne(newCampaign(org, adv, { status: 'active' }));
    const updatedBy = crypto.randomUUID();
    const paused = await repo.pauseCampaign(c.id, updatedBy);
    expect(paused.status).toBe('paused');
    expect(paused.updatedBy).toBe(updatedBy);

    // read-back the persisted row, not just the returned object
    const { rows } = await H.scopedPool.query(
      `SELECT status, updated_by FROM "${H.schema}".ad_campaign WHERE id=$1`,
      [c.id],
    );
    expect(rows[0].status).toBe('paused');
    expect(rows[0].updated_by).toBe(updatedBy);
  });

  test('findByIds: empty short-circuits; org-scoped excludes cross-org; unscoped returns all', async () => {
    if (!H.dbReachable) return;
    const repo = new CampaignRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const advA = await seedAdvertiser(H, orgA);
    const advB = await seedAdvertiser(H, orgB);
    const cA = await repo.createOne(newCampaign(orgA, advA));
    const cB = await repo.createOne(newCampaign(orgB, advB));

    expect(await repo.findByIds([])).toEqual([]);

    // org-scoped: cB (orgB) must not leak when scoped to orgA
    const scoped = await repo.findByIds([cA.id, cB.id], orgA);
    expect(scoped.length).toBe(1);
    expect(scoped[0]!.id).toBe(cA.id);

    // unscoped: both
    const unscoped = await repo.findByIds([cA.id, cB.id]);
    expect(unscoped.length).toBe(2);
  });
});
