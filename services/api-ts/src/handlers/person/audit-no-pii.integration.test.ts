/**
 * DPA-05 — the account-deletion audit log must contain NO raw PII, and MUST
 * carry the safe reference (personId + the original deletion-request date).
 *
 * BR (DPA-05): when a person's account is anonymized (right-to-erasure under the
 * Data Privacy Act of 2012), the audit entry recording that anonymization must
 * carry ONLY personId + originalRequestDate and MUST NOT leak the person's raw
 * PII (name / email / phone / address) into the persisted audit row's `details`,
 * `description`, or `resource`.
 *
 * WHY THIS FILE EXISTS (the gap it fills):
 * The existing `jobs/deletionProcessor.test.ts` "audit ... do NOT contain PII"
 * case asserts only against a FAKE in-memory sink and a fixed list of named keys
 * (`details.firstName/lastName/email/phone/contactInfo` are `undefined`) using
 * the `fakePerson` factory's default PII. That proves the call-argument shape but
 * NOT what actually lands in the audit STORE, never exercises the real
 * `AuditRepository.logEvent` persistence (details jsonb + resource + description
 * + integrity hash), and never seeds the person's *actual* name/email/phone/
 * address to scan for. The real-PG `person-deletion.integration.test.ts` passes
 * `audit: null` everywhere, so the audit path is never run there at all.
 *
 * This suite runs the REAL deletion/anonymization path against a REAL person row
 * (seeded with DISTINCTIVE, greppable PII tokens) in an isolated scratch Postgres
 * schema and:
 *   (A) persists the deletion audit through the REAL `AuditRepository.logEvent`,
 *       reads the row BACK from Postgres, and scans the ENTIRE serialized entry
 *       for any occurrence of the seeded PII values — a leak in details,
 *       description, OR resource fails it — while asserting it DOES carry
 *       `personId` + `originalRequestDate` (== the original request instant) and
 *       the canonical system actor (`user == SYSTEM_USER_ID`);
 *   (B) drives the REAL `processDeletions` job and the REAL `executeAccountDeletion`
 *       handler through a CAPTURING sink seeded with the same PII, asserting the
 *       emitted `logEvent` payload is PII-free, carries personId + the original
 *       request date, AND uses `user: SYSTEM_USER_ID` (covers BOTH deletion sites'
 *       payloads — and that BOTH actually reach their audit call and scrub the row).
 *
 * POST-FIX BEHAVIOR THIS SUITE ASSERTS (the cluster these tests previously pinned
 * as bugs is now FIXED in source — see notes below):
 *   - `jobs/deletionProcessor.ts` audit `user` is `SYSTEM_USER_ID` (canonical
 *     system-actor uuid), so the real INSERT runs and the DPA-05 audit ROW
 *     PERSISTS. The person scrub uses `anonymizePersonFields(now)` (updatedBy:null),
 *     so the person row is anonymized end-to-end.
 *   - `person/jobs/index.ts` wires a real `createAuditService(new AuditRepository(...))`
 *     into the cron, so the audit sink is actually present (the `if (audit)` block
 *     no longer no-ops).
 *   - `executeAccountDeletion.ts` uses `updatedBy: null` on the person update (no
 *     more 22P02 uuid trap → it now SCRUBS the person) and `user: SYSTEM_USER_ID`
 *     on its audit call, so the handler reaches its audit and the captured payload
 *     is PII-free with personId + originalRequestDate.
 *
 * REGRESSION GUARD (documents WHY SYSTEM_USER_ID is required, not a handler bug):
 *   A RAW `AuditRepository.logEvent` call made with the literal string `'system'`
 *   for the actor STILL rejects with Postgres 22P02 — `audit_log_entry.user` /
 *   `created_by` / `updated_by` are uuid columns. This is the exact failure the
 *   source fix avoids by passing `SYSTEM_USER_ID`; the guard calls the repo
 *   DIRECTLY (it does NOT assert the now-fixed handlers throw).
 *
 * Every assertion reads back real persisted/captured state and asserts on its
 * contents (and includes a negative-control proving the PII scan actually catches
 * a leaked needle).
 *
 * Isolation: `createScratch` copies the public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real column /
 * enum / default / NOT-NULL is present. The `person.deleted` cascade emit is a
 * no-op (no consumers registered in the test process). Requires a migrated
 * public schema; skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';
import { SYSTEM_USER_ID } from '@/core/constants';
import { executeAccountDeletion } from './executeAccountDeletion';
import { processDeletions } from './jobs/deletionProcessor';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

const ORG_A = '00000000-0000-4000-8000-0000000000a1';

function freshId(): string {
  return crypto.randomUUID();
}

// ─── DISTINCTIVE PII TOKENS ──────────────────────────────────────────────────
// Deliberately unusual, unique substrings so the "no raw PII anywhere in the
// audit entry" scan is meaningful: if any of these appears in the serialized
// audit row/payload, a real leak occurred. They are both the seeded person
// values and the leak-scan needles.
const PII = {
  firstName: 'ZZQ_FIRSTNAME_X7Qd',
  lastName: 'ZZQ_LASTNAME_K2mP',
  middleName: 'ZZQ_MIDDLE_R9vn',
  email: 'zzq.leakcanary.x7qd@private-pii.invalid',
  phone: '+639170000ZZQ1',
  street1: 'ZZQ_STREET_4821 Real St',
  city: 'ZZQ_CITY_Quezon',
};

/** Every raw-PII value that must NOT appear anywhere in the audit entry/payload. */
const PII_NEEDLES: string[] = [
  PII.firstName, PII.lastName, PII.middleName,
  PII.email, PII.phone, PII.street1, PII.city,
];

