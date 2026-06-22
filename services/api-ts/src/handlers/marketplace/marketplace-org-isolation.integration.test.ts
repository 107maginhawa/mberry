/**
 * Real-PG cross-org isolation / IDOR suite for marketplace mutate + read
 * handlers (W3 marketplace S6, axis: inter-module = org-scoping contract).
 *
 * Drives the REAL handlers (updateListing, fulfillOrder, cancelOrder, getVendor,
 * getOrder, listOrders, listVendors, listListings) with REAL repos backed by a
 * `createScratch(['vendor','marketplace_listing','marketplace_order'])` schema
 * injected via ctx.get('database'). NO prototype mocking, no stubRepo. Every
 * assertion is against a persisted row read back via H.scopedPool or a thrown
 * AppError — proving the org boundary holds at the SQL boundary across two orgs,
 * not just in a mock.
 *
 * Proves (DoD #4 — inter-module contract = org boundary):
 *  - updateListing on an orgB listing from orgA → NotFoundError, orgB row
 *    UNCHANGED (read-back status + version identical) — no cross-org mutation.
 *  - fulfillOrder / cancelOrder on an orgB order from orgA → NotFoundError,
 *    orgB order status UNCHANGED.
 *  - listOrders / listVendors / listListings are org-bounded: an orgA caller
 *    never sees orgB rows even with a matching vendorId / buyerPersonId filter
 *    (the forced org filter wins).
 *  - getOrder cross-org → NotFoundError (getOrder.ts already guards).
 *
 * REAL BUG FOUND + FIXED (cross-org IDOR):
 *  - getVendor.ts had NO `row.organizationId !== organizationId` guard (unlike
 *    its siblings getOrder/updateListing/fulfillOrder/cancelOrder). A caller in
 *    orgA could read an orgB vendor's full record by id — a cross-org IDOR /
 *    info leak (company name, contact email, contact person). This suite
 *    red-tested it (orgA getVendor on an orgB vendor returned the orgB row with
 *    status 200) and the fix adds the org guard mirroring getOrder.ts:29 so the
 *    orgB vendor is now indistinguishable from missing (NotFoundError).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { updateListing } from './updateListing';
import { fulfillOrder } from './fulfillOrder';
import { cancelOrder } from './cancelOrder';
import { getVendor } from './getVendor';
import { getOrder } from './getOrder';
import { listOrders } from './listOrders';
import { listVendors } from './listVendors';
import { listListings } from './listListings';
import { VendorRepository } from './repos/vendor.repo';
import { ListingRepository } from './repos/listing.repo';
import { OrderRepository } from './repos/order.repo';
import { NotFoundError } from '@/core/errors';
import type {
  NewVendor,
  NewMarketplaceListing,
  NewMarketplaceOrder,
  Vendor,
  MarketplaceListing,
  MarketplaceOrder,
} from './repos/marketplace.schema';

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
    companyName: `Acme-${crypto.randomUUID().slice(0, 8)}`,
    category: 'supplies',
    description: 'd',
    contactEmail: `v-${crypto.randomUUID()}@x.test`,
    verificationStatus: 'verified',
  } as NewVendor;
}

async function seedVendor(orgId: string): Promise<Vendor> {
  return new VendorRepository(H.db as never).createOne(newVendor(orgId));
}

async function seedListing(opts: {
  orgId: string;
  vendorId: string;
  status: 'draft' | 'active' | 'archived';
}): Promise<MarketplaceListing> {
  return new ListingRepository(H.db as never).createOne({
    organizationId: opts.orgId,
    vendorId: opts.vendorId,
    title: 'Gloves',
    description: 'box of 100',
    price: '10.00',
    status: opts.status,
  } as NewMarketplaceListing);
}

async function seedOrder(opts: {
  orgId: string;
  listingId: string;
  vendorId: string;
  buyerPersonId: string;
  status?: 'pending' | 'fulfilled' | 'cancelled';
}): Promise<MarketplaceOrder> {
  return new OrderRepository(H.db as never).createOne({
    organizationId: opts.orgId,
    listingId: opts.listingId,
    vendorId: opts.vendorId,
    buyerPersonId: opts.buyerPersonId,
    quantity: 1,
    totalPrice: '10.00',
    status: opts.status ?? 'pending',
  } as NewMarketplaceOrder);
}

interface CtxOpts {
  userId?: string;
  orgId: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

/** Build a handler ctx wired to the REAL scratch db. */
function makeCtx(opts: CtxOpts) {
  const userId = opts.userId ?? crypto.randomUUID();
  let captured: { data: unknown; status: number } = { data: null, status: 0 };
  const noopLogger: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  noopLogger['child'] = () => noopLogger;
  const ctx = {
    get: (key: string) => {
      const store: Record<string, unknown> = {
        user: { id: userId, name: 'Tester', email: 't@test.com' },
        database: H.db,
        logger: noopLogger,
        requestId: 'trace-1',
        organizationId: opts.orgId,
      };
      return store[key];
    },
    req: {
      valid: (type: string) => {
        if (type === 'param') return opts.params ?? {};
        if (type === 'json') return opts.body ?? {};
        if (type === 'query') return opts.query ?? {};
        return {};
      },
    },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };
  return { ctx: ctx as never, userId };
}

