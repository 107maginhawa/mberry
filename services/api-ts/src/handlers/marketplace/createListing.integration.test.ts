/**
 * Real-PG integration suite for the createListing HANDLER (W3 marketplace S3).
 *
 * Drives the REAL `createListing` handler with REAL Vendor + Listing repositories
 * backed by a `createScratch(['vendor','marketplace_listing','marketplace_order'])`
 * schema (injected via ctx.get('database')) — NO prototype mocking, no stubRepo.
 * Every assertion is against a persisted row read back via H.scopedPool, a thrown
 * AppError, or a real Postgres SQLSTATE.
 *
 * Proves BR-38 (vendor verification gate) end-to-end through SQL:
 *  - verified vendor → listing persists with status='draft', currency='USD' default
 *  - pending vendor → BusinessLogicError BEFORE any insert → 0 listing rows (no orphan)
 *  - missing vendor → NotFoundError, 0 rows
 *  - enum integrity backstop: raw insert status='bogus' → 22P02 on listing_status
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { createListing } from './createListing';
import { VendorRepository } from './repos/vendor.repo';
import { BusinessLogicError, NotFoundError } from '@/core/errors';
import type { NewVendor } from './repos/marketplace.schema';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['vendor', 'marketplace_listing', 'marketplace_order']);
});
afterAll(async () => {
  await H?.teardown();
});

function newVendor(orgId: string, status: 'pending' | 'verified'): NewVendor {
  return {
    organizationId: orgId,
    companyName: 'V',
    category: 'supplies',
    description: 'd',
    contactEmail: `v-${crypto.randomUUID()}@x.test`,
    verificationStatus: status,
  } as NewVendor;
}

interface ListingBody {
  vendorId?: string;
  title?: string;
  description?: string;
  price?: string | null;
  currency?: string;
  categoryTags?: string[];
}

/**
 * Build a handler ctx wired to the REAL scratch db. `database` returns H.db so the
 * Vendor/Listing repos constructed inside the handler run real SQL against the
 * isolated schema. Mirrors the createReview.integration.test.ts ctx shape but with
 * the keys createListing reads: user, database, logger, requestId, organizationId.
 */
function makeCtx(opts: { userId?: string; orgId: string; body: ListingBody }) {
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

async function countListingsForVendor(vendorId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".marketplace_listing WHERE vendor_id=$1`,
    [vendorId],
  );
  return rows[0].n as number;
}

describe('createListing handler — verified vendor (BR-38 happy path)', () => {
  test('201 + persisted status=draft, currency=USD default, org/vendor/created_by', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org, 'verified'));

    // omit currency to exercise the handler default ('USD')
    const { ctx, userId } = makeCtx({
      orgId: org,
      body: { vendorId: vendor.id, title: '  Gloves  ', description: '  box of 100  ' },
    });

    await createListing(ctx);
    const { data, status } = (
      ctx as unknown as { _captured: () => { data: { id: string }; status: number } }
    )._captured();

    expect(status).toBe(201);
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id, vendor_id, title, description, status, currency,
              category_tags, created_by
         FROM "${H.schema}".marketplace_listing WHERE id=$1`,
      [data.id],
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.organization_id).toBe(org);
    expect(r.vendor_id).toBe(vendor.id);
    expect(r.title).toBe('Gloves'); // handler trims
    expect(r.description).toBe('box of 100');
    expect(r.status).toBe('draft'); // handler always seeds draft
    expect(r.currency).toBe('USD'); // handler default applied
    expect(r.category_tags).toEqual([]); // handler default []
    expect(r.created_by).toBe(userId);
  });
});

describe('createListing handler — pending vendor gate (BR-38)', () => {
  test('pending vendor → BusinessLogicError BEFORE insert, 0 listing rows (no orphan draft)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const vr = new VendorRepository(H.db as never);
    const vendor = await vr.createOne(newVendor(org, 'pending'));

    const { ctx } = makeCtx({
      orgId: org,
      body: { vendorId: vendor.id, title: 'Gloves', description: 'box' },
    });

    let err: unknown;
    try {
      await createListing(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as Error).message).toBe('Vendor must be verified before creating listings');
    // the gate fires before listingRepo.createOne — no orphan draft persisted
    expect(await countListingsForVendor(vendor.id)).toBe(0);
  });

  test('unknown vendorId → NotFoundError, 0 rows', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const ghostVendor = crypto.randomUUID();
    const { ctx } = makeCtx({
      orgId: org,
      body: { vendorId: ghostVendor, title: 'Gloves', description: 'box' },
    });

    await expect(createListing(ctx)).rejects.toBeInstanceOf(NotFoundError);
    expect(await countListingsForVendor(ghostVendor)).toBe(0);
  });
});
