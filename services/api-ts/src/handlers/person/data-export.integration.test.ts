/**
 * Real-Postgres integration tests for the DPA-2012 / GDPR data-portability
 * export feature: the sync export (GET /export — `exportMyData`), the async
 * export (POST /persons/me/data-export — `requestDataExport`), the download
 * endpoint (GET /persons/me/data-export/:id/download — `getDataExportDownload`),
 * and the shared envelope builder (`utils/build-data-export.ts`).
 *
 * The existing sibling unit tests (exportMyData.test.ts, requestDataExport.test.ts,
 * getDataExportStatus.test.ts) stub PersonRepository / MembershipRepository /
 * CreditEntryRepository and feed a hand-rolled thenable "Drizzle" db. They prove
 * the handler's branch logic but NEVER run the real aggregation SQL — so they
 * cannot catch:
 *   - a join that silently drops a category (memberships/payments/credits/
 *     notifications/certificates) because the WHERE column was wrong,
 *   - drift between the sync GET /export body and the stored async payload
 *     (the exact FIX-008 hazard buildMyDataExport was created to remove),
 *   - an ownership leak in the download endpoint (row.personId !== caller),
 *   - a not-ready / expired-TTL guard that does NOT fire,
 *   - a rate-limit ledger that is NOT actually shared across sync + async.
 *
 * This suite drives the REAL handlers + real builder against REAL rows in a
 * per-suite scratch schema (LIKE public.<t> INCLUDING ALL — real columns / enums
 * / defaults), and asserts the REAL returned data and persisted row state — never
 * "did not throw".
 *
 * Isolation: shared `createScratch` harness. FKs are NOT copied by LIKE, so we
 * seed person/membership/credit/payment/certificate/notification/data_export rows
 * directly without standing up parent org rows. The handlers run against H.db
 * (drizzle pinned to the scratch search_path), so their own inserts/updates into
 * data_export land in the scratch schema too. External services (audit) are
 * inert because makeCtx supplies no `audit` (auditAction early-returns), and the
 * domain-event emit in requestDataExport is fire-and-forget.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly.
 *
 * Target: handlers/person/exportMyData.ts, requestDataExport.ts,
 *         getDataExportDownload.ts, utils/build-data-export.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { buildMyDataExport } from './utils/build-data-export';
import { exportMyData } from './exportMyData';
import { requestDataExport } from './requestDataExport';
import { getDataExportDownload } from './getDataExportDownload';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return noopLogger; } } as any;

function freshId(): string {
  return crypto.randomUUID();
}

// A wide CPD cycle window that contains the seeded activity dates.
const CYCLE_START = new Date('2026-01-01T00:00:00.000Z');
const CYCLE_END = new Date('2026-12-31T23:59:59.000Z');

// ─── Raw seed helpers (set every real NOT-NULL-without-default column) ──────

async function insertPerson(opts: {
  id?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string; // 'YYYY-MM-DD'
  gender?: 'male' | 'female' | 'non-binary' | 'other' | 'prefer-not-to-say' | null;
  primaryAddress?: Record<string, unknown> | null;
  contactInfo?: Record<string, unknown> | null;
  avatar?: Record<string, unknown> | null;
  languagesSpoken?: string[] | null;
  timezone?: string | null;
  licenseNumber?: string | null;
  specialization?: string | null;
  prcId?: string | null;
  preferredLanguage?: string | null;
  bio?: string | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person
       (id, first_name, last_name, middle_name, date_of_birth, gender,
        primary_address, contact_info, avatar, languages_spoken, timezone,
        license_number, specialization, prc_id, preferred_language, bio)
     VALUES ($1,$2,$3,$4,$5,$6::gender,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
             $11,$12,$13,$14,$15,$16)`,
    [
      id,
      opts.firstName ?? 'Alice',
      'lastName' in opts ? opts.lastName : 'Santos',
      'middleName' in opts ? opts.middleName : 'M',
      'dateOfBirth' in opts ? opts.dateOfBirth : '1990-03-15',
      'gender' in opts ? opts.gender : 'female',
      'primaryAddress' in opts ? JSON.stringify(opts.primaryAddress) : JSON.stringify({ city: 'Manila', country: 'PH' }),
      'contactInfo' in opts ? JSON.stringify(opts.contactInfo) : JSON.stringify({ email: 'alice@example.com', phone: '+639171234567' }),
      'avatar' in opts ? (opts.avatar == null ? null : JSON.stringify(opts.avatar)) : null,
      'languagesSpoken' in opts ? (opts.languagesSpoken == null ? null : JSON.stringify(opts.languagesSpoken)) : JSON.stringify(['en', 'tl']),
      'timezone' in opts ? opts.timezone : 'Asia/Manila',
      'licenseNumber' in opts ? opts.licenseNumber : 'PRC-12345',
      'specialization' in opts ? opts.specialization : 'Cardiology',
      'prcId' in opts ? opts.prcId : 'PRC-TOPLEVEL-99999',
      'preferredLanguage' in opts ? opts.preferredLanguage : 'en',
      'bio' in opts ? opts.bio : 'Cardiologist with 10 years experience',
    ],
  );
  return id;
}

async function insertMembership(opts: {
  id?: string;
  personId: string;
  organizationId?: string;
  tierId?: string;
  memberNumber?: string;
  startDate?: string; // 'YYYY-MM-DD'
  status?: string;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, member_number, start_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::membership_status)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.personId,
      opts.tierId ?? freshId(),
      opts.memberNumber ?? `MBR-${id.slice(0, 8)}`,
      opts.startDate ?? '2026-01-01',
      opts.status ?? 'active',
    ],
  );
  return id;
}

async function insertCredit(opts: {
  id?: string;
  personId: string;
  organizationId?: string;
  type?: 'auto' | 'manual';
  activityName?: string;
  activityDate?: Date;
  creditAmount?: number;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  status?: 'active' | 'voided' | 'disputed';
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".credit_entry
       (id, person_id, organization_id, type, activity_name, activity_date,
        credit_amount, cycle_start, cycle_end, verification_status, status)
     VALUES ($1,$2,$3,$4::credit_entry_type,$5,$6,$7,$8,$9,
             $10::credit_verification_status,$11::credit_status)`,
    [
      id,
      opts.personId,
      opts.organizationId ?? freshId(),
      opts.type ?? 'manual',
      opts.activityName ?? 'CPD Seminar',
      opts.activityDate ?? new Date('2026-06-01T00:00:00.000Z'),
      opts.creditAmount ?? 2.5,
      CYCLE_START,
      CYCLE_END,
      opts.verificationStatus ?? 'verified',
      opts.status ?? 'active',
    ],
  );
  return id;
}

async function insertPayment(opts: {
  id?: string;
  personId: string;
  organizationId?: string;
  receiptNumber?: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_payment
       (id, organization_id, person_id, receipt_number, amount, payment_method, status)
     VALUES ($1,$2,$3,$4,$5,$6::dues_payment_method,$7::dues_payment_status)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.personId,
      opts.receiptNumber ?? `RCT-${id.slice(0, 8)}`,
      opts.amount ?? 150000,
      opts.paymentMethod ?? 'online',
      opts.status ?? 'completed',
    ],
  );
  return id;
}

async function insertCertificate(opts: {
  id?: string;
  personId: string;
  organizationId?: string;
  certificateNumber?: string;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".certificate
       (id, organization_id, person_id, certificate_number)
     VALUES ($1,$2,$3,$4)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.personId,
      opts.certificateNumber ?? `CERT-${id.slice(0, 8)}`,
    ],
  );
  return id;
}

async function insertNotification(opts: {
  id?: string;
  recipient: string;
  organizationId?: string;
  type?: string;
  channel?: string;
  title?: string;
  message?: string;
  status?: string;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".notification
       (id, organization_id, recipient_id, type, channel, title, message, status)
     VALUES ($1,$2,$3,$4::notification_type,$5::notification_channel,$6,$7,
             $8::notification_status)`,
    [
      id,
      opts.organizationId ?? freshId(),
      opts.recipient,
      opts.type ?? 'system',
      opts.channel ?? 'in-app',
      opts.title ?? 'Welcome',
      opts.message ?? 'Welcome to the association',
      opts.status ?? 'sent',
    ],
  );
  return id;
}

/**
 * Insert a data_export ledger row directly. Lets us seed arbitrary
 * status/payload/expiresAt/personId/requestedAt combinations the handler write
 * path wouldn't normally produce, so the download guards + the shared rate-limit
 * window can be proven against adversarial data.
 */
