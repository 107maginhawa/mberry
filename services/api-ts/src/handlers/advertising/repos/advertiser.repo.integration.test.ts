/**
 * AdvertiserRepository — real-Postgres integration coverage (NEW; this repo had zero).
 *
 * Stands up the shared advertising scratch harness via `createScratch`
 * (LIKE public.<t> INCLUDING ALL — faithful nullability/defaults/CHECKs; FKs dropped),
 * and exports the local seed fixture (seedAdvertiser/seedCampaign/seedCreative) that
 * the migrated campaign/creative suites (Slice 2) import instead of re-hand-rolling INSERTs.
 *
 * Asserts real persisted rows / raw SQLSTATE codes — no shared-public rollback, no
 * prototype-restore hack (the isolated schema + per-schema pool removes the cross-file
 * mock() pollution the old suites worked around).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { AdvertiserRepository } from './advertiser.repo';
import type { NewAdvertiser } from './advertising.schema';

export const ADVERTISING_TABLES = [
  'advertiser',
  'ad_campaign',
  'ad_creative',
  'member_ad_opt_out',
  'ad_report',
] as const;

/** Insert an advertiser directly (FKs dropped by LIKE — no parent needed). Returns the row id. */
export async function seedAdvertiser(
  H: ScratchDb,
  orgId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const companyName = (overrides['companyName'] as string) ?? 'Adv Co';
  const contactEmail = (overrides['contactEmail'] as string) ?? `adv-${crypto.randomUUID()}@x.test`;
  const isActive = overrides['isActive'] === undefined ? true : (overrides['isActive'] as boolean);
  const { rows } = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".advertiser (organization_id, company_name, contact_email, is_active)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [orgId, companyName, contactEmail, isActive],
  );
  return rows[0].id as string;
}

/** Insert a campaign directly. Returns the row id. */
export async function seedCampaign(
  H: ScratchDb,
  orgId: string,
  advertiserId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const name = (overrides['name'] as string) ?? 'Campaign';
  const status = (overrides['status'] as string) ?? 'draft';
  const adSlot = (overrides['adSlot'] as string) ?? 'feed_banner';
  const startsAt = (overrides['startsAt'] as Date | null) ?? null;
  const endsAt = (overrides['endsAt'] as Date | null) ?? null;
  const { rows } = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".ad_campaign
       (organization_id, advertiser_id, name, status, ad_slot, budget_cents, spent_cents, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [orgId, advertiserId, name, status, adSlot, 1000, 0, startsAt, endsAt],
  );
  return rows[0].id as string;
}