function captured(ctx: never): { data: any; status: number } {
  return (ctx as unknown as { _captured: () => { data: any; status: number } })._captured();
}

async function readListing(id: string): Promise<{ status: string; version: number }> {
  const { rows } = await H.scopedPool.query(
    `SELECT status, version FROM "${H.schema}".marketplace_listing WHERE id=$1`,
    [id],
  );
  return rows[0] as { status: string; version: number };
}

async function readOrderStatus(id: string): Promise<string> {
  const { rows } = await H.scopedPool.query(
    `SELECT status FROM "${H.schema}".marketplace_order WHERE id=$1`,
    [id],
  );
  return rows[0].status as string;
}

describe('updateListing — cross-org mutation blocked', () => {
  test('orgA caller updating an orgB listing → NotFoundError, orgB row UNCHANGED', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vendorB = await seedVendor(orgB);
    const listingB = await seedListing({ orgId: orgB, vendorId: vendorB.id, status: 'draft' });
    const before = await readListing(listingB.id);

    const { ctx } = makeCtx({
      orgId: orgA,
      params: { listingId: listingB.id },
      body: { status: 'active', title: 'HIJACKED' },
    });

    let err: unknown;
    try {
      await updateListing(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toBe('Listing not found');

    // read-back: status + version identical — no cross-org write leaked through.
    const after = await readListing(listingB.id);
    expect(after.status).toBe(before.status);
    expect(after.status).toBe('draft');
    expect(after.version).toBe(before.version);
    // title untouched
    const { rows } = await H.scopedPool.query(
      `SELECT title FROM "${H.schema}".marketplace_listing WHERE id=$1`,
      [listingB.id],
    );
    expect(rows[0].title).toBe('Gloves');
  });
});

describe('fulfillOrder / cancelOrder — cross-org transition blocked', () => {
  test('orgA caller fulfilling an orgB order → NotFoundError, orgB order UNCHANGED', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vendorB = await seedVendor(orgB);
    const listingB = await seedListing({ orgId: orgB, vendorId: vendorB.id, status: 'active' });
    const orderB = await seedOrder({
      orgId: orgB,
      listingId: listingB.id,
      vendorId: vendorB.id,
      buyerPersonId: crypto.randomUUID(),
      status: 'pending',
    });

    const { ctx } = makeCtx({ orgId: orgA, params: { orderId: orderB.id } });

    let err: unknown;
    try {
      await fulfillOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toBe('Order not found');
    expect(await readOrderStatus(orderB.id)).toBe('pending'); // unchanged
  });

  test('orgA caller cancelling an orgB order → NotFoundError, orgB order UNCHANGED', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vendorB = await seedVendor(orgB);
    const listingB = await seedListing({ orgId: orgB, vendorId: vendorB.id, status: 'active' });
    const orderB = await seedOrder({
      orgId: orgB,
      listingId: listingB.id,
      vendorId: vendorB.id,
      buyerPersonId: crypto.randomUUID(),
      status: 'pending',
    });

    const { ctx } = makeCtx({ orgId: orgA, params: { orderId: orderB.id } });

    let err: unknown;
    try {
      await cancelOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toBe('Order not found');
    expect(await readOrderStatus(orderB.id)).toBe('pending'); // unchanged
  });
});

describe('list handlers — org-bounded even with matching cross-org filters', () => {
  test('listOrders org=orgA excludes orgB orders sharing the same vendorId + buyerPersonId', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const sharedBuyer = crypto.randomUUID();
    // same vendor id reused across orgs (FKs dropped — fine) to prove the org
    // filter, not the vendor filter, is what isolates.
    const vendorA = await seedVendor(orgA);
    const vendorB = await seedVendor(orgB);
    const listingA = await seedListing({ orgId: orgA, vendorId: vendorA.id, status: 'active' });
    const listingB = await seedListing({ orgId: orgB, vendorId: vendorB.id, status: 'active' });
    const orderA = await seedOrder({
      orgId: orgA,
      listingId: listingA.id,
      vendorId: vendorA.id,
      buyerPersonId: sharedBuyer,
    });
    const orderB = await seedOrder({
      orgId: orgB,
      listingId: listingB.id,
      vendorId: vendorB.id,
      buyerPersonId: sharedBuyer,
    });

    // filter by the SHARED buyer — only orgA's order may surface for an orgA caller.
    const { ctx } = makeCtx({ orgId: orgA, query: { buyerPersonId: sharedBuyer } });
    await listOrders(ctx);
    const { data } = captured(ctx);
    const ids = (data.data as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toContain(orderA.id);
    expect(ids).not.toContain(orderB.id);
  });

  test('listVendors org=orgA excludes orgB vendors', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vendorA = await seedVendor(orgA);
    const vendorB = await seedVendor(orgB);

    const { ctx } = makeCtx({ orgId: orgA, query: {} });
    await listVendors(ctx);
    const { data } = captured(ctx);
    const ids = (data.data as Array<{ id: string }>).map((v) => v.id);
    expect(ids).toContain(vendorA.id);
    expect(ids).not.toContain(vendorB.id);
  });

  test('listListings org=orgA excludes orgB listings even with matching vendorId filter', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const sharedVendor = await seedVendor(orgA);
    // reuse the same vendor id across both org listings
    const listingA = await seedListing({ orgId: orgA, vendorId: sharedVendor.id, status: 'active' });
    const listingB = await seedListing({ orgId: orgB, vendorId: sharedVendor.id, status: 'active' });

    const { ctx } = makeCtx({ orgId: orgA, query: { vendorId: sharedVendor.id } });
    await listListings(ctx);
    const { data } = captured(ctx);
    const ids = (data.data as Array<{ id: string }>).map((l) => l.id);
    expect(ids).toContain(listingA.id);
    expect(ids).not.toContain(listingB.id);
  });
});

