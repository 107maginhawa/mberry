/**
 * CreativeRepository — real-Postgres integration coverage.
 *
 * Exercises filter branches (org, campaign, status), approve/reject/pause
 * transitions, report persistence (createReport), and the report counters
 * (countReports + countReportsWithinDays rolling window). Transaction-rollback
 * harness; skips cleanly without DATABASE_URL / unmigrated schema.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { CreativeRepository } from './creative.repo';
import {
  advertisers,
  campaigns,
  adReports,
  type NewAdvertiser,
  type NewCampaign,
  type NewCreative,
} from './advertising.schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;
const ROLLBACK = '__creative_repo_rollback__';

/**
 * Sibling handler tests mock repo prototype methods via `mock()` and never
 * restore them. Because bun loads+runs test files sequentially, those mutations
 * are still present when this file loads — a plain import-time snapshot would
 * capture the MOCKS. Instead, fresh-import the modules with a cache-busting
 * query (yielding pristine class prototypes) in beforeAll, then copy the real
 * implementations back onto the live prototypes before each test. Order-proof.
 */
const BASE_METHODS = ['createOne', 'findMany', 'findOneById', 'updateOneById'] as const;
const OWN_METHODS = [
  'approveCreative', 'rejectCreative', 'pauseCreative',
  'createReport', 'countReports', 'countReportsWithinDays', 'buildWhereConditions',
] as const;
let restorePristine: () => void = () => {};
async function capturePristine(): Promise<void> {
  const fresh = await import(`./creative.repo?pristine=${Date.now()}`);
  const FreshRepo = fresh.CreativeRepository as typeof CreativeRepository;
  const freshBase = Object.getPrototypeOf(FreshRepo.prototype);
  restorePristine = () => {
    for (const k of BASE_METHODS) {
      delete (CreativeRepository.prototype as any)[k];
      (DatabaseRepository.prototype as any)[k] = (freshBase as any)[k];
    }
    for (const k of OWN_METHODS) (CreativeRepository.prototype as any)[k] = (FreshRepo.prototype as any)[k];
  };
}

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

async function inTx(
  db: DatabaseInstance,
  body: (repo: CreativeRepository, mkCampaign: (o: string) => Promise<string>, tx: DatabaseInstance) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const t = tx as never as DatabaseInstance;
      const repo = new CreativeRepository(tx as never);
      const mkCampaign = async (orgId: string): Promise<string> => {
        const [a] = await t
          .insert(advertisers)
          .values({ organizationId: orgId, companyName: 'A', contactEmail: `a-${crypto.randomUUID()}@x.test` } as NewAdvertiser)
          .returning({ id: advertisers.id });
        const [c] = await t
          .insert(campaigns)
          .values({ organizationId: orgId, advertiserId: a!.id, name: 'C' } as NewCampaign)
          .returning({ id: campaigns.id });
        return c!.id;
      };
      await body(repo, mkCampaign, t);
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if ((e as Error).message === ROLLBACK) return;
    if (/relation .* does not exist/i.test((e as Error).message)) {
      console.log('Skipping creative.repo DB test: schema not migrated');
      return;
    }
    throw e;
  }
}

describe('CreativeRepository (real-PG)', () => {
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

  test('filters: org / campaign / status + org-scoping isolation', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo, mkCampaign) => {
      const orgA = crypto.randomUUID();
      const orgB = crypto.randomUUID();
      const campA = await mkCampaign(orgA);
      const campB = await mkCampaign(orgB);
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
  });

  test('approveCreative / rejectCreative / pauseCreative transitions', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo, mkCampaign) => {
      const org = crypto.randomUUID();
      const camp = await mkCampaign(org);
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
    });
  });

  test('createReport persists a row; counters reflect total + rolling window', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo, mkCampaign, tx) => {
      const org = crypto.randomUUID();
      const camp = await mkCampaign(org);
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

      // Backdate one report 10 days to test the rolling-window cutoff.
      await tx
        .update(adReports)
        .set({ createdAt: sql`now() - interval '10 days'` })
        .where(sql`${adReports.creativeId} = ${c.id} AND ${adReports.reason} = 'offensive'`);

      expect(await repo.countReportsWithinDays(c.id, 7)).toBe(1); // only the recent one
      expect(await repo.countReportsWithinDays(c.id, 30)).toBe(2); // both inside window
      // unknown creative → 0 (?? fallback branch)
      expect(await repo.countReports(crypto.randomUUID())).toBe(0);
    });
  });
});
