/**
 * Real-Postgres integration tests for the person account-deletion + anonymization
 * lifecycle (DPA 2012 right-to-erasure / BR-32 financial-record retention).
 *
 * Before this file the person module had ZERO real-DB coverage of the deletion
 * path. The unit tests (requestMyAccountDeletion.test.ts / executeAccountDeletion.test.ts)
 * stub PersonRepository and hand-mock the `db.select()` chain, so they CANNOT prove:
 *   - the M2-R5 pending-payment guard actually queries dues_payment and blocks
 *     (the mock always returns `[]`, i.e. "no payments" — the guard is never
 *     exercised against real rows in the in/under-review states),
 *   - the M2-R5 sole-officer guard actually counts officer_term rows and blocks,
 *   - the 30-day grace arithmetic persists the right scheduledAt,
 *   - cancel clears the persisted deletion columns,
 *   - the deletion processor scrubs the FULL canonical PII column set field-by-field
 *     on a real row, sets deletionCompletedAt, is idempotent, and kills sessions,
 *   - and — the part a mock fundamentally cannot prove — that the person's
 *     dues_payment row SURVIVES anonymization (BR-32 7-year financial retention)
 *     while the person PII is scrubbed.
 *
 * This suite drives the REAL handlers + the REAL deletion processor against rows
 * in Postgres and asserts the REAL persisted state read back from the database —
 * never "did not throw".
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real column /
 * default / enum / NOT-NULL / CHECK is present — no hand-DDL drift. FKs are NOT
 * copied, so person / dues_payment / officer_term / session rows insert directly
 * without standing up every parent row. search_path is pinned via the libpq
 * startup option on the scoped pool.
 *
 * The cascade emit (`person.deleted`) is a no-op here: `registerDomainEventConsumers`
 * is only called during real app init (never in the test process), so the bus has
 * NO subscribers and `emit` returns immediately. That means the processor/handler
 * touch ONLY this suite's scratch schema (person + session) via the injected H.db —
 * they never run the cross-module cascade against the shared `public` schema.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres is
 * unreachable the suite skips cleanly (`if (!H.dbReachable) return`).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { requestMyAccountDeletion } from './requestMyAccountDeletion';
import { cancelMyAccountDeletion } from './cancelMyAccountDeletion';
import { processDeletions } from './jobs/deletionProcessor';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const POSITION_ID = '00000000-0000-4000-8000-0000000000d1';

function freshId(): string {
  return crypto.randomUUID();
}

// ─── Raw seeders (bypass the repo write-path so we can seed exact states) ────

/**
 * Insert a fully-populated person row directly via raw SQL and return its id.
 * Every real NOT-NULL-without-default column is set: first_name is the only
 * NOT NULL person column (id/timestamps/version come from defaults). We populate
 * the full canonical PII set so the scrub can be asserted field-by-field.
 */
async function insertPerson(opts: {
  id?: string;
  deletionRequestedAt?: Date | null;
  deletionScheduledAt?: Date | null;
  deletionCompletedAt?: Date | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person
       (id, first_name, last_name, middle_name, date_of_birth, gender,
        primary_address, contact_info, avatar, languages_spoken, timezone,
        license_number, specialization, prc_id, preferred_language, bio,
        deletion_requested_at, deletion_scheduled_at, deletion_completed_at)
     VALUES ($1,'Juan','Dela Cruz','Santos','1985-07-15','male'::gender,
        $2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,'Asia/Manila',
        'PRC-12345','Endodontics','PRC-12345','en','Practicing dentist in Manila, clinic at 123 Real St.',
        $6,$7,$8)`,
    [
      id,
      JSON.stringify({ street1: '123 Real St', city: 'Manila', state: 'NCR', postalCode: '1000', country: 'PH' }),
      JSON.stringify({ email: 'juan@example.com', phone: '+639171234567' }),
      JSON.stringify({ url: 'https://cdn.example.com/avatar/juan.png', file: freshId() }),
      JSON.stringify(['en', 'tl']),
      opts.deletionRequestedAt ?? null,
      opts.deletionScheduledAt ?? null,
      opts.deletionCompletedAt ?? null,
    ],
  );
  return id;
}

/** Read a single person row back from Postgres (bypassing the repo). */
async function readPerson(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".person WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/**
 * Insert a dues_payment row directly via raw SQL and return its id. Sets every
 * real NOT-NULL-without-default column (organization_id, person_id, receipt_number,
 * amount, payment_method) and casts the enum params. status defaults to 'pending'
 * unless overridden.
 */
async function insertDuesPayment(opts: {
  id?: string;
  personId: string;
  organizationId?: string;
  status?: 'pending' | 'submitted' | 'underReview' | 'confirmed' | 'completed' | 'rejected' | 'failed';
  amount?: number;
} = { personId: '' }): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_payment
       (id, organization_id, person_id, receipt_number, amount, payment_method, status)
     VALUES ($1,$2,$3,$4,$5,'gcash'::dues_payment_method,
             COALESCE($6::dues_payment_status,'pending'))`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId,
      `RCPT-${id.slice(0, 8)}`,
      opts.amount ?? 250000,
      opts.status ?? null,
    ],
  );
  return id;
}

