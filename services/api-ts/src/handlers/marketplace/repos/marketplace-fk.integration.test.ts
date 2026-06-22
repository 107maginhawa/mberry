/**
 * Marketplace FK chain — referential integrity proven on the REAL `public`
 * schema (W3 marketplace S7).
 *
 * DELIBERATE EXCEPTION to the createScratch harness: `createScratch` copies
 * tables via `CREATE TABLE ... (LIKE public.* INCLUDING ALL)`, and `LIKE` never
 * copies FOREIGN KEY constraints. The FK chain we want to prove
 * (`marketplace_listing.vendor_id → vendor.id ON DELETE CASCADE`,
 * `marketplace_order.vendor_id → vendor.id` no-cascade,
 * `marketplace_order.listing_id → marketplace_listing.id` no-cascade) only
 * exists on `public`. So this suite drives the FK behaviour against `public`
 * directly, wrapping every test in a transaction it ALWAYS rolls back, so no
 * row ever survives the test (public stays pristine, parallel-safe).
 *
 * Verified live (`\d` on public): cascade only on
 * marketplace_listing_vendor_id_vendor_id_fk; orders pin both vendor and
 * listing with NO cascade.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool, type PoolClient } from 'pg';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

let pool: Pool | undefined;
let dbReachable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000, max: 2 });
  try {
    const c = await pool.connect();
    try {
      // confirm the FK-bearing tables exist on public (migrated DB)
      await c.query('SELECT 1 FROM public.vendor LIMIT 0');
      await c.query('SELECT 1 FROM public.marketplace_listing LIMIT 0');
      await c.query('SELECT 1 FROM public.marketplace_order LIMIT 0');
      dbReachable = true;
    } finally {
      c.release();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[marketplace-fk] Postgres unreachable / public not migrated; skipping. ${(err as Error).message}`);
    dbReachable = false;
  }
});

afterAll(async () => {
  await pool?.end().catch(() => {});
});

/**
 * Run `fn` inside a transaction that is ALWAYS rolled back, so the FK behaviour
 * is exercised on real `public` constraints without leaving any rows behind.
 */
async function inRollbackTx(fn: (c: PoolClient) => Promise<void>): Promise<void> {
  const c = await pool!.connect();
  try {
    await c.query('BEGIN');
    await fn(c);
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    c.release();
  }
}

function pgCode(e: unknown): string | undefined {
  return (e as { code?: string; cause?: { code?: string } }).code
    ?? (e as { cause?: { code?: string } }).cause?.code;
}

async function seedVendor(c: PoolClient, orgId: string): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO public.vendor
       (organization_id, company_name, category, description, contact_email, created_by, updated_by)
     VALUES ($1, 'FK Co', 'supplies', 'd', $2, $3, $3)
     RETURNING id`,
    [orgId, `fk-${crypto.randomUUID()}@x.test`, crypto.randomUUID()],
  );
  return rows[0].id as string;
}

async function seedListing(c: PoolClient, orgId: string, vendorId: string): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO public.marketplace_listing
       (organization_id, vendor_id, title, description, price, status, created_by, updated_by)
     VALUES ($1, $2, 'FK Listing', 'd', '10.00', 'active', $3, $3)
     RETURNING id`,
    [orgId, vendorId, crypto.randomUUID()],
  );
  return rows[0].id as string;
}

async function seedOrder(
  c: PoolClient,
  orgId: string,
  listingId: string,
  vendorId: string,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO public.marketplace_order
       (organization_id, listing_id, buyer_person_id, vendor_id, quantity, total_price, created_by, updated_by)
     VALUES ($1, $2, $3, $4, 1, '10.00', $5, $5)
     RETURNING id`,
    [orgId, listingId, crypto.randomUUID(), vendorId, crypto.randomUUID()],
  );
  return rows[0].id as string;
}

describe('marketplace FK chain @ public (W3 S7 / referential integrity)', () => {
  test('deleting a vendor CASCADEs its marketplace_listing rows (ON DELETE CASCADE)', async () => {
    if (!dbReachable) return;
    await inRollbackTx(async (c) => {
      const org = crypto.randomUUID();
      const vendorId = await seedVendor(c, org);
      await seedListing(c, org, vendorId);
      await seedListing(c, org, vendorId);

      const before = await c.query(
        'SELECT count(*)::int AS n FROM public.marketplace_listing WHERE vendor_id = $1',
        [vendorId],
      );
      expect(before.rows[0].n).toBe(2);

      // delete the vendor → cascade should sweep the listings
      await c.query('DELETE FROM public.vendor WHERE id = $1', [vendorId]);

      const after = await c.query(
        'SELECT count(*)::int AS n FROM public.marketplace_listing WHERE vendor_id = $1',
        [vendorId],
      );
      expect(after.rows[0].n).toBe(0);
    });
  });

  test('deleting a vendor that has an order → 23503 (no cascade — cannot orphan an order)', async () => {
    if (!dbReachable) return;
    await inRollbackTx(async (c) => {
      const org = crypto.randomUUID();
      const vendorId = await seedVendor(c, org);
      const listingId = await seedListing(c, org, vendorId);
      await seedOrder(c, org, listingId, vendorId);

      // The order's vendor_id FK has NO cascade → deleting the vendor must be
      // refused with a foreign_key_violation, even though the listing FK would
      // cascade, because the cascade-deleted listing is still referenced by the
      // order AND the vendor itself is still referenced by the order.
      // Wrap in a SAVEPOINT so the FK-violation abort can be released and the tx
      // stays usable for the post-condition read-back (a bare constraint error
      // poisons the whole tx → 25P02 on any subsequent command).
      await c.query('SAVEPOINT before_del');
      let code: string | undefined;
      try {
        await c.query('DELETE FROM public.vendor WHERE id = $1', [vendorId]);
        throw new Error('expected vendor delete to fail with FK violation');
      } catch (e) {
        code = pgCode(e);
      }
      expect(code).toBe('23503');
      await c.query('ROLLBACK TO SAVEPOINT before_del');

      // vendor still on disk (delete was refused, within this tx)
      const still = await c.query('SELECT count(*)::int AS n FROM public.vendor WHERE id = $1', [vendorId]);
      expect(still.rows[0].n).toBe(1);
    });
  });

  test('inserting an order with an absent listing_id → 23503 on the listing FK', async () => {
    if (!dbReachable) return;
    await inRollbackTx(async (c) => {
      const org = crypto.randomUUID();
      const vendorId = await seedVendor(c, org);
      const absentListingId = crypto.randomUUID(); // never inserted

      let code: string | undefined;
      try {
        await seedOrder(c, org, absentListingId, vendorId);
        throw new Error('expected order insert to fail with FK violation');
      } catch (e) {
        code = pgCode(e);
      }
      expect(code).toBe('23503');
    });
  });

  test('inserting an order with an absent vendor_id → 23503 on the vendor FK', async () => {
    if (!dbReachable) return;
    await inRollbackTx(async (c) => {
      const org = crypto.randomUUID();
      const vendorId = await seedVendor(c, org);
      const listingId = await seedListing(c, org, vendorId);
      const absentVendorId = crypto.randomUUID(); // never inserted

      let code: string | undefined;
      try {
        await seedOrder(c, org, listingId, absentVendorId);
        throw new Error('expected order insert to fail with FK violation');
      } catch (e) {
        code = pgCode(e);
      }
      expect(code).toBe('23503');
    });
  });
});