async function insertDataExport(opts: {
  id?: string;
  personId: string;
  status?: 'requested' | 'processing' | 'ready' | 'failed' | 'expired';
  payload?: Record<string, unknown> | null;
  downloadUrl?: string | null;
  expiresAt?: Date | null;
  requestedAt?: Date;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".data_export
       (id, person_id, status, payload, download_url, expires_at, requested_at)
     VALUES ($1,$2,$3::data_export_status,$4::jsonb,$5,$6,$7)`,
    [
      id,
      opts.personId,
      opts.status ?? 'ready',
      opts.payload === undefined ? null : (opts.payload == null ? null : JSON.stringify(opts.payload)),
      'downloadUrl' in opts ? opts.downloadUrl : null,
      'expiresAt' in opts ? opts.expiresAt : null,
      opts.requestedAt ?? new Date(),
    ],
  );
  return id;
}

/** Read a single data_export row back from Postgres (bypassing the repo). */
async function readDataExport(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".data_export WHERE id = $1`,
    [id],
  );
  return rows[0];
}

function countExports(personId: string): Promise<number> {
  return H.scopedPool
    .query(`SELECT count(*)::int AS n FROM "${H.schema}".data_export WHERE person_id = $1`, [personId])
    .then((r) => r.rows[0].n as number);
}