/** Insert a creative directly. Returns the row id. */
export async function seedCreative(
  H: ScratchDb,
  orgId: string,
  campaignId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const title = (overrides['title'] as string) ?? 'Creative';
  const bodyText = (overrides['bodyText'] as string) ?? 'Body';
  const status = (overrides['status'] as string) ?? 'pending';
  const sponsoredLabel =
    overrides['sponsoredLabel'] === undefined ? true : (overrides['sponsoredLabel'] as boolean);
  const createdBy = (overrides['createdBy'] as string | null) ?? null;
  const { rows } = await H.scopedPool.query(
    `INSERT INTO "${H.schema}".ad_creative
       (organization_id, campaign_id, title, body_text, status, sponsored_label, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [orgId, campaignId, title, bodyText, status, sponsoredLabel, createdBy],
  );
  return rows[0].id as string;
}

function pgCode(e: unknown): string | undefined {
  return (
    (e as { code?: string }).code ??
    (e as { cause?: { code?: string } }).cause?.code
  );
}

describe('AdvertiserRepository (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch([...ADVERTISING_TABLES]);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  test('createOne persists advertiser; is_active defaults true, version=1', async () => {
    if (!H.dbReachable) return;
    const repo = new AdvertiserRepository(H.db as never);
    const orgId = crypto.randomUUID();
    const email = `adv-${crypto.randomUUID()}@x.test`;
    const created = await repo.createOne({
      organizationId: orgId,
      companyName: 'Acme Health',
      contactEmail: email,
    } as NewAdvertiser);

    const { rows } = await H.scopedPool.query(
      `SELECT organization_id, company_name, contact_email, is_active, version
         FROM "${H.schema}".advertiser WHERE id=$1`,
      [created.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].organization_id).toBe(orgId);
    expect(rows[0].company_name).toBe('Acme Health');
    expect(rows[0].contact_email).toBe(email);
    expect(rows[0].is_active).toBe(true);
    expect(rows[0].version).toBe(1);
  });

  test('buildWhereConditions: org-scoping + isActive filter + undefined-filter branch', async () => {
    if (!H.dbReachable) return;
    const repo = new AdvertiserRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    await seedAdvertiser(H, orgA, { isActive: true });
    await seedAdvertiser(H, orgA, { isActive: false });
    await seedAdvertiser(H, orgB, { isActive: true });

    const orgAList = await repo.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((a) => a.organizationId === orgA)).toBe(true);

    const orgAActive = await repo.findMany({ organizationId: orgA, isActive: true });
    expect(orgAActive.length).toBe(1);
    expect(orgAActive[0]!.isActive).toBe(true);
    expect(orgAActive[0]!.organizationId).toBe(orgA);

    // undefined-filter branch returns every row unfiltered — assert it matches the
    // raw table count (isolated schema; includes the 3 seeded here + any from sibling
    // tests sharing this describe's scratch, never cross-org leakage from public).
    const { rows: cnt } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".advertiser`,
    );
    const all = await repo.findMany();
    expect(all.length).toBe(cnt[0].n);
    // and it definitely contains both orgs (no org filter applied)
    expect(all.some((a) => a.organizationId === orgA)).toBe(true);
    expect(all.some((a) => a.organizationId === orgB)).toBe(true);
  });

  test('NOT NULL invariant: missing organization_id → SQLSTATE 23502', async () => {
    if (!H.dbReachable) return;
    const repo = new AdvertiserRepository(H.db as never);
    let code: string | undefined;
    try {
      await repo.createOne({
        companyName: 'No Org',
        contactEmail: `no-org-${crypto.randomUUID()}@x.test`,
      } as unknown as NewAdvertiser);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('NOT NULL invariant: missing company_name → SQLSTATE 23502', async () => {
    if (!H.dbReachable) return;
    const repo = new AdvertiserRepository(H.db as never);
    let code: string | undefined;
    try {
      await repo.createOne({
        organizationId: crypto.randomUUID(),
        contactEmail: `no-name-${crypto.randomUUID()}@x.test`,
      } as unknown as NewAdvertiser);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('NOT NULL invariant: missing contact_email → SQLSTATE 23502', async () => {
    if (!H.dbReachable) return;
    const repo = new AdvertiserRepository(H.db as never);
    let code: string | undefined;
    try {
      await repo.createOne({
        organizationId: crypto.randomUUID(),
        companyName: 'No Email',
      } as unknown as NewAdvertiser);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('FK cascade characterization: DELETE advertiser removes child campaign + creative', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const advId = await seedAdvertiser(H, org);
    const campId = await seedCampaign(H, org, advId, { status: 'active' });
    const creativeId = await seedCreative(H, org, campId, { status: 'approved' });

    // Reproduce the live ON DELETE CASCADE chain (FKs are dropped by LIKE, so
    // re-establish them on the scratch tables to characterize the declared cascade).
    await H.scopedPool.query(
      `ALTER TABLE "${H.schema}".ad_campaign
         ADD CONSTRAINT scratch_camp_adv_fk FOREIGN KEY (advertiser_id)
         REFERENCES "${H.schema}".advertiser(id) ON DELETE CASCADE`,
    );
    await H.scopedPool.query(
      `ALTER TABLE "${H.schema}".ad_creative
         ADD CONSTRAINT scratch_creative_camp_fk FOREIGN KEY (campaign_id)
         REFERENCES "${H.schema}".ad_campaign(id) ON DELETE CASCADE`,
    );

    await H.scopedPool.query(`DELETE FROM "${H.schema}".advertiser WHERE id=$1`, [advId]);

    const camp = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".ad_campaign WHERE id=$1`,
      [campId],
    );
    const creative = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(camp.rows.length).toBe(0);
    expect(creative.rows.length).toBe(0);
  });
});
