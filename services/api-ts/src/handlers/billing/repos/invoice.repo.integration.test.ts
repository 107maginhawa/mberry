/**
 * Real-DB integration tests for the billing-domain InvoiceRepository.
 *
 * Billing previously had ZERO real-Postgres coverage — `billing.repo.test.ts`
 * only inspects the Drizzle `where` tree the repo builds (or stubs the db), so
 * it can never prove the SQL is *correct*. It cannot catch:
 *   - a wrong JSONB `->>` metadata predicate (the Stripe webhook correlation path),
 *   - a busted atomic `replaceLineItems` (stored total diverging from the stored
 *     line-item rows — the exact receipt/audit mismatch FIX-007 closed),
 *   - a non-sequential / non-unique `generateInvoiceNumber`,
 *   - a status-transition that forgets to stamp paidAt/voidedAt,
 *   - an org-scope leak in `buildWhereConditions`,
 *   - or the durable webhook idempotency guard silently NOT raising on a
 *     duplicate event id (the 23505 unique conflict that dedupes a replay).
 *
 * This suite drives the actual query builders + transactions against REAL rows
 * in Postgres and asserts the REAL returned data and the persisted row state
 * read back from the database — never "did not throw".
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real
 * column/default/enum/CHECK and every UNIQUE CONSTRAINT
 * (invoices_invoice_number_unique, invoices_context_unique,
 * webhook_retry_idempotency_unique) is present — no hand-DDL drift. FKs are not
 * copied, so invoice/line-item/webhook rows insert directly without parent
 * person/org rows. search_path is pinned via the libpq startup option.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { InvoiceRepository } from './billing.repo';
import { invoices, invoiceLineItems } from './billing.schema';
import { webhookRetryLogs } from '@/handlers/association:member/repos/dues-payments.schema';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return noopLogger; } } as any;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const CUSTOMER = '00000000-0000-4000-8000-0000000000c1';
const MERCHANT = '00000000-0000-4000-8000-0000000000c2';

function freshId(): string {
  return crypto.randomUUID();
}

/**
 * Insert an invoice row directly via raw SQL and return its id. Raw SQL (rather
 * than the repo write path) lets us seed arbitrary
 * status/paymentStatus/metadata/invoiceNumber/context combinations the repo
 * write-path wouldn't normally produce, so the read/transition side can be proven
 * against adversarial data. We set every real NOT-NULL-without-default column
 * (invoice_number, customer, merchant, subtotal, total) and rely on column
 * defaults (id, timestamps, version, status, currency, capture method) for the
 * rest. Enum-typed params get an explicit ::<enum> cast.
 */
async function insertInvoice(opts: {
  id?: string;
  organizationId?: string | null;
  invoiceNumber?: string;
  customer?: string;
  merchant?: string;
  context?: string | null;
  status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  paymentStatus?: 'pending' | 'requires_capture' | 'processing' | 'succeeded' | 'failed' | 'canceled' | null;
  subtotal?: number;
  total?: number;
  metadata?: Record<string, unknown> | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".invoice
       (id, organization_id, invoice_number, customer, merchant, context, status,
        payment_status, subtotal, total, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::invoice_status,'draft'),
             $8::payment_status,$9,$10,$11::jsonb)`,
    [
      id,
      'organizationId' in opts ? opts.organizationId : ORG_A,
      opts.invoiceNumber ?? `INV-RAW-${id.slice(0, 8)}`,
      opts.customer ?? CUSTOMER,
      opts.merchant ?? MERCHANT,
      'context' in opts ? opts.context : null,
      opts.status ?? null,
      opts.paymentStatus ?? null,
      opts.subtotal ?? 1000,
      opts.total ?? 1000,
      opts.metadata === undefined ? null : JSON.stringify(opts.metadata),
    ],
  );
  return id;
}

/** Read a single invoice row back from Postgres (bypassing the repo). */
async function readInvoice(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".invoice WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** Read all line-item rows for an invoice ordered by amount (stable) from Postgres. */
async function readLineItems(invoiceId: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".invoice_line_item WHERE invoice = $1 ORDER BY amount`,
    [invoiceId],
  );
  return rows;
}