/** A ctx whose database is the REAL scratch db, scoped to a given person. */
function ctxFor(personId: string, params: Record<string, string> = {}): any {
  return makeCtx({
    user: { id: personId, role: 'user', twoFactorEnabled: true },
    database: H.db,
    logger: noopLogger,
    _params: params,
  });
}

beforeAll(async () => {
  H = await createScratch([
    'person',
    'membership',
    'credit_entry',
    'dues_payment',
    'certificate',
    'notification',
    'data_export',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// buildMyDataExport — envelope shape + the joins (REAL aggregation SQL)
// ═══════════════════════════════════════════════════════════════════════════

describe('buildMyDataExport — envelope shape + joins (real DB)', () => {
  test('every portability category is present and carries the seeded rows', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({ prcId: 'PRC-BUILD-001' });

    const m1 = await insertMembership({ personId, memberNumber: 'MBR-AAA' });
    const m2 = await insertMembership({ personId, memberNumber: 'MBR-BBB' });
    const c1 = await insertCredit({ personId, creditAmount: 2.5, activityName: 'Seminar A' });
    const c2 = await insertCredit({ personId, creditAmount: 1, activityName: 'Seminar B', status: 'voided' });
    const p1 = await insertPayment({ personId, amount: 150000, receiptNumber: 'RCT-AAA' });
    const cert1 = await insertCertificate({ personId, certificateNumber: 'CERT-AAA' });
    const n1 = await insertNotification({ recipient: personId, title: 'Welcome' });

    // A DIFFERENT person's rows must NOT bleed into this person's export (join correctness).
    const other = await insertPerson({ id: freshId(), firstName: 'Bob' });
    await insertMembership({ personId: other, memberNumber: 'MBR-OTHER' });
    await insertCredit({ personId: other });
    await insertPayment({ personId: other });
    await insertCertificate({ personId: other });
    await insertNotification({ recipient: other });

    const env = await buildMyDataExport(H.db, noopLogger, personId);

    // The category manifest is the canonical 6-category list.
    expect(env.categories).toEqual([
      'profile', 'memberships', 'payments', 'credits', 'notifications', 'certificates',
    ]);
    expect(typeof env.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(env.exportedAt))).toBe(false);

    // memberships — exactly this person's two rows (join proven, no cross-person leak).
    expect(new Set(env.memberships.map((r: any) => r.id))).toEqual(new Set([m1, m2]));
    expect(env.memberships.every((r: any) => r.personId === personId)).toBe(true);
    expect(new Set(env.memberships.map((r: any) => r.memberNumber))).toEqual(new Set(['MBR-AAA', 'MBR-BBB']));

    // credits — the DPA export keeps BOTH active AND voided entries (legal record,
    // not the active-only transcript). findMany({personId}) applies no status gate.
    expect(new Set(env.credits.map((r: any) => r.id))).toEqual(new Set([c1, c2]));
    expect(env.credits.every((r: any) => r.personId === personId)).toBe(true);

    // payments — this person's single dues payment, read back with its money/receipt.
    expect(env.payments.map((r: any) => r.id)).toEqual([p1]);
    expect(env.payments[0].personId).toBe(personId);
    expect(env.payments[0].amount).toBe(150000);
    expect(env.payments[0].receiptNumber).toBe('RCT-AAA');

    // certificates — this person's single certificate.
    expect(env.certificates.map((r: any) => r.id)).toEqual([cert1]);
    expect((env.certificates[0] as any).certificateNumber).toBe('CERT-AAA');

    // notifications — this person's single notification (keyed on recipient_id).
    expect(env.notifications.map((r: any) => r.id)).toEqual([n1]);
    expect((env.notifications[0] as any).recipient).toBe(personId);
    expect((env.notifications[0] as any).title).toBe('Welcome');

    // prcId surfaced top-level (not inside the scrubbed profile).
    expect(env.prcId).toBe('PRC-BUILD-001');
  });

  test('profile is the GDPR-scrubbed projection — safe fields kept, internal/system fields stripped', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({
      firstName: 'Carol',
      lastName: 'Reyes',
      middleName: 'Q',
      dateOfBirth: '1985-07-20',
      gender: 'female',
      licenseNumber: 'PRC-SCRUB-1',
      specialization: 'Orthodontics',
      preferredLanguage: 'tl',
      bio: 'Orthodontist',
      timezone: 'Asia/Manila',
      languagesSpoken: ['en', 'tl', 'es'],
      prcId: 'PRC-SECRET-INTERNAL',
    });

    const env = await buildMyDataExport(H.db, noopLogger, personId);
    const profile = env.profile as Record<string, any>;

    // Safe portability fields kept, field-by-field.
    expect(profile.firstName).toBe('Carol');
    expect(profile.lastName).toBe('Reyes');
    expect(profile.middleName).toBe('Q');
    expect(profile.dateOfBirth).toBe('1985-07-20'); // date column stays a stable YYYY-MM-DD string
    expect(profile.gender).toBe('female');
    expect(profile.licenseNumber).toBe('PRC-SCRUB-1');
    expect(profile.specialization).toBe('Orthodontics');
    expect(profile.preferredLanguage).toBe('tl');
    expect(profile.bio).toBe('Orthodontist');
    expect(profile.timezone).toBe('Asia/Manila');
    expect(profile.languagesSpoken).toEqual(['en', 'tl', 'es']);
    expect(profile.contactInfo).toEqual({ email: 'alice@example.com', phone: '+639171234567' });

    // Internal / system / deletion fields + prcId MUST be absent from the profile.
    expect(profile.id).toBeUndefined();
    expect(profile.createdAt).toBeUndefined();
    expect(profile.updatedAt).toBeUndefined();
    expect(profile.version).toBeUndefined();
    expect(profile.createdBy).toBeUndefined();
    expect(profile.updatedBy).toBeUndefined();
    expect(profile.deletionRequestedAt).toBeUndefined();
    expect(profile.deletionScheduledAt).toBeUndefined();
    expect(profile.deletionCompletedAt).toBeUndefined();
    // prcId is NEVER inside profile — surfaced as the dedicated top-level field.
    expect(profile.prcId).toBeUndefined();
    expect(env.prcId).toBe('PRC-SECRET-INTERNAL');
  });

  test('a person with no related rows yields empty arrays (not nulls) per category', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({ prcId: null });

    const env = await buildMyDataExport(H.db, noopLogger, personId);
    expect(env.memberships).toEqual([]);
    expect(env.payments).toEqual([]);
    expect(env.credits).toEqual([]);
    expect(env.certificates).toEqual([]);
    expect(env.notifications).toEqual([]);
    expect(env.profile).toBeDefined();
    // null prcId is surfaced as undefined (not the literal null) top-level.
    expect(env.prcId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sync (GET /export) vs async (POST /data-export) — no envelope drift (FIX-008)
// ═══════════════════════════════════════════════════════════════════════════

describe('exportMyData (sync) vs requestDataExport (async) — payload parity (real DB)', () => {
  test('the sync response body and the stored async payload are identical (modulo exportedAt timestamp)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({ prcId: 'PRC-PARITY-1' });
    await insertMembership({ personId, memberNumber: 'MBR-PAR' });
    await insertCredit({ personId, activityName: 'Parity Seminar' });
    await insertPayment({ personId, receiptNumber: 'RCT-PAR' });
    await insertCertificate({ personId, certificateNumber: 'CERT-PAR' });
    await insertNotification({ recipient: personId, title: 'Parity Notice' });

    // Sync path — body returned directly.
    const syncRes = (await exportMyData(ctxFor(personId))) as any;
    expect(syncRes.status).toBe(200);
    const syncBody = syncRes.body as Record<string, any>;

    // The sync export wrote a ledger row into the SHARED 24h rate-limit window
    // (proven correct behaviour by the rate-limit suite below). For THIS parity
    // test we deliberately clear that row so the subsequent async export is
    // allowed to run and produce a payload to compare — we are testing
    // sync-vs-async envelope drift, not the rate limiter.
    await H.scopedPool.query(
      `DELETE FROM "${H.schema}".data_export WHERE person_id = $1`,
      [personId],
    );
    expect(await countExports(personId)).toBe(0);

    // Async path — payload stored on the data_export row.
    const asyncRes = (await requestDataExport(ctxFor(personId))) as any;
    expect(asyncRes.status).toBe(202);
    expect(asyncRes.body.status).toBe('ready');
    const storedRow = await readDataExport(asyncRes.body.exportId);
    const storedPayload = storedRow.payload as Record<string, any>;

    // Both envelopes have the same keys.
    expect(Object.keys(syncBody).sort()).toEqual(Object.keys(storedPayload).sort());

    // Normalise the only legitimately-divergent field (the wall-clock exportedAt)
    // and assert deep equality across every category — proving zero contract drift.
    //
    // The sync body is the in-memory envelope (Date objects on nested
    // createdAt/updatedAt/joinedAt fields); the async payload is the SAME envelope
    // after a JSONB round-trip (those Dates read back as ISO strings). The sync
    // body's wire/contract form is itself JSON, so JSON-serialising both sides
    // collapses that representation-only difference and lets us assert true
    // structural identity of the data — not a no-throw.
    const normalize = (o: Record<string, any>) =>
      ({ ...JSON.parse(JSON.stringify(o)), exportedAt: '<ts>' });
    expect(normalize(storedPayload)).toEqual(normalize(syncBody));

    // Spot-check the shared content survived serialization on the async side.
    expect(storedPayload.categories).toEqual(syncBody.categories);
    expect(storedPayload.prcId).toBe('PRC-PARITY-1');
    expect(storedPayload.memberships.map((m: any) => m.memberNumber)).toEqual(['MBR-PAR']);
    expect(storedPayload.payments[0].receiptNumber).toBe('RCT-PAR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getDataExportDownload — ownership / not-ready / TTL guards (REAL rows)
// ═══════════════════════════════════════════════════════════════════════════

describe('getDataExportDownload — guards against real rows', () => {
  test('serves the payload as a JSON attachment for the owner of a ready, in-TTL export', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    const payload = { categories: ['profile'], profile: { firstName: 'Dana' }, prcId: 'PRC-DL-1' };
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const id = await insertDataExport({ personId, status: 'ready', payload, expiresAt: future });

    const res = (await getDataExportDownload(ctxFor(personId, { id }))) as any;
    expect(res.status).toBe(200);
    // body is the pretty-printed JSON of the stored payload.
    const parsed = JSON.parse(res.body);
    expect(parsed).toEqual(payload);
  });

  test('404 NotFound when the export row belongs to a DIFFERENT person (ownership scope)', async () => {
    if (!H.dbReachable) return;
    const owner = await insertPerson({ id: freshId(), firstName: 'Owner' });
    const attacker = await insertPerson({ id: freshId(), firstName: 'Attacker' });
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const id = await insertDataExport({
      personId: owner,
      status: 'ready',
      payload: { secret: 'owner-only PII' },
      expiresAt: future,
    });

    // The attacker, passing the owner's export id, must be rejected as 404 — the
    // handler must NOT leak the owner's payload across the person boundary.
    let raised: any = null;
    try {
      await getDataExportDownload(ctxFor(attacker, { id }));
    } catch (err) {
      raised = err;
    }
    expect(raised).not.toBeNull();
    expect(raised.code).toBe('NOT_FOUND');
    expect(raised.statusCode).toBe(404);
  });

  test('404 NotFound for a non-existent export id', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    let raised: any = null;
    try {
      await getDataExportDownload(ctxFor(personId, { id: freshId() }));
    } catch (err) {
      raised = err;
    }
    expect(raised?.code).toBe('NOT_FOUND');
    expect(raised?.statusCode).toBe(404);
  });

  test('EXPORT_NOT_READY (422) when status != ready', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    // A processing row (even with a payload) is not downloadable yet.
    const id = await insertDataExport({
      personId,
      status: 'processing',
      payload: { categories: ['profile'] },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    let raised: any = null;
    try {
      await getDataExportDownload(ctxFor(personId, { id }));
    } catch (err) {
      raised = err;
    }
    expect(raised?.code).toBe('EXPORT_NOT_READY');
    expect(raised?.statusCode).toBe(422);
  });

  test('EXPORT_NOT_READY (422) when status is ready but the payload is NULL', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    const id = await insertDataExport({ personId, status: 'ready', payload: null });

    let raised: any = null;
    try {
      await getDataExportDownload(ctxFor(personId, { id }));
    } catch (err) {
      raised = err;
    }
    expect(raised?.code).toBe('EXPORT_NOT_READY');
    expect(raised?.statusCode).toBe(422);
  });

  test('EXPORT_EXPIRED (422) when a ready export with a payload is past its 7-day TTL', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    // expiresAt one second in the PAST → expired.
    const past = new Date(Date.now() - 1000);
    const id = await insertDataExport({
      personId,
      status: 'ready',
      payload: { categories: ['profile'], profile: {} },
      expiresAt: past,
    });

    let raised: any = null;
    try {
      await getDataExportDownload(ctxFor(personId, { id }));
    } catch (err) {
      raised = err;
    }
    expect(raised?.code).toBe('EXPORT_EXPIRED');
    expect(raised?.statusCode).toBe(422);
  });

  test('a ready export whose TTL has NOT yet elapsed still downloads (TTL boundary)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    const payload = { categories: ['profile'], ok: true };
    // expiresAt comfortably in the future.
    const future = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const id = await insertDataExport({ personId, status: 'ready', payload, expiresAt: future });

    const res = (await getDataExportDownload(ctxFor(personId, { id }))) as any;
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual(payload);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rate-limit shared ledger — 1 export / 24h, shared across sync + async (M2-R4)
// ═══════════════════════════════════════════════════════════════════════════

describe('Shared 24h rate-limit ledger across sync + async (real DB)', () => {
  test('a successful SYNC export blocks a subsequent ASYNC export within 24h (429 RATE_LIMITED)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});

    // First sync export succeeds and writes a 'ready' ledger row.
    const first = (await exportMyData(ctxFor(personId))) as any;
    expect(first.status).toBe(200);
    expect(await countExports(personId)).toBe(1);

    // The async endpoint must observe the SAME ledger and be rate-limited — it
    // cannot be used to bypass the sync window.
    const blocked = (await requestDataExport(ctxFor(personId))) as any;
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');

    // No new ledger row was created by the blocked async attempt.
    expect(await countExports(personId)).toBe(1);
  });

  test('a successful ASYNC export blocks a subsequent SYNC export within 24h (429 RATE_LIMITED)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});

    const first = (await requestDataExport(ctxFor(personId))) as any;
    expect(first.status).toBe(202);
    expect(await countExports(personId)).toBe(1);

    const blocked = (await exportMyData(ctxFor(personId))) as any;
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(await countExports(personId)).toBe(1);
  });

  test('a recent FAILED export does NOT block a fresh export (only failed rows are ignored)', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    // A recent failed attempt sits in the window.
    await insertDataExport({ personId, status: 'failed', requestedAt: new Date() });

    // A failed attempt must not lock the member out — the sync export proceeds.
    const res = (await exportMyData(ctxFor(personId))) as any;
    expect(res.status).toBe(200);
    // The successful export added its own ledger row alongside the failed one.
    expect(await countExports(personId)).toBe(2);
  });

  test('an export OUTSIDE the 24h window does NOT block a fresh export', async () => {
    if (!H.dbReachable) return;
    const personId = await insertPerson({});
    // A ready export requested 25 hours ago — outside the 24h window.
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await insertDataExport({ personId, status: 'ready', requestedAt: stale, payload: { ok: true } });

    const res = (await exportMyData(ctxFor(personId))) as any;
    expect(res.status).toBe(200);
    expect(await countExports(personId)).toBe(2);
  });

  test('the rate-limit ledger is per-person — one member\'s recent export does not block another', async () => {
    if (!H.dbReachable) return;
    const personA = await insertPerson({ id: freshId() });
    const personB = await insertPerson({ id: freshId() });
    await insertDataExport({ personId: personA, status: 'ready', requestedAt: new Date(), payload: { ok: true } });

    // personB has no recent export → must NOT be blocked by personA's row.
    const res = (await exportMyData(ctxFor(personB))) as any;
    expect(res.status).toBe(200);
    expect(await countExports(personB)).toBe(1);
    // personA still has exactly its one seeded row (untouched by personB's export).
    expect(await countExports(personA)).toBe(1);
  });
});
