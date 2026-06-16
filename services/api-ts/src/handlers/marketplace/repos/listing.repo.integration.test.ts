/**
 * ListingRepository — real-Postgres integration coverage.
 *
 * Exercises filter branches (org, vendor, status, categoryTag JSONB @>),
 * org-scoping isolation, listing lifecycle (draft→active→archived via
 * updateOneById), and findActiveListingsByVendor. Transaction-rollback
 * harness; skips cleanly without DATABASE_URL / unmigrated schema.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { ListingRepository } from './listing.repo';
import { VendorRepository } from './vendor.repo';
import type { NewMarketplaceListing, NewVendor } from './marketplace.schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;
const ROLLBACK = '__listing_repo_rollback__';

/**
 * Listing handler tests (updateListing) run AFTER this file in path-sort order,
 * so the Listing prototype is pristine at import. Vendor is never mocked by any
 * earlier-sorting sibling either. Snapshot both from the LIVE modules (not a
 * cache-busted fresh import) so coverage stays attributed to the real source
 * files; reinstate before each test as a defensive measure.
 */
const PRISTINE_BASE = {
  createOne: DatabaseRepository.prototype.createOne,
  findMany: DatabaseRepository.prototype.findMany,
  findOne: DatabaseRepository.prototype.findOne,
  findOneById: DatabaseRepository.prototype.findOneById,
  updateOneById: DatabaseRepository.prototype.updateOneById,
};
const PRISTINE_LISTING = {
  findActiveListingsByVendor: ListingRepository.prototype.findActiveListingsByVendor,
  buildWhereConditions: (ListingRepository.prototype as any).buildWhereConditions,
};
const PRISTINE_VENDOR = {
  buildWhereConditions: (VendorRepository.prototype as any).buildWhereConditions,
};
function capturePristine(): void {}
function restorePristine(): void {
  for (const [k, v] of Object.entries(PRISTINE_BASE)) {
    delete (ListingRepository.prototype as any)[k];
    delete (VendorRepository.prototype as any)[k];
    (DatabaseRepository.prototype as any)[k] = v;
  }
  for (const [k, v] of Object.entries(PRISTINE_LISTING)) (ListingRepository.prototype as any)[k] = v;
  for (const [k, v] of Object.entries(PRISTINE_VENDOR)) (VendorRepository.prototype as any)[k] = v;
}

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

async function inTx(
  db: DatabaseInstance,
  body: (lr: ListingRepository, vr: VendorRepository) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await body(new ListingRepository(tx as never), new VendorRepository(tx as never));
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if ((e as Error).message === ROLLBACK) return;
    if (/relation .* does not exist/i.test((e as Error).message)) {
      console.log('Skipping listing.repo DB test: schema not migrated');
      return;
    }
    throw e;
  }
}

describe('ListingRepository (real-PG)', () => {
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

  test('filters: org / vendor / status / categoryTag + org-scoping isolation', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (lr, vr) => {
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

      expect((await lr.findMany({ vendorId: vA.id })).length).toBe(2);
      expect((await lr.findMany({ organizationId: orgA, status: 'active' })).length).toBe(1);
      // JSONB containment branch (org-scoped — residue rows may share the tag)
      const uniqueTag = `tag-${crypto.randomUUID()}`;
      await lr.createOne(newListing(orgA, vA.id, { status: 'active', categoryTags: [uniqueTag] }));
      expect((await lr.findMany({ categoryTag: uniqueTag })).length).toBe(1);
      expect((await lr.findMany({ categoryTag: `missing-${crypto.randomUUID()}` })).length).toBe(0);
    });
  });

  test('lifecycle: draft → active → archived', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (lr, vr) => {
      const org = crypto.randomUUID();
      const v = await vr.createOne(newVendor(org));
      const l = await lr.createOne(newListing(org, v.id, { status: 'draft' }));
      expect(l.status).toBe('draft');
      const active = await lr.updateOneById(l.id, { status: 'active' });
      expect(active.status).toBe('active');
      const archived = await lr.updateOneById(l.id, { status: 'archived' });
      expect(archived.status).toBe('archived');
      expect(archived.version).toBeGreaterThan(l.version);
    });
  });

  test('findActiveListingsByVendor returns only active for that vendor', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (lr, vr) => {
      const org = crypto.randomUUID();
      const v = await vr.createOne(newVendor(org));
      await lr.createOne(newListing(org, v.id, { status: 'active' }));
      await lr.createOne(newListing(org, v.id, { status: 'active' }));
      await lr.createOne(newListing(org, v.id, { status: 'draft' }));
      const active = await lr.findActiveListingsByVendor(v.id);
      expect(active.length).toBe(2);
      expect(active.every((l) => l.status === 'active' && l.vendorId === v.id)).toBe(true);
    });
  });
});