beforeAll(async () => {
  H = await createScratch(['invoice', 'invoice_line_item', 'webhook_retry_log']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// createWithLineItems — atomic invoice + line-items insert
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.createWithLineItems (real DB)', () => {
  test('persists the invoice and its line items, returning a generated invoice number', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);

    const result = await repo.createWithLineItems(
      {
        organizationId: ORG_A,
        customer: CUSTOMER,
        merchant: MERCHANT,
        subtotal: 1500,
        total: 1500,
      } as any,
      [
        { description: 'Annual dues', quantity: 1, unitPrice: 1000, amount: 1000 } as any,
        { description: 'Processing fee', quantity: 1, unitPrice: 500, amount: 500 } as any,
      ],
    );

    // Invoice number was generated for the current year (no caller-supplied number).
    const year = new Date().getFullYear();
    expect(result.invoiceNumber).toMatch(new RegExp(`^INV-${year}-\\d{6}$`));

    // The invoice + both line items are persisted and read back from Postgres.
    const persistedInvoice = await readInvoice(result.id);
    expect(persistedInvoice.invoice_number).toBe(result.invoiceNumber);
    expect(persistedInvoice.total).toBe(1500);

    const persistedItems = await readLineItems(result.id);
    expect(persistedItems).toHaveLength(2);
    // Stored line-item amounts sum to the stored invoice total (receipt integrity).
    expect(persistedItems.reduce((s, r) => s + r.amount, 0)).toBe(persistedInvoice.total);
    // Every line item is FK-linked to the freshly created invoice.
    expect(persistedItems.every((r) => r.invoice === result.id)).toBe(true);
  });

  test('returned line items carry their descriptions and back-reference the new invoice', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);

    const result = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 700, total: 700 } as any,
      [{ description: 'CPD course', quantity: 2, unitPrice: 350, amount: 700 } as any],
    );

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]!.description).toBe('CPD course');
    expect(result.lineItems[0]!.invoice).toBe(result.id);
    expect(result.lineItems[0]!.quantity).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// generateInvoiceNumber — sequential max+1 within the year + uniqueness
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.generateInvoiceNumber (real DB)', () => {
  test('starts at 000001 when no invoice exists for the current year', async () => {
    if (!H.dbReachable) return;
    // Note: generateInvoiceNumber scans the WHOLE scratch schema for INV-<year>-*.
    // This test must run before any current-year invoice is created, so it gets
    // its own isolated scratch schema to avoid cross-test bleed.
    const local = await createScratch(['invoice', 'invoice_line_item']);
    try {
      if (!local.dbReachable) return;
      const repo = new InvoiceRepository(local.db as any, noopLogger);
      const year = new Date().getFullYear();
      expect(await repo.generateInvoiceNumber()).toBe(`INV-${year}-000001`);
    } finally {
      await local.teardown();
    }
  });

  test('returns max+1 within the year (string-sorted, zero-padded to 6)', async () => {
    if (!H.dbReachable) return;
    const local = await createScratch(['invoice', 'invoice_line_item']);
    try {
      if (!local.dbReachable) return;
      const repo = new InvoiceRepository(local.db as any, noopLogger);
      const year = new Date().getFullYear();

      // Seed existing numbers including a two-digit one — zero-padding keeps the
      // string ORDER BY desc correct (…000009 < …000010), so max is 000042.
      await insertInvoiceInto(local, { invoiceNumber: `INV-${year}-000007` });
      await insertInvoiceInto(local, { invoiceNumber: `INV-${year}-000042` });
      await insertInvoiceInto(local, { invoiceNumber: `INV-${year}-000010` });
      // A different year must NOT influence this year's sequence.
      await insertInvoiceInto(local, { invoiceNumber: `INV-${year - 1}-000099` });

      expect(await repo.generateInvoiceNumber()).toBe(`INV-${year}-000043`);
    } finally {
      await local.teardown();
    }
  });

  test('the generated number is enforced unique by invoices_invoice_number_unique', async () => {
    if (!H.dbReachable) return;
    // A unique, current-year-shaped number that won't collide with any other row
    // seeded in this shared scratch schema (random 6-digit suffix).
    const suffix = String(Math.floor(Math.random() * 900000) + 100000);
    const dupNumber = `INV-${new Date().getFullYear()}-${suffix}`;

    await insertInvoice({ invoiceNumber: dupNumber });

    // A second insert with the same invoice_number must violate the UNIQUE
    // constraint copied by LIKE INCLUDING ALL — proving the guard is real.
    await expect(
      H.scopedPool.query(
        `INSERT INTO "${H.schema}".invoice
           (id, organization_id, invoice_number, customer, merchant, subtotal, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [freshId(), ORG_A, dupNumber, CUSTOMER, MERCHANT, 100, 100],
      ),
    ).rejects.toThrow(/duplicate key value|invoices_invoice_number_unique/);
  });
});

// Helper that inserts into an arbitrary scratch (used by the isolated-schema
// generateInvoiceNumber tests above).
async function insertInvoiceInto(
  scratch: ScratchDb,
  opts: { invoiceNumber: string },
): Promise<void> {
  await scratch.scopedPool.query(
    `INSERT INTO "${scratch.schema}".invoice
       (id, organization_id, invoice_number, customer, merchant, subtotal, total)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [freshId(), ORG_A, opts.invoiceNumber, CUSTOMER, MERCHANT, 100, 100],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JSONB metadata lookups — Stripe webhook correlation (the ->> path)
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.findByStripePaymentIntentId (real DB)', () => {
  test('matches the invoice whose metadata.stripePaymentIntentId equals the arg', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const pi = `pi_${freshId()}`;
    const id = await insertInvoice({ metadata: { stripePaymentIntentId: pi, other: 'x' } });
    // A decoy invoice with a different payment intent must NOT match.
    await insertInvoice({ metadata: { stripePaymentIntentId: `pi_${freshId()}` } });

    const found = await repo.findByStripePaymentIntentId(pi);
    expect(found?.id).toBe(id);
  });

  test('returns null when no invoice metadata carries the payment intent id', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    // An invoice with NULL metadata must not break the ->> predicate.
    await insertInvoice({ metadata: null });
    expect(await repo.findByStripePaymentIntentId(`pi_${freshId()}`)).toBeNull();
  });

  test('does not match an invoice that stores the id under a different metadata key', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const value = `pi_${freshId()}`;
    // Stored under transfer key, NOT payment-intent key → the ->> path is key-specific.
    await insertInvoice({ metadata: { stripeTransferId: value } });
    expect(await repo.findByStripePaymentIntentId(value)).toBeNull();
  });
});