function assertNoPii(serialized: string): void {
  for (const needle of PII_NEEDLES) {
    expect(serialized).not.toContain(needle);
  }
}

/**
 * Insert a fully-populated person row (with the distinctive PII above) in an
 * OVERDUE deletion state: requested + scheduled in the past, not yet completed.
 */
async function insertOverduePerson(opts: { id?: string; requestedAt: Date; scheduledAt: Date }): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person
       (id, first_name, last_name, middle_name, date_of_birth, gender,
        primary_address, contact_info, avatar, languages_spoken, timezone,
        license_number, specialization, prc_id, preferred_language, bio,
        deletion_requested_at, deletion_scheduled_at, deletion_completed_at)
     VALUES ($1,$2,$3,$4,'1985-07-15','male'::gender,
        $5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,'Asia/Manila',
        'PRC-12345','Endodontics','PRC-12345','en','clinic bio text',
        $9,$10,NULL)`,
    [
      id,
      PII.firstName, PII.lastName, PII.middleName,
      JSON.stringify({ street1: PII.street1, city: PII.city, state: 'NCR', postalCode: '1000', country: 'PH' }),
      JSON.stringify({ email: PII.email, phone: PII.phone }),
      JSON.stringify({ url: 'https://cdn.example.com/avatar/x.png', file: freshId() }),
      JSON.stringify(['en', 'tl']),
      opts.requestedAt, opts.scheduledAt,
    ],
  );
  return id;
}

async function readAuditRowsForResource(resource: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".audit_log_entry WHERE resource = $1`,
    [resource],
  );
  return rows;
}

async function readPerson(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".person WHERE id = $1`, [id],
  );
  return rows[0];
}