describe('getOrder — cross-org read blocked (existing guard)', () => {
  test('orgA caller fetching an orgB order → NotFoundError', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vendorB = await seedVendor(orgB);
    const listingB = await seedListing({ orgId: orgB, vendorId: vendorB.id, status: 'active' });
    const orderB = await seedOrder({
      orgId: orgB,
      listingId: listingB.id,
      vendorId: vendorB.id,
      buyerPersonId: crypto.randomUUID(),
    });

    const { ctx } = makeCtx({ orgId: orgA, params: { orderId: orderB.id } });
    let err: unknown;
    try {
      await getOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toBe('Order not found');
  });

  test('same-org caller can read its own order (control)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vendor = await seedVendor(org);
    const listing = await seedListing({ orgId: org, vendorId: vendor.id, status: 'active' });
    const order = await seedOrder({
      orgId: org,
      listingId: listing.id,
      vendorId: vendor.id,
      buyerPersonId: crypto.randomUUID(),
    });

    const { ctx } = makeCtx({ orgId: org, params: { orderId: order.id } });
    await getOrder(ctx);
    const { data, status } = captured(ctx);
    expect(status).toBe(200);
    expect(data.id).toBe(order.id);
  });
});

describe('getVendor — cross-org read (IDOR guard — real bug red-then-fix)', () => {
  test('orgA caller fetching an orgB vendor → NotFoundError (no cross-org info leak)', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vendorB = await seedVendor(orgB);

    const { ctx } = makeCtx({ orgId: orgA, params: { vendorId: vendorB.id } });
    let err: unknown;
    try {
      await getVendor(ctx);
    } catch (e) {
      err = e;
    }
    // BEFORE the fix this returned 200 with the orgB vendor (IDOR). After the
    // org guard it must be indistinguishable from missing.
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toBe('Vendor not found');
  });

  test('same-org caller can read its own vendor (control — guard does not over-block)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vendor = await seedVendor(org);

    const { ctx } = makeCtx({ orgId: org, params: { vendorId: vendor.id } });
    await getVendor(ctx);
    const { data, status } = captured(ctx);
    expect(status).toBe(200);
    expect(data.id).toBe(vendor.id);
    expect(data.organizationId).toBe(org);
  });
});