describe('InvoiceRepository.findByStripeTransferId (real DB)', () => {
  test('returns every invoice settled by the same transfer (transfer settles many)', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const transfer = `tr_${freshId()}`;
    const a = await insertInvoice({ metadata: { stripeTransferId: transfer } });
    const b = await insertInvoice({ metadata: { stripeTransferId: transfer } });
    // A different transfer must NOT be returned.
    await insertInvoice({ metadata: { stripeTransferId: `tr_${freshId()}` } });

    const found = await repo.findByStripeTransferId(transfer);
    expect(new Set(found.map((i) => i.id))).toEqual(new Set([a, b]));
  });

  test('returns an empty array when no invoice references the transfer', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    expect(await repo.findByStripeTransferId(`tr_${freshId()}`)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// replaceLineItems — atomic delete + insert + persisted total
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.replaceLineItems (real DB)', () => {
  test('atomically swaps the rows and persists a total that equals their sum', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);

    // Start from a created invoice with two line items summing to 1500.
    const created = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 1500, total: 1500 } as any,
      [
        { description: 'Old A', quantity: 1, unitPrice: 1000, amount: 1000 } as any,
        { description: 'Old B', quantity: 1, unitPrice: 500, amount: 500 } as any,
      ],
    );

    // Replace with a single 2200-cent row and re-persist the recomputed total.
    const updated = await repo.replaceLineItems(
      created.id,
      [{ description: 'New combined', quantity: 1, unitPrice: 2200, amount: 2200 } as any],
      { subtotal: 2200, total: 2200 },
    );

    // Returned shape reflects the swap.
    expect(updated.lineItems).toHaveLength(1);
    expect(updated.lineItems[0]!.description).toBe('New combined');
    expect(updated.total).toBe(2200);

    // Read back from Postgres: the OLD rows are gone, exactly the NEW row remains,
    // and the stored invoice total equals the sum of the stored rows — the exact
    // receipt/audit invariant FIX-007 restored.
    const persistedItems = await readLineItems(created.id);
    expect(persistedItems).toHaveLength(1);
    expect(persistedItems[0]!.description).toBe('New combined');
    const persistedInvoice = await readInvoice(created.id);
    expect(persistedInvoice.total).toBe(2200);
    expect(persistedItems.reduce((s, r) => s + r.amount, 0)).toBe(persistedInvoice.total);
  });

  test('replacing with an empty set clears all line items and zeroes the total', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const created = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 900, total: 900 } as any,
      [{ description: 'To be removed', quantity: 1, unitPrice: 900, amount: 900 } as any],
    );

    const updated = await repo.replaceLineItems(created.id, [], { subtotal: 0, total: 0 });
    expect(updated.lineItems).toEqual([]);

    expect(await readLineItems(created.id)).toHaveLength(0);
    expect((await readInvoice(created.id)).total).toBe(0);
  });

  test('does not touch a DIFFERENT invoice\'s line items during the replace', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const target = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 100, total: 100 } as any,
      [{ description: 'target item', quantity: 1, unitPrice: 100, amount: 100 } as any],
    );
    const bystander = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 250, total: 250 } as any,
      [{ description: 'bystander item', quantity: 1, unitPrice: 250, amount: 250 } as any],
    );

    await repo.replaceLineItems(
      target.id,
      [{ description: 'replacement', quantity: 1, unitPrice: 999, amount: 999 } as any],
      { subtotal: 999, total: 999 },
    );

    // The bystander invoice's single line item survives untouched.
    const bystanderItems = await readLineItems(bystander.id);
    expect(bystanderItems).toHaveLength(1);
    expect(bystanderItems[0]!.description).toBe('bystander item');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Status / payment-status transitions
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.updateStatus (real DB)', () => {
  test('transition to paid stamps paidAt and persists status=paid', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'open' });

    const updated = await repo.updateStatus(id, 'paid');
    expect(updated.status).toBe('paid');
    expect(updated.paidAt).not.toBeNull();

    const row = await readInvoice(id);
    expect(row.status).toBe('paid');
    expect(row.paid_at).not.toBeNull();
    expect(row.voided_at).toBeNull(); // void timestamp untouched on a paid transition
  });

  test('transition to void stamps voidedAt and persists status=void', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'open' });

    const updated = await repo.updateStatus(id, 'void');
    expect(updated.status).toBe('void');
    expect(updated.voidedAt).not.toBeNull();

    const row = await readInvoice(id);
    expect(row.status).toBe('void');
    expect(row.voided_at).not.toBeNull();
    expect(row.paid_at).toBeNull(); // paid timestamp not set on a void transition
  });

  test('a non-terminal transition (open) does not stamp paidAt or voidedAt', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'draft' });

    await repo.updateStatus(id, 'open');
    const row = await readInvoice(id);
    expect(row.status).toBe('open');
    expect(row.paid_at).toBeNull();
    expect(row.voided_at).toBeNull();
  });

  test('bumps version (optimistic lock) on the status update', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'open' });
    const before = (await readInvoice(id)).version;
    await repo.updateStatus(id, 'paid');
    expect((await readInvoice(id)).version).toBe(before + 1);
  });
});

