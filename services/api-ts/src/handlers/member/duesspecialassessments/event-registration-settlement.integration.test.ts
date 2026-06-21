/**
 * Real-DB integration test for the INTER-MODULE event-registration settlement
 * branch of `createProcessPayment` (handlers/member/duesspecialassessments/jobs/
 * processStripePayment.ts).
 *
 * The webhook retry processor settles online Stripe payments. When the payment's
 * `metadata.type === 'event_registration'` it takes a dedicated branch that
 * carries NO orgId / paymentId — it settles by stamping `paid_at` on the real
 * `event_registration` row owned by the OTHER module
 * (handlers/association:operations, via EventRegistrationRepository). That
 * cross-module effect (dues-domain webhook → operations-domain row) had no
 * real-PG coverage; the existing online-payment-ledger.integration.test.ts only
 * drives the dues-ledger path (metadata.paymentId) with the DB fully stubbed.
 *
 * This suite drives the actual `createProcessPayment` closure with the DB REAL
 * (the events.repo EventRegistrationRepository runs its real Drizzle
 * findOneById/updateOneById against Postgres) and asserts the REAL persisted
 * row state read back from the table:
 *   - paid_at goes from NULL → stamped (the cross-module effect)
 *   - updated_by is set to the registration's person_id (handler's stamp)
 *   - version is bumped + updated_at advances (base-repo updateOneById side effects)
 *   - status / registered_at / org / event are untouched
 *   - idempotency: a second settle of an already-paid row does NOT re-stamp
 *     paid_at, does NOT bump version again
 *   - the no-registration-row case raises (throws), not a silent success
 *   - returns { success: true } on the happy path
 *
 * Stripe is the only thing mocked (billing) — it is never even invoked on this
 * branch (no capture, no settle), so we pass a throwing billing/settle to PROVE
 * the branch returns before touching them. The DB stays real.
 *
 * Isolation: the shared `createScratch` harness copies the real public
 * `event_registration` structure via `CREATE TABLE … (LIKE … INCLUDING ALL)`,
 * so every real column / enum / default / NOT NULL is present (no hand-DDL
 * drift). FKs are not copied, so a registration row inserts without parent
 * org/event/person rows. Skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import type { Logger } from 'pino';
import { createProcessPayment } from './jobs/processStripePayment';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
} as unknown as Logger;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';

function freshId(): string {
  return crypto.randomUUID();
}

/** What an inserted registration carries — captured per-test for assertions. */
interface InsertedReg {
  id: string;
  organizationId: string;
  eventId: string;
  personId: string;
}

/**
 * Billing + settle deps that EXPLODE if invoked. The event_registration branch
 * returns before either is reached, so any call here is a real regression —
 * this is how we prove the branch is self-contained (no Stripe capture, no
 * dues settle) rather than asserting a weaker "did not throw".
 */
const explodingBilling = {
  capturePaymentIntent: async () => {
    throw new Error('billing.capturePaymentIntent must NOT be called on the event_registration branch');
  },
  createPaymentIntent: async () => {
    throw new Error('billing.createPaymentIntent must NOT be called on the event_registration branch');
  },
} as any;

const explodingSettle = (async () => {
  throw new Error('settlePayment must NOT be called on the event_registration branch');
}) as any;

/**
 * Insert an event_registration row directly via raw SQL and return the ids it
 * carries. Raw SQL lets us seed arbitrary paid_at / status / version combos the
 * repo write-path wouldn't normally produce, so the settle branch is proven
 * against adversarial pre-state. We set every real NOT-NULL-without-default
 * column (id, organization_id, event_id, person_id) and rely on table defaults
 * for status ('confirmed'), registered_at (now), version (1), created_at/updated_at.
 *
 * The real public.event_registration table carries a partial UNIQUE index on
 * (event_id, person_id) — copied by `LIKE … INCLUDING ALL` into the scratch
 * schema. So each row needs a DISTINCT (event_id, person_id) pair; we default
 * BOTH to fresh per-call UUIDs (overridable). The caller captures the returned
 * ids and asserts the real row's persisted state back against them.
 *
 * `status` is a real Postgres enum (registration_status); a bound $N enum param
 * needs an explicit ::registration_status cast (literals auto-cast, params do not).
 */
