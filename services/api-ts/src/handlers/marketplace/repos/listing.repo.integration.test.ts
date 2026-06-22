/**
 * ListingRepository — real-Postgres integration coverage (createScratch harness).
 *
 * Exercises filter branches (org, vendor, status, categoryTag JSONB @>),
 * org-scoping isolation, listing lifecycle (draft→active→archived via
 * updateOneById), and findActiveListingsByVendor against an isolated scratch
 * schema (`LIKE public.* INCLUDING ALL`). FKs dropped by LIKE, so vendor/listing
 * rows seed directly.
 *
 * Migrated (W3 marketplace S1) off the transaction-rollback-on-`public` harness
 * + the prototype-snapshot restoration machinery — createScratch isolates the
 * schema, so no restoration is needed.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { ListingRepository } from './listing.repo';
import { VendorRepository } from './vendor.repo';
import type { NewMarketplaceListing, NewVendor } from './marketplace.schema';

let H: ScratchDb;
beforeAll(async () => {
  H = await createScratch(['vendor', 'marketplace_listing', 'marketplace_order']);
});
afterAll(async () => {
  await H?.teardown();
});

function newVendor(orgId: string): NewVendor {
  return {
    organizationId: orgId,
    companyName: 'V',
    category: 'supplies',
    description: 'd',
    contactEmail: `v-${crypto.randomUUID()}@x.test`,
  } as NewVendor;
}

function newListing(
  orgId: string,
  vendorId: string,
  overrides: Partial<NewMarketplaceListing> = {},
): NewMarketplaceListing {
  return {
    organizationId: orgId,
    vendorId,
    title: 'Listing',
    description: 'desc',
    price: '99.99',
    currency: 'USD',
    status: 'draft',
    categoryTags: [],
    ...overrides,
  } as NewMarketplaceListing;
}

describe('ListingRepository (real-PG / createScratch)', () => {
  test('filters: org / vendor / status / categoryTag + org-scoping isolation', async () => {
    if (!H.dbReachable) return;
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vA = await vr.createOne(newVendor(orgA));
    const vB = await vr.createOne(newVendor(orgB));
    await lr.createOne(newListing(orgA, vA.id, { status: 'active', categoryTags: ['gloves', 'ppe'] }));
    await lr.createOne(newListing(orgA, vA.id, { status: 'draft' }));
    await lr.createOne(newListing(orgB, vB.id, { status: 'active' })); // foreign org

    expect(await lr.findMany()).not.toBeUndefined(); // undefined-filter branch

    const orgAList = await lr.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((l) => l.organizationId === orgA)).toBe(true);
    expect(orgAList.some((l) => l.organizationId === orgB)).toBe(false);

    expect((await lr.findMany({ vendorId: vA.id })).length).toBe(2);
    expect((await lr.findMany({ organizationId: orgA, status: 'active' })).length).toBe(1);

    // JSONB containment branch: category_tags @> '["uniqueTag"]' parses on real PG
    const uniqueTag = `tag-${crypto.randomUUID()}`;
    await lr.createOne(newListing(orgA, vA.id, { status: 'active', categoryTags: [uniqueTag] }));
    const tagged = await lr.findMany({ categoryTag: uniqueTag });
    expect(tagged.length).toBe(1);
    expect(tagged[0]!.categoryTags).toContain(uniqueTag);
    expect((await lr.findMany({ categoryTag: `missing-${crypto.randomUUID()}` })).length).toBe(0);
  });

  test('lifecycle: draft → active → archived bumps version (repo writes any status)', async () => {
    if (!H.dbReachable) return;
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await vr.createOne(newVendor(org));
    const l = await lr.createOne(newListing(org, v.id, { status: 'draft' }));
    expect(l.status).toBe('draft');

    const active = await lr.updateOneById(l.id, { status: 'active' });
    expect(active.status).toBe('active');
    const archived = await lr.updateOneById(l.id, { status: 'archived' });
    expect(archived.status).toBe('archived');
    expect(archived.version).toBeGreaterThan(l.version);

    // read-back confirms the row actually holds the terminal status
    const { rows } = await H.scopedPool.query(
      `SELECT status, version FROM "${H.schema}".marketplace_listing WHERE id = $1`,
      [l.id],
    );
    expect(rows[0].status).toBe('archived');
    expect(rows[0].version).toBeGreaterThan(l.version);
  });

  test('findActiveListingsByVendor returns only active for that vendor', async () => {
    if (!H.dbReachable) return;
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await vr.createOne(newVendor(org));
    await lr.createOne(newListing(org, v.id, { status: 'active' }));
    await lr.createOne(newListing(org, v.id, { status: 'active' }));
    await lr.createOne(newListing(org, v.id, { status: 'draft' }));
    const active = await lr.findActiveListingsByVendor(v.id);
    expect(active.length).toBe(2);
    expect(active.every((l) => l.status === 'active' && l.vendorId === v.id)).toBe(true);
  });

  test('repo updateOneById writes ANY status — FSM is handler-only, not repo-enforced (W3 S3)', async () => {
    // Characterization: MARKETPLACE_LISTING_VALID_TRANSITIONS forbids draft→archived
    // (draft only →active). But the base repo updateOneById issues a plain UPDATE
    // with NO transition guard, so it WILL persist the illegal jump. This proves the
    // FSM lives exclusively in the updateListing handler, not at the repo/SQL seam.
    if (!H.dbReachable) return;
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await vr.createOne(newVendor(org));
    const l = await lr.createOne(newListing(org, v.id, { status: 'draft' }));

    // draft → archived is an ILLEGAL FSM edge, yet the repo writes it unguarded
    const jumped = await lr.updateOneById(l.id, { status: 'archived' });
    expect(jumped.status).toBe('archived');
    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".marketplace_listing WHERE id = $1`,
      [l.id],
    );
    expect(rows[0].status).toBe('archived');
  });

  test('enum integrity: raw insert status=bogus → Postgres 22P02 on listing_status (W3 S3)', async () => {
    // The scratch table is LIKE public.marketplace_listing INCLUDING ALL, so the
    // status column carries the real listing_status enum type. A raw insert of an
    // out-of-enum value must be rejected by the live column type (22P02 invalid
    // text representation), not merely by the Drizzle TS type.
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vendorId = crypto.randomUUID();
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".marketplace_listing
           (organization_id, vendor_id, title, description, status)
         VALUES ($1, $2, 'L', 'd', 'bogus')`,
        [org, vendorId],
      );
    } catch (e) {
      code =
        (e as { code?: string; cause?: { code?: string } }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(code).toBe('22P02');
  });
});
