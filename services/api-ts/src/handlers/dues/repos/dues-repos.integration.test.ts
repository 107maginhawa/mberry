/**
 * Real-DB integration tests for the dues MONEY repositories.
 *
 * This is the #1 critical fix from the multi-layer audit: the dues money code
 * (receipt-sequence atomicity, payment status transitions + financial audit
 * trail, payment-token validation) had no real-DB coverage. These tests drive
 * the actual drizzle query builders against REAL Postgres rows so the WHERE
 * predicates, RETURNING, onConflictDoUpdate upsert, innerJoins, and the
 * status-transition guard all execute end-to-end.
 *
 * Targets:
 *   - PaymentTokenRepository  (create / findByTokenHash / findByTokenHashWithDetails / markUsed)
 *   - DuesRepository          (getNextReceiptSequence — atomic per-(org,year) counter;
 *                              updatePaymentStatus — valid transition + audit-trail row,
 *                              invalid transition throws; getConfig; listPayments;
 *                              createPayment round-trip)
 *
 * Pattern mirrors comms/repos/comms-repos.integration.test.ts: a per-run scratch
 * schema with hand-written DDL for ONLY the tables the exercised methods touch.
 * Enums are modelled as `text` (drizzle sends the literal string). Cross-table
 * FKs we don't seed are omitted.
 *
 * Requires a reachable Postgres (DATABASE_URL or the repo default). If
 * unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PaymentTokenRepository } from './payment-token.repo';
import { DuesRepository } from './dues-payments.repo';
import { ConflictError } from '@/core/errors';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `dues_repos_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let setupPool: Pool;
let scopedPool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

// uuid NOT NULL columns need real UUIDs.
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const PERSON_1 = '00000000-0000-4000-8000-0000000000c1';
const PERSON_2 = '00000000-0000-4000-8000-0000000000c2';
const OFFICER = '00000000-0000-4000-8000-0000000000d1';

function freshId(): string {
  return crypto.randomUUID();
}

async function ddl(client: any) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await client.query(`SET search_path TO "${TEST_SCHEMA}", public`);

  const baseCols = `
    version integer NOT NULL DEFAULT 1,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()`;

  // person — only the columns the joins SELECT plus the NOT NULL first_name.
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".person (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name varchar(50) NOT NULL,
      last_name varchar(50),${baseCols}
    )
  `);

  // organization — seed name + slug + required NOT NULL columns (enums as text).
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".organization (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id uuid NOT NULL DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      slug varchar(100) NOT NULL,
      org_type text NOT NULL DEFAULT 'association',
      status text NOT NULL DEFAULT 'trial',${baseCols}
    )
  `);

  // payment_token — enums n/a; FKs omitted (we seed person + org ourselves).
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".payment_token (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash varchar(128) NOT NULL UNIQUE,
      person_id uuid NOT NULL,
      organization_id uuid NOT NULL,
      invoice_id uuid,
      amount integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'PHP',
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_by_officer uuid NOT NULL,${baseCols}
    )
  `);

  // dues_org_config — getConfig reads this.
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".dues_org_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL UNIQUE,
      default_amount integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'PHP',
      billing_frequency text NOT NULL DEFAULT 'annual',
      due_date_month integer,
      due_date_day integer NOT NULL DEFAULT 1,
      grace_period_days integer NOT NULL DEFAULT 30,${baseCols}
    )
  `);

  // dues_payment — money table. Status/method enums as text.
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".dues_payment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      person_id uuid NOT NULL,
      invoice_id uuid,
      receipt_number varchar(50) NOT NULL,
      amount integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'PHP',
      payment_method text NOT NULL,
      reference_number varchar(100),
      status text NOT NULL DEFAULT 'pending',
      recorded_by uuid,
      membership_extended_from date,
      membership_extended_to date,
      paid_at timestamptz,
      expired_at timestamptz,
      refunded_amount integer NOT NULL DEFAULT 0,
      refund_date timestamptz,
      refund_reason text,
      proof_storage_key varchar(500),
      proof_file_name varchar(255),
      proof_mime_type varchar(100),
      rejection_reason text,
      metadata jsonb,${baseCols},
      CONSTRAINT dues_payment_org_receipt_unique UNIQUE (organization_id, receipt_number)
    )
  `);

  // dues_payment_status_history — audit trail appended by updatePaymentStatus.
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".dues_payment_status_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      payment_id uuid NOT NULL,
      person_id uuid NOT NULL,
      from_status text,
      to_status text NOT NULL,
      reason text,
      changed_by uuid,
      changed_at timestamptz NOT NULL DEFAULT now(),${baseCols}
    )
  `);

  // dues_receipt_counter — atomic per-(org, year) sequence. Composite PK.
  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".dues_receipt_counter (
      organization_id uuid NOT NULL,
      year integer NOT NULL,
      next_sequence integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT dues_receipt_counter_pk PRIMARY KEY (organization_id, year)
    )
  `);
}

/** Insert an organization row directly and return its id. */
async function insertOrg(opts: { id?: string; name?: string; slug?: string } = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await scopedPool.query(
    `INSERT INTO "${TEST_SCHEMA}".organization (id, name, slug)
     VALUES ($1,$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [id, opts.name ?? 'Acme Dental Assoc', opts.slug ?? 'acme'],
  );
  return id;
}

/** Insert a person row directly and return its id. */
async function insertPerson(opts: { id?: string; firstName?: string; lastName?: string | null } = {}): Promise<string> {
  const id = opts.id ?? freshId();
  // Respect an explicit `null` lastName ('lastName' in opts) vs an omitted one.
  const lastName = 'lastName' in opts ? opts.lastName ?? null : 'Doe';
  await scopedPool.query(
    `INSERT INTO "${TEST_SCHEMA}".person (id, first_name, last_name)
     VALUES ($1,$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [id, opts.firstName ?? 'Jane', lastName],
  );
  return id;
}

beforeAll(async () => {
  setupPool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const client = await setupPool.connect();
    try {
      await ddl(client);
      dbReachable = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[dues-repos integration] Postgres unreachable, skipping: ${(err as Error).message}`);
    return;
  }

  // Pin search_path at connection establishment (startup option, applied before
  // any query runs — no race under pool churn). Mirrors the comms test.
  scopedPool = new Pool({
    connectionString: DB_URL,
    options: `-c search_path="${TEST_SCHEMA}",public`,
    max: 4,
    connectionTimeoutMillis: 15000,
  });
  db = drizzle(scopedPool);

  // Seed the shared org/person/officer fixtures used across tests.
  if (dbReachable) {
    await insertOrg({ id: ORG_A, name: 'Acme Dental Assoc', slug: 'acme' });
    await insertOrg({ id: ORG_B, name: 'Beta Medical Society', slug: 'beta' });
    await insertPerson({ id: PERSON_1, firstName: 'Jane', lastName: 'Doe' });
    await insertPerson({ id: PERSON_2, firstName: 'Solo', lastName: null });
    await insertPerson({ id: OFFICER, firstName: 'Ofc', lastName: 'Treasurer' });
  }
});

afterAll(async () => {
  if (dbReachable) {
    try {
      const client = await setupPool.connect();
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      } finally {
        client.release();
      }
    } catch {
      /* best-effort cleanup */
    }
  }
  if (scopedPool) await scopedPool.end();
  if (setupPool) await setupPool.end();
});

// ─── PaymentTokenRepository ───────────────────────────────────────────────

describe('PaymentTokenRepository (real DB)', () => {
  test('create persists the token and returns the full row', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    const hash = `hash-create-${freshId()}`;
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);

    const row = await repo.create({
      tokenHash: hash,
      personId: PERSON_1,
      organizationId: ORG_A,
      amount: 50000,
      currency: 'PHP',
      expiresAt,
      createdByOfficer: OFFICER,
    } as any);

    expect(row.id).toBeTruthy();
    expect(row.tokenHash).toBe(hash);
    expect(row.personId).toBe(PERSON_1);
    expect(row.organizationId).toBe(ORG_A);
    expect(row.amount).toBe(50000);
    expect(row.usedAt).toBeNull();
  });

  test('findByTokenHash returns the row for a known hash, undefined otherwise', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    const hash = `hash-find-${freshId()}`;
    await repo.create({
      tokenHash: hash,
      personId: PERSON_1,
      organizationId: ORG_A,
      amount: 12000,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 3600_000),
      createdByOfficer: OFFICER,
    } as any);

    const found = await repo.findByTokenHash(hash);
    expect(found?.tokenHash).toBe(hash);
    expect(found?.amount).toBe(12000);

    expect(await repo.findByTokenHash(`missing-${freshId()}`)).toBeUndefined();
  });

  test('findByTokenHashWithDetails innerJoins person + org names', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    const hash = `hash-details-${freshId()}`;
    await repo.create({
      tokenHash: hash,
      personId: PERSON_1,
      organizationId: ORG_A,
      amount: 30000,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 3600_000),
      createdByOfficer: OFFICER,
    } as any);

    const details = await repo.findByTokenHashWithDetails(hash);
    expect(details).toBeTruthy();
    expect(details!.token.tokenHash).toBe(hash);
    expect(details!.memberName).toBe('Jane Doe');
    expect(details!.orgName).toBe('Acme Dental Assoc');
  });

  test('findByTokenHashWithDetails joins a null-lastName person to just the first name', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    const hash = `hash-details-solo-${freshId()}`;
    await repo.create({
      tokenHash: hash,
      personId: PERSON_2,
      organizationId: ORG_B,
      amount: 40000,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 3600_000),
      createdByOfficer: OFFICER,
    } as any);

    const details = await repo.findByTokenHashWithDetails(hash);
    expect(details!.memberName).toBe('Solo'); // null lastName filtered out
    expect(details!.orgName).toBe('Beta Medical Society');
  });

  test('findByTokenHashWithDetails returns undefined for an unknown hash', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    expect(await repo.findByTokenHashWithDetails(`nope-${freshId()}`)).toBeUndefined();
  });

  test('markUsed stamps usedAt on the token', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    const hash = `hash-markused-${freshId()}`;
    const created = await repo.create({
      tokenHash: hash,
      personId: PERSON_1,
      organizationId: ORG_A,
      amount: 25000,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 3600_000),
      createdByOfficer: OFFICER,
    } as any);
    expect(created.usedAt).toBeNull();

    const used = await repo.markUsed(created.id);
    expect(used?.id).toBe(created.id);
    expect(used?.usedAt).toBeInstanceOf(Date);

    // Re-read confirms persistence.
    const reread = await repo.findByTokenHash(hash);
    expect(reread?.usedAt).toBeInstanceOf(Date);
  });

  test('markUsed returns undefined for a missing id', async () => {
    if (!dbReachable) return;
    const repo = new PaymentTokenRepository(db as any);
    expect(await repo.markUsed(freshId())).toBeUndefined();
  });
});

// ─── DuesRepository — receipt sequence (money-critical atomicity) ──────────

describe('DuesRepository.getNextReceiptSequence (real DB)', () => {
  test('first call returns 1, subsequent calls increment sequentially', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const org = await insertOrg({ slug: 'seq-org' });
    const year = 2026;

    expect(await repo.getNextReceiptSequence(org, year)).toBe(1);
    expect(await repo.getNextReceiptSequence(org, year)).toBe(2);
    expect(await repo.getNextReceiptSequence(org, year)).toBe(3);
  });

  test('sequence is isolated per organization', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const orgX = await insertOrg({ slug: 'seq-x' });
    const orgY = await insertOrg({ slug: 'seq-y' });
    const year = 2026;

    expect(await repo.getNextReceiptSequence(orgX, year)).toBe(1);
    expect(await repo.getNextReceiptSequence(orgX, year)).toBe(2);
    // Different org starts its own sequence at 1.
    expect(await repo.getNextReceiptSequence(orgY, year)).toBe(1);
    expect(await repo.getNextReceiptSequence(orgX, year)).toBe(3);
  });

  test('sequence is isolated per year for the same org', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const org = await insertOrg({ slug: 'seq-year' });

    expect(await repo.getNextReceiptSequence(org, 2025)).toBe(1);
    expect(await repo.getNextReceiptSequence(org, 2026)).toBe(1);
    expect(await repo.getNextReceiptSequence(org, 2025)).toBe(2);
  });

  test('concurrent calls produce a unique, gap-free sequence (atomic upsert)', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const org = await insertOrg({ slug: 'seq-concurrent' });
    const year = 2027;

    const results = await Promise.all(
      Array.from({ length: 10 }, () => repo.getNextReceiptSequence(org, year)),
    );
    const sorted = [...results].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // No duplicates → no two receipts can collide.
    expect(new Set(results).size).toBe(10);
  });
});

// ─── DuesRepository — status transitions + financial audit trail ──────────

describe('DuesRepository.updatePaymentStatus (real DB)', () => {
  async function seedPayment(opts: { status?: string; receipt?: string } = {}): Promise<string> {
    const repo = new DuesRepository(db as any);
    const payment = await repo.createPayment({
      organizationId: ORG_A,
      personId: PERSON_1,
      receiptNumber: opts.receipt ?? `R-${freshId()}`,
      amount: 100000,
      currency: 'PHP',
      paymentMethod: 'cash',
      status: (opts.status ?? 'pending') as any,
    } as any);
    return payment.id;
  }

  test('valid transition updates status and writes a history row', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const id = await seedPayment({ status: 'pending' });

    const updated = await repo.updatePaymentStatus(id, 'pending', 'completed', { paidAt: new Date() }, OFFICER);
    expect(updated.status).toBe('completed');

    const history = await scopedPool.query(
      `SELECT from_status, to_status, changed_by FROM "${TEST_SCHEMA}".dues_payment_status_history WHERE payment_id = $1`,
      [id],
    );
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].from_status).toBe('pending');
    expect(history.rows[0].to_status).toBe('completed');
    expect(history.rows[0].changed_by).toBe(OFFICER);
  });

  test('history row captures refund/rejection reason from extra fields', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const id = await seedPayment({ status: 'completed' });

    await repo.updatePaymentStatus(
      id,
      'completed',
      'refunded',
      { refundReason: 'duplicate charge', refundedAmount: 100000, refundDate: new Date() },
      OFFICER,
    );

    const history = await scopedPool.query(
      `SELECT to_status, reason FROM "${TEST_SCHEMA}".dues_payment_status_history WHERE payment_id = $1 ORDER BY changed_at DESC LIMIT 1`,
      [id],
    );
    expect(history.rows[0].to_status).toBe('refunded');
    expect(history.rows[0].reason).toBe('duplicate charge');
  });

  test('invalid transition throws ConflictError and writes no history', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const id = await seedPayment({ status: 'pending' });

    // pending → refunded is NOT allowed (only completed/failed/expired are).
    await expect(repo.updatePaymentStatus(id, 'pending', 'refunded')).rejects.toBeInstanceOf(ConflictError);

    // Status unchanged, no audit row written.
    const payment = await repo.getPayment(id);
    expect(payment?.status).toBe('pending');
    const history = await scopedPool.query(
      `SELECT count(*)::int AS c FROM "${TEST_SCHEMA}".dues_payment_status_history WHERE payment_id = $1`,
      [id],
    );
    expect(history.rows[0].c).toBe(0);
  });

  test('transition from a terminal state throws', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const id = await seedPayment({ status: 'refunded' });
    // refunded is terminal → any transition rejected.
    await expect(repo.updatePaymentStatus(id, 'refunded', 'completed')).rejects.toBeInstanceOf(ConflictError);
  });
});

// ─── DuesRepository — cheap read/round-trip coverage ──────────────────────

describe('DuesRepository reads (real DB)', () => {
  test('getConfig returns undefined when none, then the upserted config', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const org = await insertOrg({ slug: 'config-org' });

    expect(await repo.getConfig(org)).toBeUndefined();

    await scopedPool.query(
      `INSERT INTO "${TEST_SCHEMA}".dues_org_config (organization_id, default_amount, currency, billing_frequency)
       VALUES ($1, 75000, 'PHP', 'annual')`,
      [org],
    );

    const config = await repo.getConfig(org);
    expect(config?.organizationId).toBe(org);
    expect(config?.defaultAmount).toBe(75000);
    expect(config?.billingFrequency).toBe('annual');
  });

  test('createPayment + getPayment round-trip preserves MONEY fields', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const created = await repo.createPayment({
      organizationId: ORG_A,
      personId: PERSON_1,
      receiptNumber: `RT-${freshId()}`,
      amount: 88800,
      currency: 'PHP',
      paymentMethod: 'gcash',
      status: 'completed' as any,
      paidAt: new Date(),
    } as any);

    const fetched = await repo.getPayment(created.id);
    expect(fetched?.amount).toBe(88800);
    expect(fetched?.currency).toBe('PHP');
    expect(fetched?.paymentMethod).toBe('gcash');
    expect(fetched?.status).toBe('completed');
  });

  test('listPayments filters by org + person, returns total and nested person', async () => {
    if (!dbReachable) return;
    const repo = new DuesRepository(db as any);
    const org = await insertOrg({ slug: 'list-org' });
    const person = await insertPerson({ firstName: 'List', lastName: 'Member' });

    for (let i = 0; i < 3; i++) {
      await repo.createPayment({
        organizationId: org,
        personId: person,
        receiptNumber: `L-${freshId()}`,
        amount: 10000 + i,
        currency: 'PHP',
        paymentMethod: 'cash',
        status: 'completed' as any,
        paidAt: new Date(Date.now() + i * 1000),
      } as any);
    }
    // A payment for a different person in the same org (excluded by personId filter).
    await repo.createPayment({
      organizationId: org,
      personId: PERSON_1,
      receiptNumber: `L-${freshId()}`,
      amount: 999,
      currency: 'PHP',
      paymentMethod: 'cash',
      status: 'completed' as any,
    } as any);

    const res = await repo.listPayments({ organizationId: org, personId: person });
    expect(res.total).toBe(3);
    expect(res.data).toHaveLength(3);
    expect(res.data[0]!.person).toEqual({ firstName: 'List', lastName: 'Member' });

    // Pagination caps the page but reports true total.
    const page = await repo.listPayments({ organizationId: org, personId: person, limit: 2, offset: 0 });
    expect(page.total).toBe(3);
    expect(page.data).toHaveLength(2);

    // Status filter narrows.
    const byStatus = await repo.listPayments({ organizationId: org, status: 'pending' });
    expect(byStatus.total).toBe(0);
  });
});
