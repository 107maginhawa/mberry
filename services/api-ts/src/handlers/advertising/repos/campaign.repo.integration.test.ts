/**
 * CampaignRepository — real-Postgres integration coverage.
 *
 * Exercises filter branches (org, advertiser, status, adSlot), pauseCampaign,
 * and findByIds (empty, org-scoped, and unscoped paths — the defense-in-depth
 * cross-org leak guard). Transaction-rollback harness; skips cleanly without
 * DATABASE_URL / unmigrated schema.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { CampaignRepository } from './campaign.repo';
import { advertisers, type NewAdvertiser, type NewCampaign } from './advertising.schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;
const ROLLBACK = '__campaign_repo_rollback__';

/**
 * Sibling handler tests mock repo prototype methods and never restore them;
 * bun loads+runs files sequentially so an import-time snapshot would capture
 * the mocks. Fresh-import (cache-busted) the repo in beforeAll to recover
 * pristine implementations, then reinstate them before each test. Order-proof.
 */
const BASE_METHODS = ['createOne', 'findMany', 'findOneById', 'updateOneById'] as const;
let restorePristine: () => void = () => {};
async function capturePristine(): Promise<void> {
  const fresh = await import(`./campaign.repo?pristine=${Date.now()}`);
  const FreshRepo = fresh.CampaignRepository as typeof CampaignRepository;
  const freshBase = Object.getPrototypeOf(FreshRepo.prototype);
  restorePristine = () => {
    for (const k of BASE_METHODS) {
      delete (CampaignRepository.prototype as any)[k];
      (DatabaseRepository.prototype as any)[k] = (freshBase as any)[k];
    }
    (CampaignRepository.prototype as any).pauseCampaign = FreshRepo.prototype.pauseCampaign;
    (CampaignRepository.prototype as any).findByIds = FreshRepo.prototype.findByIds;
    (CampaignRepository.prototype as any).buildWhereConditions = (FreshRepo.prototype as any).buildWhereConditions;
  };
}

function newAdvertiser(orgId: string): NewAdvertiser {
  return {
    organizationId: orgId,
    companyName: 'Adv',
    contactEmail: `adv-${crypto.randomUUID()}@x.test`,
  } as NewAdvertiser;
}
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

async function inTx(
  db: DatabaseInstance,
  body: (repo: CampaignRepository, mkAdvertiser: (o: string) => Promise<string>) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const repo = new CampaignRepository(tx as never);
      const mkAdvertiser = async (orgId: string): Promise<string> => {
        const [a] = await (tx as never as DatabaseInstance)
          .insert(advertisers)
          .values(newAdvertiser(orgId))
          .returning({ id: advertisers.id });
        return a!.id;
      };
      await body(repo, mkAdvertiser);
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if ((e as Error).message === ROLLBACK) return;
    if (/relation .* does not exist/i.test((e as Error).message)) {
      console.log('Skipping campaign.repo DB test: schema not migrated');
      return;
    }
    throw e;
  }
}

describe('CampaignRepository (real-PG)', () => {
  let db: DatabaseInstance | null = null;
  beforeAll(async () => {
    if (SKIP) return;
    const { createDatabase } = await import('@/core/database');
    db = createDatabase({ url: DATABASE_URL! });
    await capturePristine();
  });
  beforeEach(() => restorePristine());
  afterAll(async () => {
    if (db) {
      const { closeDatabaseConnection } = await import('@/core/database');
      await closeDatabaseConnection(db);
    }
  });

  test('filters: org / advertiser / status / adSlot + org-scoping isolation', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo, mkAdvertiser) => {
      const orgA = crypto.randomUUID();
      const orgB = crypto.randomUUID();
      const advA = await mkAdvertiser(orgA);
      const advB = await mkAdvertiser(orgB);
      await repo.createOne(newCampaign(orgA, advA, { status: 'active', adSlot: 'sidebar' }));
      await repo.createOne(newCampaign(orgA, advA, { status: 'draft' }));
      await repo.createOne(newCampaign(orgB, advB, { status: 'active' })); // foreign org

      expect(await repo.findMany()).not.toBeUndefined(); // undefined-filter branch

      const orgAList = await repo.findMany({ organizationId: orgA });
      expect(orgAList.length).toBe(2);
      expect(orgAList.every((c) => c.organizationId === orgA)).toBe(true);

      expect((await repo.findMany({ advertiserId: advA })).length).toBe(2);
      expect((await repo.findMany({ organizationId: orgA, status: 'active' })).length).toBe(1);
      // org-scope the slot filter — other committed rows in the DB may use 'sidebar'.
      expect((await repo.findMany({ organizationId: orgA, adSlot: 'sidebar' })).length).toBe(1);
    });
  });

  test('pauseCampaign sets status=paused', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo, mkAdvertiser) => {
      const org = crypto.randomUUID();
      const adv = await mkAdvertiser(org);
      const c = await repo.createOne(newCampaign(org, adv, { status: 'active' }));
      const updatedBy = crypto.randomUUID();
      const paused = await repo.pauseCampaign(c.id, updatedBy);
      expect(paused.status).toBe('paused');
      expect(paused.updatedBy).toBe(updatedBy);
    });
  });

  test('findByIds: empty short-circuits; org-scoped excludes cross-org; unscoped returns all', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo, mkAdvertiser) => {
      const orgA = crypto.randomUUID();
      const orgB = crypto.randomUUID();
      const advA = await mkAdvertiser(orgA);
      const advB = await mkAdvertiser(orgB);
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
});