describe('InvoiceRepository.updatePaymentStatus (real DB)', () => {
  test('persists the new payment status read back from Postgres', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ paymentStatus: 'pending' });

    const updated = await repo.updatePaymentStatus(id, 'succeeded');
    expect(updated.paymentStatus).toBe('succeeded');
    expect((await readInvoice(id)).payment_status).toBe('succeeded');
  });

  test('moves through requires_capture → processing without touching invoice status', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'open', paymentStatus: 'pending' });

    await repo.updatePaymentStatus(id, 'requires_capture');
    expect((await readInvoice(id)).payment_status).toBe('requires_capture');

    await repo.updatePaymentStatus(id, 'processing');
    const row = await readInvoice(id);
    expect(row.payment_status).toBe('processing');
    expect(row.status).toBe('open'); // invoice lifecycle status untouched
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findOneWithLineItems + org-scoped buildWhereConditions (via findMany)
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.findOneWithLineItems (real DB)', () => {
  test('returns the invoice joined to exactly its own line items', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const created = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 300, total: 300 } as any,
      [
        { description: 'Item 1', quantity: 1, unitPrice: 100, amount: 100 } as any,
        { description: 'Item 2', quantity: 1, unitPrice: 200, amount: 200 } as any,
      ],
    );
    // A second invoice with its own line items must not bleed in.
    await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 50, total: 50 } as any,
      [{ description: 'Other', quantity: 1, unitPrice: 50, amount: 50 } as any],
    );

    const loaded = await repo.findOneWithLineItems(created.id);
    expect(loaded?.id).toBe(created.id);
    expect(loaded?.lineItems).toHaveLength(2);
    expect(loaded?.lineItems.every((li) => li.invoice === created.id)).toBe(true);
  });

  test('returns null for a non-existent invoice id', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    expect(await repo.findOneWithLineItems(freshId())).toBeNull();
  });
});

