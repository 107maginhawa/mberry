/**
 * Real-PG integration suite for the createOrder HANDLER (W3 marketplace S4).
 *
 * Drives the REAL `createOrder` handler with REAL Listing + Order repositories
 * backed by a `createScratch(['vendor','marketplace_listing','marketplace_order'])`
 * schema (injected via ctx.get('database')) — NO prototype mocking, no stubRepo.
 * Every assertion is against a persisted row read back via H.scopedPool, a thrown
 * AppError, or a real Postgres SQLSTATE.
 *
 * Proves the order-placement business rules at the SQL boundary (createOrder.ts):
 *  - happy path: active listing price='99.99' qty=2 → total_price='199.98'
 *    (the (unitPrice*quantity).toFixed(2) math, :53), status='pending' (:64),
 *    buyer_person_id=user.id, vendor_id copied from the listing.
 *  - inactive-listing guard (draft) → BusinessLogicError 'Listing is not active'
 *    (:38) + 0 orders (no order against a non-buyable listing).
 *  - price-less guard (G-11): price=NULL → BusinessLogicError 'Listing has no
 *    price set...' (:46) + 0 orders — proven against a real NULL price column.
 *  - quantity guard: quantity=0 → ValidationError (:43) + 0 orders.
 *    CHARACTERIZATION of a defense-in-depth gap: the DB has NO `quantity >= 1`
 *    CHECK (verified catalog), so a raw insert of quantity=0 via H.scopedPool
 *    SUCCEEDS. The only guard is app-layer. NOT a red-then-fix (adding a CHECK
 *    migration is a product decision; the app guard already protects the real
 *    path). Documented here + in the commit body.
 *  - cross-org IDOR: listing in orgB, ctx organizationId=orgA → NotFoundError
 *    'Listing not found' (:35) + 0 orders — cross-org placement blocked at the
 *    real row level.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { createOrder } from './createOrder';
import { VendorRepository } from './repos/vendor.repo';
import { ListingRepository } from './repos/listing.repo';
import { BusinessLogicError, NotFoundError, ValidationError } from '@/core/errors';
import type {
  NewVendor,
  NewMarketplaceListing,
  MarketplaceListing,
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
    companyName: 'V',
    category: 'supplies',
    description: 'd',
    contactEmail: `v-${crypto.randomUUID()}@x.test`,
    verificationStatus: 'verified',
  } as NewVendor;
}

/** Seed a listing row directly via the REAL repo (FKs are dropped by LIKE). */
async function seedListing(opts: {
  orgId: string;
  vendorId: string;
  status: 'draft' | 'active' | 'archived';
  price: string | null;
}): Promise<MarketplaceListing> {
  const lr = new ListingRepository(H.db as never);
  return lr.createOne({
    organizationId: opts.orgId,
    vendorId: opts.vendorId,
    title: 'Gloves',
    description: 'box of 100',
    price: opts.price,
    status: opts.status,
  } as NewMarketplaceListing);
}

interface OrderBody {
  listingId?: string;
  quantity?: number;
  notes?: string;
}

/**
 * Build a handler ctx wired to the REAL scratch db. `database` returns H.db so the
 * Listing/Order repos constructed inside the handler run real SQL against the
 * isolated schema. Mirrors createListing.integration.test.ts ctx shape but with
 * the keys createOrder reads: user, database, logger, requestId, organizationId.
 */
function makeCtx(opts: { userId?: string; orgId: string; body: OrderBody }) {
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
    req: { valid: () => opts.body },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };
  return { ctx: ctx as never, userId };
}

async function countOrdersForListing(listingId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".marketplace_order WHERE listing_id=$1`,
    [listingId],
  );
  return rows[0].n as number;
}

