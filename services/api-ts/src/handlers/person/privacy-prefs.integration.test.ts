/**
 * Real-PG integration tests for the person privacy-settings + notification-
 * preferences upsert handlers, plus getPerson owner-only authorization and the
 * membership-scoped ID-card read.
 *
 * Why this suite exists
 * ---------------------
 * The existing unit tests (updateMyPrivacySettings.test.ts,
 * updateMyNotificationPreferences.test.ts, getMyPrivacySettings.test.ts) hand a
 * fully-faked Drizzle chain to the handler. A fake `db.select().limit()` that
 * returns `[]` / `[existing]` can NEVER prove:
 *   - the insert-vs-update BRANCH actually persists the right row to Postgres,
 *   - the per-person/per-org UNIQUE index (`privacy_person_org_idx`,
 *     `notif_pref_person_cat_org_idx`) really exists and is enforced,
 *   - the `?? existing ?? default` merge writes the correct flags on UPDATE,
 *   - getPerson's owner-only guard returns 403 for someone else's id against a
 *     real row (not a stubbed repo),
 *   - the membership-scoped ID-card read assembles real person+membership rows.
 *
 * This suite drives the REAL handlers with a REAL DB (only the audit side-effect
 * + the ID-card HMAC secret are stubbed/env-set) and asserts the persisted row
 * state read back from Postgres via the raw scoped pool.
 *
 * Isolation: the shared `createScratch` harness copies the real public
 * structures via `CREATE TABLE … (LIKE … INCLUDING ALL)`, so every real column /
 * enum / default / NOT NULL / UNIQUE index is present (no hand-DDL drift). FKs
 * are not copied, so rows insert without parent org/person/tier rows. Skips
 * cleanly when Postgres is unreachable.
 *
 * Targets:
 *   handlers/person/updateMyPrivacySettings.ts          (insert vs update branch)
 *   handlers/person/getMyPrivacySettings.ts             (read-back)
 *   handlers/person/updateMyNotificationPreferences.ts  (per-category upsert, fail-open)
 *   handlers/person/getMyNotificationPreferences.ts     (fail-open on empty)
 *   handlers/person/getPerson.ts                        (owner-only authorization)
 *   handlers/person/getMyIdCard.ts                      (membership-scoped read)
 */

import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

// The audit middleware is composed at the route layer; the handlers only set
// audit context vars. Stub the thin wrapper so nothing tries to write an audit
// event to a table the scratch schema doesn't carry.
mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

import { updateMyPrivacySettings } from './updateMyPrivacySettings';
import { getMyPrivacySettings } from './getMyPrivacySettings';
import { updateMyNotificationPreferences } from './updateMyNotificationPreferences';
import { getMyNotificationPreferences } from './getMyNotificationPreferences';
import { getPerson } from './getPerson';
import { getMyIdCard } from './getMyIdCard';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

function freshId(): string {
  return crypto.randomUUID();
}

/**
 * Build a handler ctx whose `database` is the REAL scratch drizzle instance.
 * Mirrors makeCtx's shape but pins the DB to H.db so every handler query hits
 * the scratch schema. Captured audit/set vars are exposed via `vars` for
 * inspection. `ctx.json(body, status)` returns `{ status, body }` (like makeCtx)
 * so we read the handler's return value directly.
 */