/** Read a single dues_payment row back from Postgres. */
async function readDuesPayment(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".dues_payment WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/**
 * Insert an officer_term row directly. Sets every NOT-NULL-without-default column
 * (position_id, person_id, organization_id, start_date) and casts the status enum.
 * status defaults to 'upcoming' unless overridden.
 */
async function insertOfficerTerm(opts: {
  id?: string;
  personId: string;
  organizationId?: string;
  status?: 'upcoming' | 'active' | 'completed' | 'resigned' | 'removed';
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".officer_term
       (id, position_id, person_id, organization_id, status, start_date)
     VALUES ($1,$2,$3,$4,COALESCE($5::term_status,'upcoming'),now())`,
    [
      id,
      POSITION_ID,
      opts.personId,
      opts.organizationId ?? ORG_A,
      opts.status ?? null,
    ],
  );
  return id;
}

/** Insert a session row for a user (better-auth `session` table, text ids). */
async function insertSession(opts: { id?: string; userId: string }): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".session
       (id, expires_at, token, updated_at, user_id)
     VALUES ($1, now() + interval '7 days', $2, now(), $3)`,
    [id, `tok-${id}`, opts.userId],
  );
  return id;
}

async function countSessions(userId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".session WHERE user_id = $1`,
    [userId],
  );
  return rows[0].n;
}

// ─── ctx factory pinned to the real H.db ─────────────────────────────────────

/**
 * Build a handler ctx whose `database` is the REAL scratch-schema-pinned drizzle
 * instance (H.db). Mirrors makeCtx's get/set/json shape but swaps the mock db for
 * the real one so the handler's `db.select()...` guard queries run against actual
 * rows. The session user.id IS the personId under test.
 */
function ctxFor(personId: string) {
  const vars: Record<string, any> = {
    user: { id: personId, role: 'user' },
    session: { id: 'sess-1', userId: personId, user: { id: personId } },
    organizationId: ORG_A,
    database: H.db,
    logger: noopLogger,
    audit: null,
  };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      valid: () => ({}),
      param: () => '',
      header: () => null,
      json: () => Promise.resolve({}),
      query: () => null,
      raw: { headers: new Headers() },
    },
    header: () => {},
    json: (body: any, status: number) => ({ status, body }) as any as Response,
    body: (body: any, status: number) => ({ status, body }) as any as Response,
  } as any;
}