describe('createOrder handler — happy path (total_price math)', () => {
  test('active listing price=99.99 qty=2 → total_price=199.98, status=pending, buyer/vendor copied', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org));
    const listing = await seedListing({
      orgId: org,
      vendorId: vendor.id,
      status: 'active',
      price: '99.99',
    });

    const { ctx, userId } = makeCtx({
      orgId: org,
      body: { listingId: listing.id, quantity: 2, notes: 'rush' },
    });

    await createOrder(ctx);
    const { data, status } = (
      ctx as unknown as { _captured: () => { data: { id: string }; status: number } }
    )._captured();

    expect(status).toBe(201);
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id, listing_id, buyer_person_id, vendor_id,
              quantity, total_price, status, notes, created_by
         FROM "${H.schema}".marketplace_order WHERE id=$1`,
      [data.id],
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.organization_id).toBe(org);
    expect(r.listing_id).toBe(listing.id);
    expect(r.buyer_person_id).toBe(userId); // buyer = the placing user
    expect(r.vendor_id).toBe(vendor.id); // copied from the listing
    expect(r.quantity).toBe(2);
    expect(r.total_price).toBe('199.98'); // 99.99 * 2, toFixed(2) — numeric round-trips as string
    expect(r.status).toBe('pending'); // handler always seeds pending
    expect(r.notes).toBe('rush');
    expect(r.created_by).toBe(userId);
  });

  test('quantity omitted defaults to 1 → total_price equals unit price', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org));
    const listing = await seedListing({
      orgId: org,
      vendorId: vendor.id,
      status: 'active',
      price: '12.50',
    });

    const { ctx } = makeCtx({ orgId: org, body: { listingId: listing.id } });
    await createOrder(ctx);
    const { data } = (
      ctx as unknown as { _captured: () => { data: { id: string } } }
    )._captured();

    const { rows } = await H.scopedPool.query(
      `SELECT quantity, total_price FROM "${H.schema}".marketplace_order WHERE id=$1`,
      [data.id],
    );
    expect(rows[0].quantity).toBe(1); // DB default / handler default
    expect(rows[0].total_price).toBe('12.50');
  });
});

describe('createOrder handler — inactive-listing guard', () => {
  test('draft listing → BusinessLogicError "Listing is not active", 0 orders', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org));
    const listing = await seedListing({
      orgId: org,
      vendorId: vendor.id,
      status: 'draft',
      price: '50.00',
    });

    const { ctx } = makeCtx({ orgId: org, body: { listingId: listing.id, quantity: 1 } });

    let err: unknown;
    try {
      await createOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as Error).message).toBe('Listing is not active');
    expect(await countOrdersForListing(listing.id)).toBe(0);
  });
});

describe('createOrder handler — price-less guard (G-11)', () => {
  test('active listing with NULL price → BusinessLogicError, 0 orders', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org));
    // price column is genuinely NULLABLE in the live catalog — seed a NULL price.
    const listing = await seedListing({
      orgId: org,
      vendorId: vendor.id,
      status: 'active',
      price: null,
    });
    // sanity: the row truly has a NULL price (proves the nullable column copied by LIKE)
    const { rows: pre } = await H.scopedPool.query(
      `SELECT price FROM "${H.schema}".marketplace_listing WHERE id=$1`,
      [listing.id],
    );
    expect(pre[0].price).toBeNull();

    const { ctx } = makeCtx({ orgId: org, body: { listingId: listing.id, quantity: 1 } });

    let err: unknown;
    try {
      await createOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as Error).message).toBe('Listing has no price set and cannot be ordered');
    expect(await countOrdersForListing(listing.id)).toBe(0);
  });
});

describe('createOrder handler — quantity guard + defense-in-depth gap', () => {
  test('quantity=0 → ValidationError, 0 orders', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org));
    const listing = await seedListing({
      orgId: org,
      vendorId: vendor.id,
      status: 'active',
      price: '99.99',
    });

    const { ctx } = makeCtx({ orgId: org, body: { listingId: listing.id, quantity: 0 } });

    let err: unknown;
    try {
      await createOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toBe('Quantity must be at least 1');
    expect(await countOrdersForListing(listing.id)).toBe(0);
  });

  test('CHARACTERIZATION: no DB CHECK backs quantity>=1 — raw insert quantity=0 SUCCEEDS', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org));
    const listing = await seedListing({
      orgId: org,
      vendorId: vendor.id,
      status: 'active',
      price: '99.99',
    });

    // bypass the app guard — insert quantity=0 directly. The live catalog has NO
    // `quantity >= 1` CHECK (verified), so Postgres accepts the row. Documents the
    // defense-in-depth gap: the only quantity invariant is app-layer (createOrder.ts:43).
    const rawId = crypto.randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".marketplace_order
         (id, organization_id, listing_id, buyer_person_id, vendor_id, quantity, total_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
      [rawId, org, listing.id, crypto.randomUUID(), vendor.id, 0, '0.00'],
    );
    const { rows } = await H.scopedPool.query(
      `SELECT quantity FROM "${H.schema}".marketplace_order WHERE id=$1`,
      [rawId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(0); // accepted: no DB-level guard exists
  });
});

describe('createOrder handler — cross-org IDOR', () => {
  test('listing in orgB, ctx organizationId=orgA → NotFoundError, 0 orders', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendorB = await vr.createOne(newVendor(orgB));
    const listingB = await seedListing({
      orgId: orgB,
      vendorId: vendorB.id,
      status: 'active',
      price: '99.99',
    });

    // caller is in orgA — the orgB listing must be indistinguishable from missing.
    const { ctx } = makeCtx({ orgId: orgA, body: { listingId: listingB.id, quantity: 1 } });

    let err: unknown;
    try {
      await createOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toBe('Listing not found');
    expect(await countOrdersForListing(listingB.id)).toBe(0);
  });
});
