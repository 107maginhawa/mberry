/**
 * OrderRepository — real-Postgres integration coverage.
 *
 * Exercises filter branches (org, buyer, vendor, listing, status),
 * org-scoping isolation, and the fulfill/cancel state transitions.
 * Transaction-rollback harness; skips cleanly without DATABASE_URL.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { OrderRepository } from './order.repo';
import { ListingRepository } from './listing.repo';
import { VendorRepository } from './vendor.repo';
import type {
  NewMarketplaceListing,
  NewMarketplaceOrder,
  NewVendor,
} from './marketplace.schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;
const ROLLBACK = '__order_repo_rollback__';

/**
 * Sibling handler tests mock repo prototype methods and never restore them;
 * bun loads+runs files sequentially so an import-time snapshot would capture
 * the mocks. Fresh-import (cache-busted) the repos in beforeAll to recover
 * pristine implementations, then reinstate them before each test. Order-proof.
 */
const BASE_METHODS = ['createOne', 'findMany', 'findOneById', 'updateOneById'] as const;
let restorePristine: () => void = () => {};
async function capturePristine(): Promise<void> {
  const freshO = await import(`./order.repo?pristine=${Date.now()}`);
  const FreshOrder = freshO.OrderRepository as typeof OrderRepository;
  const freshBase = Object.getPrototypeOf(FreshOrder.prototype);
  restorePristine = () => {
    for (const k of BASE_METHODS) {
      for (const proto of [OrderRepository, ListingRepository, VendorRepository]) {
        delete (proto.prototype as any)[k];
      }
      (DatabaseRepository.prototype as any)[k] = (freshBase as any)[k];
    }
    (OrderRepository.prototype as any).fulfillOrder = FreshOrder.prototype.fulfillOrder;
    (OrderRepository.prototype as any).cancelOrder = FreshOrder.prototype.cancelOrder;
    (OrderRepository.prototype as any).buildWhereConditions = (FreshOrder.prototype as any).buildWhereConditions;
  };
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

async function inTx(
  db: DatabaseInstance,
  body: (or: OrderRepository, lr: ListingRepository, vr: VendorRepository) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await body(
        new OrderRepository(tx as never),
        new ListingRepository(tx as never),
        new VendorRepository(tx as never),
      );
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if ((e as Error).message === ROLLBACK) return;
    if (/relation .* does not exist/i.test((e as Error).message)) {
      console.log('Skipping order.repo DB test: schema not migrated');
      return;
    }
    throw e;
  }
}

describe('OrderRepository (real-PG)', () => {
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

  test('filters: org / buyer / vendor / listing / status + org-scoping isolation', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (or, lr, vr) => {
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

      expect((await or.findMany({ buyerPersonId: buyer })).length).toBe(1);
      expect((await or.findMany({ vendorId: vA.id })).length).toBe(2);
      expect((await or.findMany({ listingId: lA.id })).length).toBe(2);
      expect((await or.findMany({ organizationId: orgA, status: 'confirmed' })).length).toBe(1);
    });
  });

  test('fulfillOrder sets status=fulfilled + fulfilledAt', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (or, lr, vr) => {
      const org = crypto.randomUUID();
      const v = await vr.createOne(newVendor(org));
      const l = await lr.createOne(newListing(org, v.id));
      const o = await or.createOne(newOrder(org, l.id, v.id, { status: 'confirmed' }));
      const updatedBy = crypto.randomUUID();
      const fulfilled = await or.fulfillOrder(o.id, updatedBy);
      expect(fulfilled.status).toBe('fulfilled');
      expect(fulfilled.fulfilledAt).not.toBeNull();
      expect(fulfilled.updatedBy).toBe(updatedBy);
    });
  });

  test('cancelOrder sets status=cancelled', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (or, lr, vr) => {
      const org = crypto.randomUUID();
      const v = await vr.createOne(newVendor(org));
      const l = await lr.createOne(newListing(org, v.id));
      const o = await or.createOne(newOrder(org, l.id, v.id, { status: 'pending' }));
      const cancelled = await or.cancelOrder(o.id, crypto.randomUUID());
      expect(cancelled.status).toBe('cancelled');
    });
  });
});
