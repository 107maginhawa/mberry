/**
 * Real-PG integration suite for the order STATE MACHINE at the handler boundary
 * (W3 marketplace S5).
 *
 * Drives the REAL `fulfillOrder` / `cancelOrder` handlers with REAL repos backed
 * by a `createScratch(['vendor','marketplace_listing','marketplace_order'])` schema
 * (injected via ctx.get('database')) — NO prototype mocking, no stubRepo. Every
 * assertion is against a persisted row read back via H.scopedPool or a thrown
 * AppError.
 *
 * Proves MARKETPLACE_ORDER_VALID_TRANSITIONS enforcement (assertValidTransition)
 * lives in the handler:
 *  - fulfillOrder(pending) → status='fulfilled', fulfilled_at IS NOT NULL,
 *    updated_by=user.id (read-back). fulfillOrder(cancelled) → ConflictError
 *    (cancelled is terminal — no →fulfilled edge).
 *  - cancelOrder(pending) → status='cancelled'. cancelOrder(fulfilled) →
 *    ConflictError (fulfilled has no →cancelled edge; only →refunded).
 *
 * Dead-state contract (confirmed/refunded) is characterized in the repo suite
 * (order.repo.integration.test.ts): no handler produces them.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { fulfillOrder } from './fulfillOrder';
import { cancelOrder } from './cancelOrder';
import { VendorRepository } from './repos/vendor.repo';
import { ListingRepository } from './repos/listing.repo';
import { OrderRepository } from './repos/order.repo';
import { ConflictError } from '@/core/errors';
import type {
  NewVendor,
  NewMarketplaceListing,
  NewMarketplaceOrder,
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
    companyName: 'V',
    category: 'supplies',
    description: 'd',
    contactEmail: `v-${crypto.randomUUID()}@x.test`,
    verificationStatus: 'verified',
  } as NewVendor;
}

/** Seed an order row in a chosen status directly via the REAL repo (FKs dropped by LIKE). */
async function seedOrder(opts: {
  orgId: string;
  status: MarketplaceOrder['status'];
}): Promise<{ order: MarketplaceOrder; vendorId: string }> {
  const vr = new VendorRepository(H.db as never);
  const lr = new ListingRepository(H.db as never);
  const or = new OrderRepository(H.db as never);
  const vendor = await vr.createOne(newVendor(opts.orgId));
  const listing = await lr.createOne({
    organizationId: opts.orgId,
    vendorId: vendor.id,
    title: 'L',
    description: 'd',
    price: '10.00',
    status: 'active',
  } as NewMarketplaceListing);
  const order = await or.createOne({
    organizationId: opts.orgId,
    listingId: listing.id,
    vendorId: vendor.id,
    buyerPersonId: crypto.randomUUID(),
    quantity: 1,
    totalPrice: '10.00',
    status: opts.status,
  } as NewMarketplaceOrder);
  return { order, vendorId: vendor.id };
}

/**
 * Build a handler ctx wired to the REAL scratch db. fulfillOrder/cancelOrder read
 * the orderId from ctx.req.valid('param'), plus user/database/logger/requestId/
 * organizationId from ctx.get. Mirrors createOrder.integration.test.ts ctx shape.
 */
function makeCtx(opts: { userId?: string; orgId: string; orderId: string }) {
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
    req: { valid: () => ({ orderId: opts.orderId }) },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };
  return { ctx: ctx as never, userId };
}

async function readStatus(orderId: string): Promise<{ status: string; fulfilledAt: unknown; updatedBy: string | null }> {
  const { rows } = await H.scopedPool.query(
    `SELECT status, fulfilled_at, updated_by FROM "${H.schema}".marketplace_order WHERE id=$1`,
    [orderId],
  );
  return { status: rows[0].status, fulfilledAt: rows[0].fulfilled_at, updatedBy: rows[0].updated_by };
}

describe('fulfillOrder handler — pending → fulfilled', () => {
  test('pending order → status=fulfilled, fulfilled_at stamped, updated_by=user.id (read-back)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const { order } = await seedOrder({ orgId: org, status: 'pending' });

    const { ctx, userId } = makeCtx({ orgId: org, orderId: order.id });
    await fulfillOrder(ctx);
    const { status } = (
      ctx as unknown as { _captured: () => { status: number } }
    )._captured();
    expect(status).toBe(200);

    const row = await readStatus(order.id);
    expect(row.status).toBe('fulfilled');
    expect(row.fulfilledAt).not.toBeNull();
    expect(row.updatedBy).toBe(userId); // stamped from the acting user
  });

  test('cancelled order → ConflictError (cancelled is terminal, no →fulfilled edge), row unchanged', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const { order } = await seedOrder({ orgId: org, status: 'cancelled' });

    const { ctx } = makeCtx({ orgId: org, orderId: order.id });
    let err: unknown;
    try {
      await fulfillOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as Error).message).toContain("from 'cancelled' to 'fulfilled'");

    // illegal transition must not have mutated the row
    const row = await readStatus(order.id);
    expect(row.status).toBe('cancelled');
    expect(row.fulfilledAt).toBeNull();
  });
});

describe('cancelOrder handler — pending → cancelled', () => {
  test('pending order → status=cancelled (read-back)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const { order } = await seedOrder({ orgId: org, status: 'pending' });

    const { ctx, userId } = makeCtx({ orgId: org, orderId: order.id });
    await cancelOrder(ctx);
    const { status } = (
      ctx as unknown as { _captured: () => { status: number } }
    )._captured();
    expect(status).toBe(200);

    const row = await readStatus(order.id);
    expect(row.status).toBe('cancelled');
    expect(row.updatedBy).toBe(userId);
  });

  test('fulfilled order → ConflictError (fulfilled has no →cancelled edge), row unchanged', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const { order } = await seedOrder({ orgId: org, status: 'fulfilled' });

    const { ctx } = makeCtx({ orgId: org, orderId: order.id });
    let err: unknown;
    try {
      await cancelOrder(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as Error).message).toContain("from 'fulfilled' to 'cancelled'");

    const row = await readStatus(order.id);
    expect(row.status).toBe('fulfilled'); // unchanged by the rejected transition
  });
});