/** ctx for executeAccountDeletion: real scratch db + an injectable audit sink. */
function ctxFor(personId: string, audit: { logEvent: (a: any) => Promise<unknown> } | null) {
  const vars: Record<string, any> = {
    database: H.db,
    logger: noopLogger,
    requestId: 'req-test-1',
    organizationId: ORG_A,
    audit,
  };
  return {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      valid: () => ({}),
      param: (k: string) => (k === 'personId' ? personId : ''),
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
  H = await createScratch(['person', 'session', 'audit_log_entry']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// NEGATIVE CONTROL — the PII scan is real: it FAILS on a leaked needle.
// Guards against the scan silently passing because the needles never match.
// ═══════════════════════════════════════════════════════════════════════════

describe('DPA-05 — PII leak-scan is a real assertion (negative control)', () => {
  test('assertNoPii throws when a seeded PII value is present in the payload', () => {
    const leaky = JSON.stringify({ details: { note: `contact ${PII.email}` } });
    expect(() => assertNoPii(leaky)).toThrow();
    // ...and passes on a scrubbed payload (sanity floor for the positive tests).
    const clean = JSON.stringify({ details: { personId: freshId(), email: 'deleted@deleted.invalid' } });
    expect(() => assertNoPii(clean)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// (A) REAL AuditRepository persistence — the stored row is PII-free, carries
//     personId + originalRequestDate, and is written by the canonical system
//     actor (user == SYSTEM_USER_ID). The processor now passes SYSTEM_USER_ID,
//     so the real INSERT runs and the DPA-05 row PERSISTS.
// ═══════════════════════════════════════════════════════════════════════════

describe('DPA-05 — deletion audit persisted via REAL AuditRepository contains no PII', () => {
  test('persisted audit_log_entry: system actor + personId + originalRequestDate, NO raw PII anywhere', async () => {
    if (!H.dbReachable) return;

    const requestedAt = new Date('2026-01-02T03:04:05.000Z');
    const scheduledAt = new Date(requestedAt.getTime() - 1000); // overdue
    const personId = await insertOverduePerson({ requestedAt, scheduledAt });

    // Persisting sink: forwards the job's exact logEvent payload to the REAL repo.
    // The processor already passes `user: SYSTEM_USER_ID` (the fix), so this just
    // supplies the org scope (the processor omits organizationId) and persists
    // through the real `AuditRepository.logEvent` — proving the real DPA-05 audit
    // ROW (details jsonb, resource, description, integrity hash) is PII-free as
    // persisted and carries the canonical system actor.
    const auditRepo = new AuditRepository(H.db as any, noopLogger);
    const persistingAudit = {
      logEvent: async (args: any) =>
        auditRepo.logEvent({ ...args, organizationId: ORG_A }),
    };

    const result = await processDeletions({ db: H.db as any, logger: noopLogger, audit: persistingAudit });
    expect(result.errors).toBe(0);
    expect(result.succeeded).toBeGreaterThanOrEqual(1);
    // The real scrub ran end-to-end on the real row.
    expect((await readPerson(personId)).first_name).toBe('DELETED');

    const rows = await readAuditRowsForResource(personId);
    expect(rows.length).toBe(1);
    const entry = rows[0];

    // Records the deletion with a SAFE resource reference (personId, not a name).
    expect(entry.event_type).toBe('data-deletion');
    expect(entry.category).toBe('privacy');
    expect(entry.action).toBe('anonymize');
    expect(entry.outcome).toBe('success');
    expect(entry.resource).toBe(personId);
    expect(entry.resource_type).toBe('person');

    // Written by the canonical system actor — the fix that makes the row persist.
    expect(entry.user).toBe(SYSTEM_USER_ID);
    expect(entry.created_by).toBe(SYSTEM_USER_ID);
    expect(entry.updated_by).toBe(SYSTEM_USER_ID);

    // Carries personId + the ORIGINAL request date (the two DPA-05 safe fields).
    const details = entry.details ?? {};
    expect(details.personId).toBe(personId);
    expect(details.originalRequestDate).toBeTruthy();
    expect(new Date(details.originalRequestDate as string).getTime()).toBe(requestedAt.getTime());

    // NO raw PII anywhere in the persisted row (scan the WHOLE serialized entry,
    // not a hand-picked key list — a leak in any column is caught).
    assertNoPii(JSON.stringify(entry));
    // ...and specifically not in details or description.
    assertNoPii(JSON.stringify(details));
    expect(typeof entry.description).toBe('string');
    assertNoPii(entry.description as string);
    // Named-key guard (strengthens the existing unit-level assertion).
    for (const k of ['firstName', 'lastName', 'middleName', 'email', 'phone', 'contactInfo', 'primaryAddress', 'name', 'address']) {
      expect((details as any)[k]).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// (B) Emitted logEvent PAYLOAD is PII-free at BOTH deletion sites, both reach
//     their audit call with user: SYSTEM_USER_ID, and both scrub the row.
// ═══════════════════════════════════════════════════════════════════════════

describe('DPA-05 — deletion audit PAYLOAD leaks no PII (both deletion sites)', () => {
  test('processDeletions: emitted payload has system actor + personId + originalRequestDate, no PII value', async () => {
    if (!H.dbReachable) return;

    const requestedAt = new Date('2026-02-03T04:05:06.000Z');
    const scheduledAt = new Date(requestedAt.getTime() - 1000);
    const personId = await insertOverduePerson({ requestedAt, scheduledAt });

    const calls: any[] = [];
    const capturingAudit = { logEvent: async (a: any) => { calls.push(a); } };

    const result = await processDeletions({ db: H.db as any, logger: noopLogger, audit: capturingAudit });
    expect(result.errors).toBe(0);
    expect((await readPerson(personId)).first_name).toBe('DELETED');

    const call = calls.find((c) => c?.resource === personId);
    expect(call).toBeDefined();
    expect(call.eventType).toBe('data-deletion');
    expect(call.action).toBe('anonymize');
    expect(call.resource).toBe(personId);
    // The fix: the processor passes the canonical system-actor uuid.
    expect(call.user).toBe(SYSTEM_USER_ID);

    const details = call.details ?? {};
    expect(details.personId).toBe(personId);
    expect(new Date(details.originalRequestDate).getTime()).toBe(requestedAt.getTime());

    assertNoPii(JSON.stringify(call));
    for (const k of ['firstName', 'lastName', 'email', 'phone', 'contactInfo', 'primaryAddress']) {
      expect(details[k]).toBeUndefined();
    }
  });

  test('executeAccountDeletion: scrubs the person + emits PII-free payload (system actor + originalRequestDate)', async () => {
    if (!H.dbReachable) return;

    // executeAccountDeletion's person update now uses `updatedBy: null` (no more
    // 22P02 uuid trap), so the handler scrubs the row AND reaches its audit call,
    // which uses `user: SYSTEM_USER_ID`. We capture the emitted payload through a
    // sink and assert: the row is scrubbed, the handler returned 200, and the
    // payload is PII-free with personId-safe reference + originalRequestDate.
    const requestedAt = new Date('2026-04-05T06:07:08.000Z');
    const scheduledAt = new Date(requestedAt.getTime() - 1000);
    const personId = await insertOverduePerson({ requestedAt, scheduledAt });

    const calls: any[] = [];
    const capturingAudit = { logEvent: async (a: any) => { calls.push(a); } };

    const res = await executeAccountDeletion(ctxFor(personId, capturingAudit));
    // Fixed handler runs to completion and anonymizes.
    expect((res as any).status).toBe(200);

    // The real scrub ran on the real row.
    const scrubbed = await readPerson(personId);
    expect(scrubbed.first_name).toBe('DELETED');
    expect(scrubbed.deletion_completed_at).not.toBeNull();

    // The handler reached its audit call (no abort) with a clean payload.
    const call = calls.find((c) => c?.resource === personId);
    expect(call).toBeDefined();
    expect(call.eventType).toBe('data-deletion');
    expect(call.action).toBe('anonymize');
    expect(call.resource).toBe(personId);
    expect(call.user).toBe(SYSTEM_USER_ID);

    const details = call.details ?? {};
    expect(details.originalRequestDate).toBeTruthy();
    expect(new Date(details.originalRequestDate as string).getTime()).toBe(requestedAt.getTime());

    assertNoPii(JSON.stringify(call));
    for (const k of ['firstName', 'lastName', 'email', 'phone', 'contactInfo', 'primaryAddress']) {
      expect(details[k]).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGRESSION GUARD — documents WHY SYSTEM_USER_ID is required (NOT a handler
// bug-pin). Calls the repo DIRECTLY with the literal 'system' an earlier
// revision passed; the uuid columns still reject it with Postgres 22P02. If this
// ever stops throwing (e.g. the column becomes text), the source fix's rationale
// is stale and should be revisited.
// ═══════════════════════════════════════════════════════════════════════════

describe('DPA-05 — raw logEvent with literal "system" actor still rejects (uuid guard)', () => {
  test("AuditRepository.logEvent with user:'system' rejects with 22P02 — why SYSTEM_USER_ID is required", async () => {
    if (!H.dbReachable) return;
    const auditRepo = new AuditRepository(H.db as any, noopLogger);
    // Unique resource id so the consequence-check is isolated from any audit rows
    // persisted by the (passing) tests above in this same schema.
    const probeResource = freshId();

    let err: any = null;
    try {
      await auditRepo.logEvent({
        eventType: 'data-deletion',
        category: 'privacy',
        action: 'anonymize',
        outcome: 'success',
        organizationId: ORG_A,
        user: 'system',                 // ← the invalid literal the fix replaced with SYSTEM_USER_ID
        userType: 'system' as any,
        resourceType: 'person',
        resource: probeResource,
        description: 'Account anonymized by scheduled deletion processor',
        details: { personId: freshId(), originalRequestDate: new Date().toISOString() },
      });
    } catch (e) {
      err = e;
    }

    expect(err).not.toBeNull();
    // The specific defect the fix avoids: 'system' is not a valid uuid for
    // created_by / updated_by / user.
    const msg = String(err?.message ?? '') + String((err as any)?.cause?.message ?? '') + String((err as any)?.cause?.code ?? '');
    expect(msg).toContain('22P02');
    expect(msg.toLowerCase()).toContain('uuid');

    // Proof of consequence: NO audit row lands for the raw 'system' actor — which
    // is exactly why the deletion path must pass SYSTEM_USER_ID instead.
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".audit_log_entry WHERE resource = $1`,
      [probeResource],
    );
    expect(rows[0].n).toBe(0);
  });
});