beforeAll(async () => {
  H = await createScratch(['person', 'dues_payment', 'officer_term', 'session']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// GUARD: requestMyAccountDeletion — M2-R5 pending-payment block (RED-TEST)
// ═══════════════════════════════════════════════════════════════════════════

describe('requestMyAccountDeletion — PENDING_PAYMENTS guard (real DB)', () => {
  // Each of the three in-flight statuses must independently block deletion.
  for (const status of ['pending', 'submitted', 'underReview'] as const) {
    test(`BLOCKS with 422 PENDING_PAYMENTS when the person has a ${status} dues payment`, async () => {
      if (!H.dbReachable) return;
      const personId = await insertPerson();
      // Seed a REAL in-flight dues payment in this status.
      await insertDuesPayment({ personId, status });

      const ctx = ctxFor(personId);

      // CORRECT behavior: the handler must refuse with a 422 BusinessLogicError
      // carrying code PENDING_PAYMENTS. If it instead schedules the deletion,
      // the guard silently let an in-flight financial obligation be abandoned —
      // a REAL bug — and this assertion FAILS (RED), flagging it.
      let thrown: any = null;
      try {
        await requestMyAccountDeletion(ctx);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).not.toBeNull();
      expect(thrown?.code).toBe('PENDING_PAYMENTS');
      // 422-class business logic error (Unprocessable Entity).
      expect(thrown?.statusCode ?? thrown?.status).toBe(422);

      // And the deletion columns must NOT have been stamped.
      const row = await readPerson(personId);
      expect(row.deletion_requested_at).toBeNull();
      expect(row.deletion_scheduled_at).toBeNull();
    });
  }

  test('a terminal/settled payment (completed) does NOT block deletion', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();
    // Only a settled payment exists — must not trip the in-flight guard.
    await insertDuesPayment({ personId, status: 'completed' });

    const res = await requestMyAccountDeletion(ctxFor(personId));
    expect(res.status).toBe(202);

    const row = await readPerson(personId);
    expect(row.deletion_requested_at).not.toBeNull();
    expect(row.deletion_scheduled_at).not.toBeNull();
  });

  test('another person\'s in-flight payment does NOT block this person', async () => {
    if (!H.dbReachable) return;
    const me = await insertPerson();
    const other = await insertPerson();
    // The in-flight payment belongs to someone else.
    await insertDuesPayment({ personId: other, status: 'submitted' });

    const res = await requestMyAccountDeletion(ctxFor(me));
    expect(res.status).toBe(202);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GUARD: requestMyAccountDeletion — M2-R5 sole-active-officer block (RED-TEST)
// ═══════════════════════════════════════════════════════════════════════════

describe('requestMyAccountDeletion — SOLE_OFFICER guard (real DB)', () => {
  test('BLOCKS with 422 SOLE_OFFICER when the person is the only active officer in an org', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();
    // Seed a REAL active officer term — the org's active-officer count is 1.
    await insertOfficerTerm({ personId, organizationId: ORG_A, status: 'active' });

    const ctx = ctxFor(personId);

    // CORRECT behavior: refuse with 422 / SOLE_OFFICER. If the handler lets a
    // sole officer delete (leaving the org leaderless), that's a REAL bug and
    // this assertion FAILS (RED), flagging it.
    let thrown: any = null;
    try {
      await requestMyAccountDeletion(ctx);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe('SOLE_OFFICER');
    expect(thrown?.statusCode ?? thrown?.status).toBe(422);

    const row = await readPerson(personId);
    expect(row.deletion_requested_at).toBeNull();
  });

  test('does NOT block when a co-officer keeps the org covered (count >= 2)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();
    const coOfficer = await insertPerson();
    // Two active officers in the same org → deletion of one is allowed.
    await insertOfficerTerm({ personId, organizationId: ORG_A, status: 'active' });
    await insertOfficerTerm({ personId: coOfficer, organizationId: ORG_A, status: 'active' });

    const res = await requestMyAccountDeletion(ctxFor(personId));
    expect(res.status).toBe(202);
  });

  test('a non-active (resigned) term does NOT count as holding the org', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();
    // Person's only term is resigned → they are not an active officer at all,
    // so the sole-officer guard must not fire.
    await insertOfficerTerm({ personId, organizationId: ORG_B, status: 'resigned' });

    const res = await requestMyAccountDeletion(ctxFor(personId));
    expect(res.status).toBe(202);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// requestMyAccountDeletion — 30-day grace arithmetic + 202 + idempotency
// ═══════════════════════════════════════════════════════════════════════════

describe('requestMyAccountDeletion — 30-day grace (real DB)', () => {
  test('returns 202 and persists deletionScheduledAt == requestedAt + 30 days', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();

    const before = Date.now();
    const res = await requestMyAccountDeletion(ctxFor(personId));
    const after = Date.now();

    expect(res.status).toBe(202);
    expect((res as any).body.requestedAt).toBeTruthy();
    expect((res as any).body.scheduledAt).toBeTruthy();

    // The persisted columns are the source of truth — read them back.
    const row = await readPerson(personId);
    const requestedAt = new Date(row.deletion_requested_at).getTime();
    const scheduledAt = new Date(row.deletion_scheduled_at).getTime();

    // requestedAt was stamped "now" (within the call window).
    expect(requestedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(requestedAt).toBeLessThanOrEqual(after + 1000);

    // The exact 30-day arithmetic: scheduledAt - requestedAt == 30 days, to the ms.
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    expect(scheduledAt - requestedAt).toBe(THIRTY_DAYS_MS);
  });

  test('a second request while one is pending is rejected (DELETION_ALREADY_REQUESTED)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();
    await requestMyAccountDeletion(ctxFor(personId)); // first request → scheduled

    let thrown: any = null;
    try {
      await requestMyAccountDeletion(ctxFor(personId));
    } catch (e) {
      thrown = e;
    }
    expect(thrown?.code).toBe('DELETION_ALREADY_REQUESTED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// cancelMyAccountDeletion — clears the persisted deletion columns
// ═══════════════════════════════════════════════════════════════════════════

describe('cancelMyAccountDeletion (real DB)', () => {
  test('clears deletionRequestedAt + deletionScheduledAt on a pending request', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson();
    // Request first so there is something to cancel.
    await requestMyAccountDeletion(ctxFor(personId));
    expect((await readPerson(personId)).deletion_requested_at).not.toBeNull();

    const res = await cancelMyAccountDeletion(ctxFor(personId));
    expect(res.status).toBe(200);

    // Both deletion columns are cleared in the persisted row.
    const row = await readPerson(personId);
    expect(row.deletion_requested_at).toBeNull();
    expect(row.deletion_scheduled_at).toBeNull();
    expect(row.deletion_completed_at).toBeNull();
  });

  test('rejects (NO_DELETION_REQUEST) when no deletion is pending', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson(); // never requested

    let thrown: any = null;
    try {
      await cancelMyAccountDeletion(ctxFor(personId));
    } catch (e) {
      thrown = e;
    }
    expect(thrown?.code).toBe('NO_DELETION_REQUEST');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deletionProcessor (DPA-02) — field-by-field PII scrub + idempotency + sessions
// ═══════════════════════════════════════════════════════════════════════════

describe('processDeletions — anonymization (real DB)', () => {
  test('anonymizes the FULL canonical PII set field-by-field on an overdue row', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({
      // Overdue: scheduled in the past, not yet completed.
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      deletionScheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      deletionCompletedAt: null,
    });

    const result = await processDeletions({ db: H.db as any, logger: noopLogger });
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);

    const row = await readPerson(personId);

    // Names overwritten with the DELETED sentinel.
    expect(row.first_name).toBe('DELETED');
    expect(row.last_name).toBe('DELETED');
    expect(row.middle_name).toBeNull();

    // Contact info scrubbed to the canonical tombstone (email replaced, phone gone).
    expect(row.contact_info).toEqual({ email: 'deleted@deleted.invalid' });

    // The full nulled PII set.
    expect(row.primary_address).toBeNull();
    expect(row.avatar).toBeNull();
    expect(row.languages_spoken).toBeNull();
    expect(row.timezone).toBeNull();
    expect(row.license_number).toBeNull();
    expect(row.specialization).toBeNull();
    expect(row.prc_id).toBeNull();
    expect(row.preferred_language).toBeNull();
    // DATE column — assert null (no TZ ambiguity on a nulled value).
    expect(row.date_of_birth).toBeNull();
    // bio + gender are part of the canonical scrub set (FIX-002 / Q-4).
    expect(row.bio).toBeNull();
    expect(row.gender).toBeNull();

    // Completion stamped. updated_by is null: the scrub is a system/cron action with
    // no user actor, and updated_by is a uuid column (the old literal 'system' threw
    // 22P02 and silently aborted every deletion — see anonymize-person.ts).
    expect(row.deletion_completed_at).not.toBeNull();
    expect(row.updated_by).toBeNull();
  });

  test('only processes rows where scheduledAt < now AND completedAt IS NULL', async () => {
    if (!H.dbReachable) return;
    // (a) overdue + not completed → scrubbed.
    const overdue = await insertPerson({
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      deletionScheduledAt: new Date(Date.now() - 60 * 1000),
      deletionCompletedAt: null,
    });
    // (b) scheduled in the FUTURE → grace not expired → untouched.
    const future = await insertPerson({
      deletionRequestedAt: new Date(),
      deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deletionCompletedAt: null,
    });
    // (c) no deletion request at all → untouched.
    const none = await insertPerson();

    await processDeletions({ db: H.db as any, logger: noopLogger });

    expect((await readPerson(overdue)).first_name).toBe('DELETED');
    // Untouched rows keep their real PII.
    expect((await readPerson(future)).first_name).toBe('Juan');
    expect((await readPerson(none)).first_name).toBe('Juan');
  });

  test('is idempotent — an already-completed row is skipped (not re-scrubbed)', async () => {
    if (!H.dbReachable) return;
    const completedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const personId = await insertPerson({
      deletionRequestedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      deletionScheduledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      // Already anonymized previously.
      deletionCompletedAt: completedAt,
    });

    const before = await readPerson(personId);
    const result = await processDeletions({ db: H.db as any, logger: noopLogger });

    // This already-completed person must NOT be re-processed.
    const after = await readPerson(personId);
    // completedAt is unchanged (no second scrub re-stamped it).
    expect(new Date(after.deletion_completed_at).getTime())
      .toBe(new Date(before.deletion_completed_at).getTime());
    // (Sanity) the row was already in its prior state; first_name unchanged.
    expect(after.first_name).toBe(before.first_name);
    // The completed row is not counted among the rows this run touched.
    // (result.processed only includes rows the WHERE clause selected.)
    expect(result.processed).toBe(0);
  });

  test('kills the person\'s sessions BEFORE scrubbing (no live session survives erasure)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      deletionScheduledAt: new Date(Date.now() - 60 * 1000),
      deletionCompletedAt: null,
    });
    // Two live sessions for this user, plus one for a bystander that must survive.
    await insertSession({ userId: personId });
    await insertSession({ userId: personId });
    const bystander = await insertPerson();
    await insertSession({ userId: bystander });

    expect(await countSessions(personId)).toBe(2);

    await processDeletions({ db: H.db as any, logger: noopLogger });

    // All of THIS user's sessions are deleted; the row is scrubbed.
    expect(await countSessions(personId)).toBe(0);
    expect((await readPerson(personId)).first_name).toBe('DELETED');
    // The bystander's session is untouched (delete was user-scoped).
    expect(await countSessions(bystander)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL RETENTION (BR-32) — the dues_payment row SURVIVES anonymization.
// A mock DB can never prove this: there is no real row to retain. Only a real
// cross-table read-back after a real scrub proves PII is erased while the
// financial record is preserved with the (now-anonymized) person FK intact.
// ═══════════════════════════════════════════════════════════════════════════

describe('processDeletions — financial-record retention (real DB)', () => {
  test('scrubs person PII but RETAINS the dues_payment row (anonymized FK preserved)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      deletionScheduledAt: new Date(Date.now() - 60 * 1000),
      deletionCompletedAt: null,
    });
    // A SETTLED financial record (does not block deletion, must be retained 7 yrs).
    const paymentId = await insertDuesPayment({ personId, status: 'completed', amount: 350000 });

    await processDeletions({ db: H.db as any, logger: noopLogger });

    // Person PII is erased…
    const person = await readPerson(personId);
    expect(person.first_name).toBe('DELETED');
    expect(person.contact_info).toEqual({ email: 'deleted@deleted.invalid' });
    expect(person.deletion_completed_at).not.toBeNull();

    // …but the financial record STILL EXISTS, unmodified, with the FK still
    // pointing at the now-anonymized person (so receipts/audits still resolve).
    const payment = await readDuesPayment(paymentId);
    expect(payment).toBeDefined();
    expect(payment.id).toBe(paymentId);
    expect(payment.person_id).toBe(personId);
    expect(payment.amount).toBe(350000);
    expect(payment.status).toBe('completed');
  });

  test('multiple financial rows for the person all survive a single anonymization', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      deletionScheduledAt: new Date(Date.now() - 60 * 1000),
      deletionCompletedAt: null,
    });
    const p1 = await insertDuesPayment({ personId, status: 'completed', amount: 100000 });
    const p2 = await insertDuesPayment({ personId, status: 'refunded' as any, amount: 200000 });

    await processDeletions({ db: H.db as any, logger: noopLogger });

    expect((await readPerson(personId)).first_name).toBe('DELETED');
    // Both financial rows are retained.
    expect((await readDuesPayment(p1)).id).toBe(p1);
    expect((await readDuesPayment(p2)).id).toBe(p2);
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".dues_payment WHERE person_id = $1`,
      [personId],
    );
    expect(rows[0].n).toBe(2);
  });
});
