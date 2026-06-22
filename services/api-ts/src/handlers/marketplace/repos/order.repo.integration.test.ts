/**
 * OrderRepository — real-Postgres integration coverage (createScratch harness).
 *
 * Exercises filter branches (org, buyer, vendor, listing, status),
 * org-scoping isolation, and the fulfill/cancel state transitions against an
 * isolated scratch schema (`LIKE public.* INCLUDING ALL`). FKs dropped by LIKE,
 * so vendor/listing/order rows seed directly.
 *
 * Migrated (W3 marketplace S1) off the transaction-rollback-on-`public` harness
 * + the cache-busted prototype-restoration machinery — createScratch isolates
 * the schema, so no restoration is needed.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { OrderRepository } from './order.repo';
import { ListingRepository } from './listing.repo';
import { VendorRepository } from './vendor.repo';
import type {
  NewMarketplaceListing,
  NewMarketplaceOrder,
  NewVendor,
} from './marketplace.schema';

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
function newListing(orgId: string, vendorId: string): NewMarketplaceListing {
  return {
    organizationId: orgId,
    vendorId,
    title: 'L',
    description: 'd',
    price: '10.00',
    status: 'active',
  } as NewMarketplaceListing;
}
function newOrder(
  orgId: string,
  listingId: string,
  vendorId: string,
  overrides: Partial<NewMarketplaceOrder> = {},
): NewMarketplaceOrder {
  return {
    organizationId: orgId,
    listingId,
    vendorId,
    buyerPersonId: crypto.randomUUID(),
    quantity: 1,
    totalPrice: '10.00',
    status: 'pending',
    ...overrides,
  } as NewMarketplaceOrder;
}

describe('OrderRepository (real-PG / createScratch)', () => {
  test('filters: org / buyer / vendor / listing / status + org-scoping isolation', async () => {
    if (!H.dbReachable) return;
    const or = new OrderRepository(H.db as never);
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vA = await vr.createOne(newVendor(orgA));
    const vB = await vr.createOne(newVendor(orgB));
    const lA = await lr.createOne(newListing(orgA, vA.id));
    const lB = await lr.createOne(newListing(orgB, vB.id));
    const buyer = crypto.randomUUID();
    await or.createOne(newOrder(orgA, lA.id, vA.id, { buyerPersonId: buyer, status: 'pending' }));
    await or.createOne(newOrder(orgA, lA.id, vA.id, { status: 'confirmed' }));
    await or.createOne(newOrder(orgB, lB.id, vB.id)); // foreign org

    expect(await or.findMany()).not.toBeUndefined(); // undefined-filter branch

    const orgAList = await or.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((o) => o.organizationId === orgA)).toBe(true);
    expect(orgAList.some((o) => o.organizationId === orgB)).toBe(false);

    expect((await or.findMany({ buyerPersonId: buyer })).length).toBe(1);
    expect((await or.findMany({ vendorId: vA.id })).length).toBe(2);
    expect((await or.findMany({ listingId: lA.id })).length).toBe(2);
    expect((await or.findMany({ organizationId: orgA, status: 'confirmed' })).length).toBe(1);
  });

  test('fulfillOrder sets status=fulfilled + fulfilledAt + updatedBy', async () => {
    if (!H.dbReachable) return;
    const or = new OrderRepository(H.db as never);
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await vr.createOne(newVendor(org));
    const l = await lr.createOne(newListing(org, v.id));
    const o = await or.createOne(newOrder(org, l.id, v.id, { status: 'confirmed' }));
    const updatedBy = crypto.randomUUID();
    const fulfilled = await or.fulfillOrder(o.id, updatedBy);
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.fulfilledAt).not.toBeNull();
    expect(fulfilled.updatedBy).toBe(updatedBy);

    const { rows } = await H.scopedPool.query(
      `SELECT status, fulfilled_at, updated_by FROM "${H.schema}".marketplace_order WHERE id = $1`,
      [o.id],
    );
    expect(rows[0].status).toBe('fulfilled');
    expect(rows[0].fulfilled_at).not.toBeNull();
    expect(rows[0].updated_by).toBe(updatedBy);
  });

  test('cancelOrder sets status=cancelled', async () => {
    if (!H.dbReachable) return;
    const or = new OrderRepository(H.db as never);
    const lr = new ListingRepository(H.db as never);
    const vr = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await vr.createOne(newVendor(org));
    const l = await lr.createOne(newListing(org, v.id));
    const o = await or.createOne(newOrder(org, l.id, v.id, { status: 'pending' }));
    const cancelled = await or.cancelOrder(o.id, crypto.randomUUID());
    expect(cancelled.status).toBe('cancelled');

    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".marketplace_order WHERE id = $1`,
      [o.id],
    );
    expect(rows[0].status).toBe('cancelled');
  });
});