function makeRealCtx(opts: {
  userId?: string | null;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  organizationId?: string;
  isInternalExpand?: boolean;
}): { ctx: any; vars: Record<string, any> } {
  const userId = opts.userId === undefined ? freshId() : opts.userId;
  const user = userId ? { id: userId, role: 'user', twoFactorEnabled: true } : null;
  const vars: Record<string, any> = {
    user,
    session: user ? { id: 'session-1', userId: user.id, user } : null,
    organizationId: opts.organizationId ?? 'tenant-1',
    database: H.db,
    logger: noopLogger,
    isInternalExpand: opts.isInternalExpand ?? false,
  };
  const jsonBody = opts.body ?? {};
  const queryValues = opts.query ?? {};
  const paramValues = opts.params ?? {};

  const ctx = {
    get: (k: string) => vars[k],
    set: (k: string, v: any) => { vars[k] = v; },
    req: {
      valid: (t: string) => (t === 'json' ? jsonBody : t === 'query' ? queryValues : t === 'param' ? paramValues : {}),
      param: (k: string) => paramValues[k] ?? '',
      header: () => null,
      json: () => Promise.resolve(jsonBody),
      query: (k: string) => (queryValues as any)[k] ?? null,
      raw: { headers: new Headers() },
    },
    header: () => {},
    json: (body: any, status: number) => ({ status, body }) as any,
    body: (body: any, status: number) => ({ status, body }) as any,
  };
  return { ctx, vars };
}

// ── raw seeders / readers (scoped pool, pinned to the scratch schema) ─────────

/** Insert a membership row. `status` is the membership_status enum — bound $N
 *  enum params need an explicit ::membership_status cast (literals auto-cast). */
async function insertMembership(opts: {
  personId: string;
  organizationId: string;
  status?: 'active' | 'gracePeriod' | 'lapsed' | 'expired' | 'suspended' | 'removed' | 'pendingPayment';
  startDate?: string;
  duesExpiryDate?: string | null;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, dues_expiry_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::membership_status)`,
    [
      id,
      opts.organizationId,
      opts.personId,
      freshId(), // tier_id is NOT NULL (FK not copied → any uuid is fine)
      opts.startDate ?? '2026-01-01',
      opts.duesExpiryDate ?? null,
      opts.status ?? 'active',
    ],
  );
  return id;
}

/** Insert a minimal person row (only first_name is NOT-NULL-without-default). */
async function insertPerson(opts: {
  id: string;
  firstName?: string;
  lastName?: string | null;
  licenseNumber?: string | null;
  contactInfo?: Record<string, unknown> | null;
  dateOfBirth?: string | null;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person
       (id, first_name, last_name, license_number, contact_info, date_of_birth)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [
      opts.id,
      opts.firstName ?? 'Test',
      opts.lastName ?? null,
      opts.licenseNumber ?? null,
      opts.contactInfo ? JSON.stringify(opts.contactInfo) : null,
      opts.dateOfBirth ?? null,
    ],
  );
}

async function readPrivacyRow(personId: string, organizationId: string): Promise<any | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, person_id, organization_id, email_visible, phone_visible, photo_visible,
            address_visible, credentials_visible, dues_status_visible, ce_compliance_visible,
            version, created_at, updated_at
       FROM "${H.schema}".person_privacy_setting
      WHERE person_id = $1 AND organization_id = $2`,
    [personId, organizationId],
  );
  return rows[0];
}

async function countPrivacyRows(personId: string, organizationId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".person_privacy_setting
      WHERE person_id = $1 AND organization_id = $2`,
    [personId, organizationId],
  );
  return rows[0].n;
}

async function readNotifRow(personId: string, category: string): Promise<any | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, person_id, organization_id, category, push_enabled, email_enabled, version
       FROM "${H.schema}".notification_preference
      WHERE person_id = $1 AND category = $2`,
    [personId, category],
  );
  return rows[0];
}