async function insertRegistration(opts: {
  id?: string;
  organizationId?: string;
  eventId?: string;
  personId?: string;
  status?: 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded' | 'noShow';
  paidAt?: Date | null;
} = {}): Promise<InsertedReg> {
  const id = opts.id ?? freshId();
  const organizationId = opts.organizationId ?? ORG_A;
  const eventId = opts.eventId ?? freshId();
  const personId = opts.personId ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".event_registration
       (id, organization_id, event_id, person_id, status, paid_at)
     VALUES ($1,$2,$3,$4,COALESCE($5::registration_status,'confirmed'),$6)`,
    [
      id,
      organizationId,
      eventId,
      personId,
      opts.status ?? null,
      opts.paidAt ?? null,
    ],
  );
  return { id, organizationId, eventId, personId };
}

/** Read back the full persisted row for assertions. */
async function readRow(id: string): Promise<{
  id: string;
  organization_id: string;
  event_id: string;
  person_id: string;
  status: string;
  paid_at: string | null;
  registered_at: string | null;
  updated_by: string | null;
  version: number;
  updated_at: string;
} | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, organization_id, event_id, person_id, status,
            paid_at, registered_at, updated_by, version, updated_at
       FROM "${H.schema}".event_registration WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/**
 * Build the event_registration-typed Stripe PaymentIntent payload for a real
 * inserted row. Settlement keys off metadata.registrationId; eventId/personId
 * here are carried for logging only (the handler stamps updated_by from the
 * ROW's own person_id, not from metadata).
 */
function eventRegPayload(reg: InsertedReg, extra: Record<string, string> = {}) {
  return {
    id: 'pi_evt_' + reg.id.slice(0, 8),
    status: 'succeeded',
    metadata: {
      type: 'event_registration',
      eventId: reg.eventId,
      registrationId: reg.id,
      personId: reg.personId,
      ...extra,
    },
  } as Record<string, unknown>;
}

beforeAll(async () => {
  H = await createScratch(['event_registration']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('processStripePayment — event_registration settlement (inter-module: dues webhook → operations event_registration)', () => {
  test('stamps paid_at on the real unpaid registration row + sets updated_by + bumps version', async () => {
    if (!H.dbReachable) return;

    const reg = await insertRegistration({ paidAt: null });

    const before = await readRow(reg.id);
    expect(before?.paid_at).toBeNull();
    expect(before?.version).toBe(1);
    const beforeUpdatedAt = before!.updated_at;

    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );

    const result = await processPayment(eventRegPayload(reg));
    expect(result).toEqual({ success: true });

    // The cross-module effect: paid_at is now stamped on the operations-owned row.
    const after = await readRow(reg.id);
    expect(after).toBeDefined();
    expect(after!.paid_at).not.toBeNull();

    // Handler stamps updated_by = the registration's own person_id.
    expect(after!.updated_by).toBe(reg.personId);

    // base-repo updateOneById side effects: version + updated_at advance.
    expect(after!.version).toBe(2);
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeUpdatedAt).getTime(),
    );

    // Untouched fields stay put — no scope/state drift from the settle.
    expect(after!.status).toBe('confirmed');
    expect(after!.organization_id).toBe(reg.organizationId);
    expect(after!.event_id).toBe(reg.eventId);
    expect(after!.person_id).toBe(reg.personId);
    expect(after!.registered_at).not.toBeNull();
  });

  test('paid_at is set to a sane recent timestamp (close to now)', async () => {
    if (!H.dbReachable) return;

    const reg = await insertRegistration({ paidAt: null });
    const t0 = Date.now();

    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );
    await processPayment(eventRegPayload(reg));
    const t1 = Date.now();

    const after = await readRow(reg.id);
    const paidAtMs = new Date(after!.paid_at as string).getTime();
    // Stamped during the call window (allow generous clock skew on either side).
    expect(paidAtMs).toBeGreaterThanOrEqual(t0 - 5000);
    expect(paidAtMs).toBeLessThanOrEqual(t1 + 5000);
  });

  test('idempotent: settling an ALREADY-paid registration does NOT re-stamp paid_at or bump version', async () => {
    if (!H.dbReachable) return;

    const originalPaidAt = new Date('2026-03-01T08:30:00.000Z');
    const reg = await insertRegistration({ paidAt: originalPaidAt });

    const before = await readRow(reg.id);
    expect(before?.paid_at).not.toBeNull();
    const beforePaidAtMs = new Date(before!.paid_at as string).getTime();
    expect(before!.version).toBe(1);

    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );

    const result = await processPayment(eventRegPayload(reg));
    expect(result).toEqual({ success: true });

    const after = await readRow(reg.id);
    // Same paid_at instant — the `if (!registration.paidAt)` guard skipped the write.
    expect(new Date(after!.paid_at as string).getTime()).toBe(beforePaidAtMs);
    // No updateOneById ran → version stays 1, updated_by stays untouched (null).
    expect(after!.version).toBe(1);
    expect(after!.updated_by).toBeNull();
  });

  test('throws when the registration row does not exist (no silent success)', async () => {
    if (!H.dbReachable) return;

    const missingId = freshId();
    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );

    // A well-formed event_registration payload whose registrationId points at
    // no row — the row was never inserted.
    const missingReg: InsertedReg = {
      id: missingId,
      organizationId: ORG_A,
      eventId: freshId(),
      personId: freshId(),
    };

    await expect(processPayment(eventRegPayload(missingReg))).rejects.toThrow(
      `No event_registration row for registrationId=${missingId}`,
    );
  });

  test('throws when metadata.registrationId is missing', async () => {
    if (!H.dbReachable) return;

    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );

    const payload = {
      id: 'pi_evt_no_reg',
      status: 'succeeded',
      metadata: {
        type: 'event_registration',
        eventId: freshId(),
        personId: freshId(),
      },
    } as Record<string, unknown>;

    await expect(processPayment(payload)).rejects.toThrow(
      'Missing metadata.registrationId for event_registration payment',
    );
  });

  test('settles by the real row even when payload PaymentIntent id is absent but metadata.payment_intent is present', async () => {
    if (!H.dbReachable) return;

    // The branch resolves paymentIntentId from id ?? payment_intent purely for
    // logging; settlement keys off metadata.registrationId. Prove the row still
    // settles when only `payment_intent` (not `id`) is supplied.
    const reg = await insertRegistration({ paidAt: null });

    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );

    const payload = {
      payment_intent: 'pi_evt_alt',
      status: 'succeeded',
      metadata: {
        type: 'event_registration',
        eventId: reg.eventId,
        registrationId: reg.id,
        personId: reg.personId,
      },
    } as Record<string, unknown>;

    const result = await processPayment(payload);
    expect(result).toEqual({ success: true });

    const after = await readRow(reg.id);
    expect(after!.paid_at).not.toBeNull();
    expect(after!.version).toBe(2);
  });

  test('two distinct registrations settle independently (no cross-row bleed)', async () => {
    if (!H.dbReachable) return;

    // Two rows with DISTINCT person_ids (and distinct fresh event_ids), so the
    // (event_id, person_id) unique index admits both.
    const regA = await insertRegistration({ paidAt: null });
    const regB = await insertRegistration({ paidAt: null });
    expect(regA.personId).not.toBe(regB.personId);

    const processPayment = createProcessPayment(
      explodingBilling,
      H.db as any,
      noopLogger,
      explodingSettle,
    );

    await processPayment(eventRegPayload(regA));

    // Only A is settled; B remains pending.
    const afterA = await readRow(regA.id);
    const afterB = await readRow(regB.id);
    expect(afterA!.paid_at).not.toBeNull();
    expect(afterA!.updated_by).toBe(regA.personId);
    expect(afterB!.paid_at).toBeNull();
    expect(afterB!.version).toBe(1);

    // Now settle B; its updated_by reflects B's own person_id, not A's.
    await processPayment(eventRegPayload(regB));
    const afterB2 = await readRow(regB.id);
    expect(afterB2!.paid_at).not.toBeNull();
    expect(afterB2!.updated_by).toBe(regB.personId);
  });
});