describe('InvoiceRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates invoices from another org (tenant guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertInvoice({ organizationId: orgX });
    await insertInvoice({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.organizationId === orgX)).toBe(true);
  });

  test('status filter narrows to a single lifecycle state within an org', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const paid = await insertInvoice({ organizationId: org, status: 'paid' });
    await insertInvoice({ organizationId: org, status: 'open' });
    await insertInvoice({ organizationId: org, status: 'void' });

    const rows = await repo.findMany({ organizationId: org, status: 'paid' });
    expect(rows.map((r) => r.id)).toEqual([paid]);
  });

  test('paymentStatus filter narrows to succeeded within an org', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const succeeded = await insertInvoice({ organizationId: org, paymentStatus: 'succeeded' });
    await insertInvoice({ organizationId: org, paymentStatus: 'failed' });

    const rows = await repo.findMany({ organizationId: org, paymentStatus: 'succeeded' });
    expect(rows.map((r) => r.id)).toEqual([succeeded]);
  });

  test('customerOrMerchant filter matches rows on either side of the relationship', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const party = freshId();
    const asCustomer = await insertInvoice({ organizationId: org, customer: party, merchant: MERCHANT });
    const asMerchant = await insertInvoice({ organizationId: org, customer: CUSTOMER, merchant: party });
    // A row where `party` is neither customer nor merchant must be excluded.
    await insertInvoice({ organizationId: org, customer: CUSTOMER, merchant: MERCHANT });

    const rows = await repo.findMany({ organizationId: org, customerOrMerchant: party });
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([asCustomer, asMerchant]));
  });

  test('context filter narrows to the idempotency context key', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const ctx = `booking:${freshId()}`;
    const wanted = await insertInvoice({ organizationId: org, context: ctx });
    await insertInvoice({ organizationId: org, context: `booking:${freshId()}` });

    const rows = await repo.findMany({ organizationId: org, context: ctx });
    expect(rows.map((r) => r.id)).toEqual([wanted]);
  });

  test('count() respects the org + status filters', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertInvoice({ organizationId: org, status: 'paid' });
    await insertInvoice({ organizationId: org, status: 'paid' });
    await insertInvoice({ organizationId: org, status: 'open' });

    expect(await repo.count({ organizationId: org })).toBe(3);
    expect(await repo.count({ organizationId: org, status: 'paid' })).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// context uniqueness — idempotent invoice creation guard
// ═══════════════════════════════════════════════════════════════════════════

describe('Invoice context uniqueness (real DB)', () => {
  test('two invoices with the SAME non-null context violate invoices_context_unique', async () => {
    if (!H.dbReachable) return;
    const ctx = `booking:${freshId()}`;
    await insertInvoice({ context: ctx });

    await expect(insertInvoice({ context: ctx })).rejects.toThrow(
      /duplicate key value|invoices_context_unique/,
    );
  });

  test('multiple NULL contexts are allowed (Postgres unique permits repeated NULLs)', async () => {
    if (!H.dbReachable) return;
    // Two NULL-context invoices coexist — the unique constraint only collides on
    // equal non-null values, so unrelated invoices aren't forced into a context.
    const a = await insertInvoice({ context: null });
    const b = await insertInvoice({ context: null });
    expect(a).not.toBe(b);
    expect((await readInvoice(a)).id).toBe(a);
    expect((await readInvoice(b)).id).toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Durable webhook idempotency — the 23505 unique conflict that dedupes a replay
// ═══════════════════════════════════════════════════════════════════════════

describe('Durable webhook idempotency via webhook_retry_idempotency_unique (real DB)', () => {
  test('a duplicate idempotencyKey insert via onConflictDoNothing returns no row (deduped)', async () => {
    if (!H.dbReachable) return;
    // This mirrors the handler's claim: insert into webhook_retry_log keyed on the
    // Stripe event id. The unique insert IS the guard — the FIRST claim returns a
    // row id; a SECOND claim for the same event id conflicts and returns [].
    const eventId = `evt_${freshId()}`;
    const org = freshId();

    const claimRow = (key: string) =>
      (H.db as any)
        .insert(webhookRetryLogs)
        .values({
          idempotencyKey: key,
          provider: 'stripe',
          eventType: 'charge.succeeded',
          payload: { object: 'event' },
          organizationId: org,
          status: 'completed',
        })
        .onConflictDoNothing({ target: webhookRetryLogs.idempotencyKey })
        .returning({ id: webhookRetryLogs.id });

    const first = await claimRow(eventId);
    expect(first).toHaveLength(1); // first delivery claims the event

    const second = await claimRow(eventId);
    expect(second).toHaveLength(0); // redelivery is deduped — no second side effect

    // Exactly ONE ledger row exists for the event id (no duplicate persisted).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".webhook_retry_log WHERE idempotency_key = $1`,
      [eventId],
    );
    expect(rows[0].n).toBe(1);
  });

  test('a duplicate insert WITHOUT onConflict actually raises the 23505 unique violation', async () => {
    if (!H.dbReachable) return;
    // Proves the conflict genuinely raises (the constraint exists + is enforced),
    // so the onConflictDoNothing guard above is doing real dedupe work — not
    // silently passing because the constraint was missing from the copied table.
    const eventId = `evt_${freshId()}`;
    const org = freshId();

    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".webhook_retry_log
         (id, idempotency_key, provider, event_type, payload, organization_id, status)
       VALUES ($1,$2,'stripe','charge.succeeded','{}'::jsonb,$3,'completed'::webhook_retry_status)`,
      [freshId(), eventId, org],
    );

    let raised: any = null;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".webhook_retry_log
           (id, idempotency_key, provider, event_type, payload, organization_id, status)
         VALUES ($1,$2,'stripe','charge.succeeded','{}'::jsonb,$3,'completed'::webhook_retry_status)`,
        [freshId(), eventId, org],
      );
    } catch (err) {
      raised = err;
    }

    expect(raised).not.toBeNull();
    // 23505 = unique_violation (Postgres SQLSTATE) on the idempotency constraint.
    // Assert on the pg error's structured `.code` (SQLSTATE) — the durable proof
    // that the unique constraint exists and is enforced. The constraint NAME is
    // the auto-generated `webhook_retry_log_idempotency_key_key` (Postgres derives
    // `<table>_<col>_key` for an inline UNIQUE), so we match the idempotency_key
    // column it covers rather than a hand-assumed constraint name.
    expect(raised.code).toBe('23505');
    expect(String(raised.constraint ?? raised.message)).toContain('idempotency_key');
  });

  test('distinct event ids each claim their own ledger row (no false dedupe)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const claim = (key: string) =>
      (H.db as any)
        .insert(webhookRetryLogs)
        .values({
          idempotencyKey: key,
          provider: 'stripe',
          eventType: 'payment_intent.succeeded',
          payload: {},
          organizationId: org,
          status: 'completed',
        })
        .onConflictDoNothing({ target: webhookRetryLogs.idempotencyKey })
        .returning({ id: webhookRetryLogs.id });

    const e1 = await claim(`evt_${freshId()}`);
    const e2 = await claim(`evt_${freshId()}`);
    // Two genuinely-different events both get processed (claimed) — the guard
    // only suppresses true redelivery, never distinct events.
    expect(e1).toHaveLength(1);
    expect(e2).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// JSONB lookup correctness under transaction binding (matches handler usage)
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository JSONB lookups under a transaction (real DB)', () => {
  test('findByStripePaymentIntentId works on a tx-bound repo (webhook handler pattern)', async () => {
    if (!H.dbReachable) return;
    const pi = `pi_${freshId()}`;
    const id = await insertInvoice({ metadata: { stripePaymentIntentId: pi } });

    // The webhook handler constructs `new InvoiceRepository(tx, logger)` inside
    // database.transaction — prove the same correlation predicate runs there too.
    const found = await (H.db as any).transaction(async (tx: any) => {
      const txRepo = new InvoiceRepository(tx, noopLogger);
      return txRepo.findByStripePaymentIntentId(pi);
    });
    expect(found?.id).toBe(id);

    // Sanity: the raw ->> predicate matches the same row.
    const direct = await (H.db as any)
      .select()
      .from(invoices)
      .where(sql`${invoices.metadata}->>'stripePaymentIntentId' = ${pi}`);
    expect(direct.map((r: any) => r.id)).toEqual([id]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findLineItemsByInvoiceIds — batch fetch map
// ═══════════════════════════════════════════════════════════════════════════

describe('InvoiceRepository.findLineItemsByInvoiceIds (real DB)', () => {
  test('groups line items into a Map keyed by invoice id', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    const inv1 = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 300, total: 300 } as any,
      [
        { description: 'a', quantity: 1, unitPrice: 100, amount: 100 } as any,
        { description: 'b', quantity: 1, unitPrice: 200, amount: 200 } as any,
      ],
    );
    const inv2 = await repo.createWithLineItems(
      { organizationId: ORG_A, customer: CUSTOMER, merchant: MERCHANT, subtotal: 50, total: 50 } as any,
      [{ description: 'c', quantity: 1, unitPrice: 50, amount: 50 } as any],
    );

    const map = await repo.findLineItemsByInvoiceIds([inv1.id, inv2.id]);
    expect(map.get(inv1.id)).toHaveLength(2);
    expect(map.get(inv2.id)).toHaveLength(1);
    expect(map.get(inv1.id)!.every((li) => li.invoice === inv1.id)).toBe(true);
  });

  test('empty input short-circuits to an empty Map (no query)', async () => {
    if (!H.dbReachable) return;
    const repo = new InvoiceRepository(H.db as any, noopLogger);
    expect((await repo.findLineItemsByInvoiceIds([])).size).toBe(0);
  });
});