async function countNotifRows(personId: string, category: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".notification_preference
      WHERE person_id = $1 AND category = $2`,
    [personId, category],
  );
  return rows[0].n;
}

beforeAll(async () => {
  // ID-card HMAC signing fails closed without a secret — set one for getMyIdCard.
  process.env['ID_CARD_HMAC_SECRET'] = 'integration-test-secret';
  H = await createScratch([
    'person_privacy_setting',
    'notification_preference',
    'membership',
    'person',
    'organization',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── privacy-settings upsert: INSERT branch + unique constraint ───────────────

describe('updateMyPrivacySettings — INSERT branch (real DB)', () => {
  test('inserts a new privacy row (201) with the requested flags persisted', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await insertMembership({ personId, organizationId: orgId, status: 'active' });

    const { ctx } = makeRealCtx({
      userId: personId,
      body: { orgId, emailVisible: true, photoVisible: false, duesStatusVisible: true },
    });
    const res = await updateMyPrivacySettings(ctx);
    expect(res.status).toBe(201);

    // Read the REAL persisted row back — not the handler's return value.
    const row = await readPrivacyRow(personId, orgId);
    expect(row).toBeDefined();
    expect(row.email_visible).toBe(true);     // requested override
    expect(row.photo_visible).toBe(false);    // requested override (default is true)
    expect(row.dues_status_visible).toBe(true); // requested override
    // Unspecified flags fall to their documented defaults (M02-C2.3).
    expect(row.phone_visible).toBe(false);
    expect(row.address_visible).toBe(false);
    expect(row.credentials_visible).toBe(false);
    expect(row.ce_compliance_visible).toBe(false);
    expect(row.person_id).toBe(personId);
    expect(row.organization_id).toBe(orgId);
    expect(row.version).toBe(1);
  });

  test('honours active OR gracePeriod membership; rejects non-member with 403 and writes nothing', async () => {
    if (!H.dbReachable) return;
    // gracePeriod member → allowed.
    const graceId = freshId();
    const orgGrace = freshId();
    await insertMembership({ personId: graceId, organizationId: orgGrace, status: 'gracePeriod' });
    const { ctx: graceCtx } = makeRealCtx({ userId: graceId, body: { orgId: orgGrace, emailVisible: true } });
    const graceRes = await updateMyPrivacySettings(graceCtx);
    expect(graceRes.status).toBe(201);
    expect(await countPrivacyRows(graceId, orgGrace)).toBe(1);

    // No membership at all → 403, no row written.
    const strangerId = freshId();
    const orgX = freshId();
    const { ctx: strangerCtx } = makeRealCtx({ userId: strangerId, body: { orgId: orgX, emailVisible: true } });
    await expect(updateMyPrivacySettings(strangerCtx)).rejects.toThrow('Not a member of this organization');
    expect(await countPrivacyRows(strangerId, orgX)).toBe(0);

    // A 'lapsed' membership is NOT active/gracePeriod → 403.
    const lapsedId = freshId();
    const orgLapsed = freshId();
    await insertMembership({ personId: lapsedId, organizationId: orgLapsed, status: 'lapsed' });
    const { ctx: lapsedCtx } = makeRealCtx({ userId: lapsedId, body: { orgId: orgLapsed, emailVisible: true } });
    await expect(updateMyPrivacySettings(lapsedCtx)).rejects.toThrow('Not a member of this organization');
    expect(await countPrivacyRows(lapsedId, orgLapsed)).toBe(0);
  });

  test('UNIQUE (person_id, organization_id) index is enforced — a manual dup insert violates it', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await insertMembership({ personId, organizationId: orgId, status: 'active' });

    const { ctx } = makeRealCtx({ userId: personId, body: { orgId, emailVisible: true } });
    await updateMyPrivacySettings(ctx);
    expect(await countPrivacyRows(personId, orgId)).toBe(1);

    // The real `privacy_person_org_idx` UNIQUE index (copied by LIKE INCLUDING ALL)
    // must reject a second row for the same (person, org).
    await expect(
      H.scopedPool.query(
        `INSERT INTO "${H.schema}".person_privacy_setting (id, person_id, organization_id)
         VALUES ($1,$2,$3)`,
        [freshId(), personId, orgId],
      ),
    ).rejects.toThrow();
    // Still exactly one row.
    expect(await countPrivacyRows(personId, orgId)).toBe(1);
  });
});

// ─── privacy-settings upsert: UPDATE branch (idempotent, merge semantics) ─────

describe('updateMyPrivacySettings — UPDATE branch (real DB)', () => {
  test('a second PATCH updates the SAME row (200), no duplicate, merges unspecified flags from existing', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await insertMembership({ personId, organizationId: orgId, status: 'active' });

    // First insert: emailVisible true, photoVisible false.
    const first = makeRealCtx({ userId: personId, body: { orgId, emailVisible: true, photoVisible: false } });
    const r1 = await updateMyPrivacySettings(first.ctx);
    expect(r1.status).toBe(201);
    const after1 = await readPrivacyRow(personId, orgId);
    expect(after1.version).toBe(1);

    // Second PATCH: flips ONLY addressVisible. emailVisible/photoVisible must be
    // preserved from the existing row (the `?? existing ?? default` merge), NOT
    // reset to defaults.
    const second = makeRealCtx({ userId: personId, body: { orgId, addressVisible: true } });
    const r2 = await updateMyPrivacySettings(second.ctx);
    expect(r2.status).toBe(200); // UPDATE branch → 200, not 201

    const after2 = await readPrivacyRow(personId, orgId);
    expect(await countPrivacyRows(personId, orgId)).toBe(1); // same row, no dup
    expect(after2.id).toBe(after1.id);
    expect(after2.address_visible).toBe(true);  // newly set
    expect(after2.email_visible).toBe(true);    // preserved from existing
    expect(after2.photo_visible).toBe(false);   // preserved from existing
    // The UPDATE branch actually persisted the new value: address_visible flipped
    // false→true on the SAME row. That is the real invariant this branch owns.
    //
    // NOTE: `version` is NOT bumped on update. The `version` column (baseEntityFields,
    // comment "Optimistic locking") has a DB default of 1 but NO `$onUpdate` hook and
    // NO trigger, and updateMyPrivacySettings does `.set({ ...updates, updatedAt })`
    // without touching version. So version stays 1 on these simple per-person/org
    // settings rows — there is no read-modify-write CAS here. Asserting version stays
    // at its default pins the real behavior (an earlier `toBeGreaterThan` was a
    // test-expectation bug for a non-existent invariant).
    expect(after2.version).toBe(after1.version); // not bumped (no optimistic-lock write path)
  });

  test('two different orgs for the same person are independent rows (per-org privacy)', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgA = freshId();
    const orgB = freshId();
    await insertMembership({ personId, organizationId: orgA, status: 'active' });
    await insertMembership({ personId, organizationId: orgB, status: 'active' });

    await updateMyPrivacySettings(makeRealCtx({ userId: personId, body: { orgId: orgA, emailVisible: true } }).ctx);
    await updateMyPrivacySettings(makeRealCtx({ userId: personId, body: { orgId: orgB, emailVisible: false, phoneVisible: true } }).ctx);

    const rowA = await readPrivacyRow(personId, orgA);
    const rowB = await readPrivacyRow(personId, orgB);
    expect(rowA.id).not.toBe(rowB.id);
    expect(rowA.email_visible).toBe(true);
    expect(rowA.phone_visible).toBe(false);
    expect(rowB.email_visible).toBe(false);
    expect(rowB.phone_visible).toBe(true);
  });
});

// ─── privacy-settings read-back via getMyPrivacySettings ──────────────────────

describe('getMyPrivacySettings — read-back (real DB)', () => {
  test('orgId query returns the persisted row for that org', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await insertMembership({ personId, organizationId: orgId, status: 'active' });
    await updateMyPrivacySettings(makeRealCtx({ userId: personId, body: { orgId, credentialsVisible: true } }).ctx);

    const { ctx } = makeRealCtx({ userId: personId, query: { orgId } });
    const res = await getMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
    expect(res.body.personId).toBe(personId);
    expect(res.body.organizationId).toBe(orgId);
    expect(res.body.credentialsVisible).toBe(true);
  });

  test('orgId query with no persisted row returns the documented defaults (fail-open read)', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const { ctx } = makeRealCtx({ userId: personId, query: { orgId } });
    const res = await getMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
    // No row → handler synthesizes the M02-C2.3 defaults.
    expect(res.body.emailVisible).toBe(false);
    expect(res.body.photoVisible).toBe(true);
    expect(res.body.organizationId).toBe(orgId);
  });
});

// ─── notification-preferences upsert (per-category) ───────────────────────────

// SCHEMA/DB DRIFT NOTE: the Drizzle schema declares
// `notification_preference.organization_id` as `.notNull()`, but the migrated
// public table leaves it NULLABLE — migration 0017 added the column as a nullable
// uuid and its `SET NOT NULL` ALTER is commented out (0019 only sets NOT NULL when
// it CREATEs the table fresh, which it skips IF the 0010/0017 table already exists).
// The scratch harness copies the LIVE (nullable) column. To stay robust regardless
// of which side wins, every seed below sets `organizationId` explicitly: the
// handler inserts `ctx.organizationId`, and the manual dup-insert passes it directly.
// (Source not changed — flagged as a real schema-vs-migration drift in the report.)
describe('updateMyNotificationPreferences — per-category upsert (real DB)', () => {
  test('INSERT branch: a new category preference is persisted (201) with toggles', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const { ctx } = makeRealCtx({
      userId: personId,
      organizationId: orgId,
      body: { preferences: [{ category: 'dues', pushEnabled: false, emailEnabled: true }] },
    });
    const res = await updateMyNotificationPreferences(ctx);
    expect(res.status).toBe(201);

    const row = await readNotifRow(personId, 'dues');
    expect(row).toBeDefined();
    expect(row.category).toBe('dues');
    expect(row.push_enabled).toBe(false); // requested override (default true)
    expect(row.email_enabled).toBe(true); // requested override (default false)
    expect(row.organization_id).toBe(orgId);
    expect(row.version).toBe(1);
  });

  test('UPDATE branch: a second toggle on the SAME category updates the same row (200), merging unspecified', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    // First: disable push, enable email.
    await updateMyNotificationPreferences(
      makeRealCtx({
        userId: personId, organizationId: orgId,
        body: { preferences: [{ category: 'events', pushEnabled: false, emailEnabled: true }] },
      }).ctx,
    );
    const after1 = await readNotifRow(personId, 'events');

    // Second: flip ONLY pushEnabled back on. emailEnabled must be preserved from
    // the existing row (the `?? existing ?? default` merge).
    const r2 = await updateMyNotificationPreferences(
      makeRealCtx({
        userId: personId, organizationId: orgId,
        body: { preferences: [{ category: 'events', pushEnabled: true }] },
      }).ctx,
    );
    expect(r2.status).toBe(200);

    const after2 = await readNotifRow(personId, 'events');
    expect(await countNotifRows(personId, 'events')).toBe(1); // same row, no dup
    expect(after2.id).toBe(after1.id);
    expect(after2.push_enabled).toBe(true);   // newly set (flipped false→true on same row)
    expect(after2.email_enabled).toBe(true);  // preserved from existing
    // Same as privacy: version is NOT bumped on update. updateMyNotificationPreferences
    // does `.set({ ...updates, updatedAt })` with no version increment, and the column
    // has no `$onUpdate`/trigger — so it stays at its default. The real invariant the
    // UPDATE branch owns is that push_enabled actually persisted its new value (asserted
    // above). Pin version to current behavior (was a test-expectation bug).
    expect(after2.version).toBe(after1.version); // not bumped (no optimistic-lock write path)
  });

  test('different categories are independent rows for the same person', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await updateMyNotificationPreferences(
      makeRealCtx({ userId: personId, organizationId: orgId, body: { preferences: [{ category: 'dues', emailEnabled: true }] } }).ctx,
    );
    await updateMyNotificationPreferences(
      makeRealCtx({ userId: personId, organizationId: orgId, body: { preferences: [{ category: 'credits', emailEnabled: false }] } }).ctx,
    );
    const dues = await readNotifRow(personId, 'dues');
    const credits = await readNotifRow(personId, 'credits');
    expect(dues.id).not.toBe(credits.id);
    expect(dues.email_enabled).toBe(true);
    expect(credits.email_enabled).toBe(false);
  });

  test('rejects an unknown category and writes nothing', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    const { ctx } = makeRealCtx({
      userId: personId, organizationId: orgId,
      body: { preferences: [{ category: 'not-a-real-category', pushEnabled: true }] },
    });
    await expect(updateMyNotificationPreferences(ctx)).rejects.toThrow('Invalid category');
    expect(await countNotifRows(personId, 'not-a-real-category')).toBe(0);
  });
});

// ─── notification-preferences fail-open read ──────────────────────────────────

describe('getMyNotificationPreferences — fail-open on empty (real DB)', () => {
  test('with NO persisted rows, every category returns the fail-open defaults', async () => {
    if (!H.dbReachable) return;
    const personId = freshId(); // no rows seeded
    const { ctx } = makeRealCtx({ userId: personId });
    const res = await getMyNotificationPreferences(ctx);
    expect(res.status).toBe(200);
    // One synthesized entry per known category, all at the documented defaults.
    expect(res.body).toHaveLength(5);
    for (const entry of res.body) {
      expect(entry.pushEnabled).toBe(true);   // default on
      expect(entry.emailEnabled).toBe(false); // default off
      expect(entry.inApp).toBe(true);         // M02-R8 always on
    }
    const cats = res.body.map((e: any) => e.category).sort();
    expect(cats).toEqual(['announcements', 'credits', 'dues', 'events', 'trainings']);
  });

  test('persisted rows override the defaults per-category; untouched categories keep defaults', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    // Persist a non-default 'dues' pref: push off, email on.
    await updateMyNotificationPreferences(
      makeRealCtx({ userId: personId, organizationId: orgId, body: { preferences: [{ category: 'dues', pushEnabled: false, emailEnabled: true }] } }).ctx,
    );

    const { ctx } = makeRealCtx({ userId: personId });
    const res = await getMyNotificationPreferences(ctx);
    const byCat = new Map(res.body.map((e: any) => [e.category, e]));
    // dues reflects the persisted overrides.
    expect(byCat.get('dues').pushEnabled).toBe(false);
    expect(byCat.get('dues').emailEnabled).toBe(true);
    // events (never persisted) keeps fail-open defaults.
    expect(byCat.get('events').pushEnabled).toBe(true);
    expect(byCat.get('events').emailEnabled).toBe(false);
  });

  test('UNIQUE (person_id, category, organization_id) index is enforced (no dup category rows)', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await updateMyNotificationPreferences(
      makeRealCtx({ userId: personId, organizationId: orgId, body: { preferences: [{ category: 'dues', emailEnabled: true }] } }).ctx,
    );
    // A manual dup insert with the SAME (person, category, org) must violate the
    // real `notif_pref_person_cat_org_idx` UNIQUE index.
    await expect(
      H.scopedPool.query(
        `INSERT INTO "${H.schema}".notification_preference (id, person_id, organization_id, category)
         VALUES ($1,$2,$3,$4)`,
        [freshId(), personId, orgId, 'dues'],
      ),
    ).rejects.toThrow();
    expect(await countNotifRows(personId, 'dues')).toBe(1);
  });
});

// ─── getPerson owner-only authorization ───────────────────────────────────────

describe('getPerson — owner-only authorization (real DB)', () => {
  test('owner reading their OWN record returns 200 with the persisted person', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    await insertPerson({ id: personId, firstName: 'Ada', lastName: 'Lovelace', licenseNumber: 'LIC-1' });

    const { ctx } = makeRealCtx({ userId: personId, params: { person: personId } });
    const res = await getPerson(ctx);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(personId);
    expect(res.body.firstName).toBe('Ada');
    expect(res.body.lastName).toBe('Lovelace');
  });

  test('"me" resolves to the authenticated user and returns 200', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    await insertPerson({ id: personId, firstName: 'Grace' });

    const { ctx } = makeRealCtx({ userId: personId, params: { person: 'me' } });
    const res = await getPerson(ctx);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(personId);
  });

  test('reading ANOTHER person\'s id is forbidden (403) — even though the row exists', async () => {
    if (!H.dbReachable) return;
    const owner = freshId();
    const intruder = freshId();
    await insertPerson({ id: owner, firstName: 'Owner' });

    // intruder is authenticated, requests owner's id → owner-only guard fires.
    const { ctx } = makeRealCtx({ userId: intruder, params: { person: owner } });
    await expect(getPerson(ctx)).rejects.toThrow('Access denied');
  });

  test('a non-existent person id returns NotFound (checked before owner guard short-circuits)', async () => {
    if (!H.dbReachable) return;
    const userId = freshId();
    const missing = freshId();
    const { ctx } = makeRealCtx({ userId, params: { person: missing } });
    await expect(getPerson(ctx)).rejects.toThrow('Person not found');
  });
});

// ─── membership-scoped ID-card read ───────────────────────────────────────────

describe('getMyIdCard — membership-scoped read (real DB)', () => {
  test('assembles the card from the real person + membership rows for the org', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await insertPerson({ id: personId, firstName: 'Card', lastName: 'Holder', licenseNumber: 'PRC-99' });
    // gracePeriod (not 'active') → skips the lazy member-card credential branch,
    // keeping this read self-contained to person + membership + organization.
    await insertMembership({ personId, organizationId: orgId, status: 'gracePeriod', duesExpiryDate: '2027-01-01' });
    // Org name is read from organization; absent row falls back to 'Unknown Organization'.
    // The real organization table carries several NOT NULL columns with no default
    // (the LIKE INCLUDING ALL copy keeps the constraints; the FK to `association` is NOT
    // copied): `association_id` (uuid — any value, no parent row needed), `slug`, and
    // `org_type` (the org_type enum — a bound $N enum param needs an explicit ::org_type
    // cast). `status` defaults to 'trial'. Set them all so the seed inserts cleanly.
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".organization (id, name, association_id, slug, org_type)
       VALUES ($1,$2,$3,$4,$5::org_type)`,
      [orgId, 'Test Dental Society', freshId(), `org-${orgId.slice(0, 8)}`, 'society'],
    );

    const { ctx } = makeRealCtx({ userId: personId, params: { orgId } });
    const res = await getMyIdCard(ctx);
    // getMyIdCard wraps the payload in { data }.
    expect(res.body.data.personId).toBe(personId);
    expect(res.body.data.firstName).toBe('Card');
    expect(res.body.data.lastName).toBe('Holder');
    expect(res.body.data.licenseNumber).toBe('PRC-99');
    expect(res.body.data.membershipStatus).toBe('gracePeriod');
    expect(res.body.data.organizationName).toBe('Test Dental Society');
    // validUntil mirrors the membership dues_expiry_date (date-only, TZ-stable).
    expect(String(res.body.data.validUntil)).toContain('2027-01-01');
    // QR payload + signature are present (HMAC signed with the test secret).
    expect(typeof res.body.data.qrPayload).toBe('string');
    expect(res.body.data.qrSignature).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  test('returns 400 when orgId path param is missing', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const { ctx } = makeRealCtx({ userId: personId, params: {} });
    const res = await getMyIdCard(ctx);
    expect(res.status).toBe(400);
  });

  test('a person with no membership in the org still renders a card with unknown status (membership-scoped, fail-open)', async () => {
    if (!H.dbReachable) return;
    const personId = freshId();
    const orgId = freshId();
    await insertPerson({ id: personId, firstName: 'NoMember' });
    // No membership row for (person, org).
    const { ctx } = makeRealCtx({ userId: personId, params: { orgId } });
    const res = await getMyIdCard(ctx);
    expect(res.body.data.personId).toBe(personId);
    expect(res.body.data.membershipStatus).toBe('unknown');
    expect(res.body.data.validUntil).toBeNull();
  });
});
