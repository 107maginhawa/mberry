/**
 * Real-DB integration tests for the credentials-domain repositories.
 *
 * The credentials feature spans four tables and four repos:
 *   - professional_license      → ProfessionalLicenseRepository   (credits.repo.ts)
 *   - license_renewal_alert     → LicenseRenewalAlertRepository   (credits.repo.ts)
 *   - credential_template       → CredentialTemplateRepository    (credentials.repo.ts)
 *   - digital_credential        → DigitalCredentialRepository     (credentials.repo.ts)
 *
 * The existing mock tests (credentials.repo.coverage.test.ts,
 * licenseRenewalProcessor.test.ts) only inspect the Drizzle call shape — they
 * assert "a where clause was attached" or capture stubbed inserts. They cannot
 * catch an org-scope leak, a wrong ilike (the `q` search is case-insensitive
 * partial-match — a mock never proves that), a status/jurisdiction filter that
 * matches the wrong rows, a findByQrPayload that returns a NULL-token row, a
 * findMany ordering regression, the DEFAULT_QUERY_LIMIT cap, or the
 * renewal-alert idempotency dedupe + window-selection math, because no query
 * ever runs against Postgres.
 *
 * This suite drives the actual repos AND the license-renewal-alert generator
 * (processLicenseRenewalAlerts) against REAL rows so the WHERE predicates,
 * date BETWEEN window, ilike, org-scoping, status gates, ordering, pagination,
 * the HMAC-token lookup, and the alert dedupe/window selection all execute
 * end-to-end — asserting the REAL returned data and the persisted row state
 * read back from Postgres, not "no throw".
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real
 * column/default/check is present — no hand-DDL drift. FKs are not copied, so
 * rows insert directly without parent org/person/template fixtures. search_path
 * is pinned via the libpq startup option (no pool-churn race).
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  ProfessionalLicenseRepository,
  LicenseRenewalAlertRepository,
} from './credits.repo';
import {
  CredentialTemplateRepository,
  DigitalCredentialRepository,
} from './credentials.repo';
import { processLicenseRenewalAlerts } from '@/handlers/association:member/jobs/licenseRenewalProcessor';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const PERSON_1 = '00000000-0000-4000-8000-0000000000c1';
const PERSON_2 = '00000000-0000-4000-8000-0000000000c2';

function freshId(): string {
  return crypto.randomUUID();
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// ─── raw-insert helpers ───────────────────────────────────────────────────
// Raw SQL (rather than the repo) lets us seed arbitrary status/date/createdAt
// combinations the repo write-path wouldn't normally produce, so the read-side
// filters can be proven against adversarial data. We set every real NOT NULL
// column that has no default and rely on column defaults for the rest
// (id/created_at/updated_at/version are defaulted by baseEntityFields).

async function insertLicense(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  licenseType?: string;
  licenseNumber?: string;
  issuingAuthority?: string;
  jurisdiction?: string;
  issuedDate?: string;
  expirationDate?: string;
  status?: 'active' | 'expired' | 'suspended' | 'revoked' | 'pending';
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".professional_license
       (id, organization_id, person_id, license_type, license_number,
        issuing_authority, jurisdiction, issued_date, expiration_date, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? PERSON_1,
      opts.licenseType ?? 'Dentist',
      opts.licenseNumber ?? 'LIC-001',
      opts.issuingAuthority ?? 'PRC',
      opts.jurisdiction ?? 'Philippines',
      opts.issuedDate ?? '2020-01-01',
      opts.expirationDate ?? '2030-01-01',
      opts.status ?? 'active',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

async function insertAlert(opts: {
  id?: string;
  organizationId?: string;
  licenseId?: string;
  personId?: string;
  alertDate?: string;
  daysUntilExpiry?: number;
  status?: 'pending' | 'sent' | 'acknowledged' | 'dismissed';
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".license_renewal_alert
       (id, organization_id, license_id, person_id, alert_date, days_until_expiry, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.licenseId ?? freshId(),
      opts.personId ?? PERSON_1,
      opts.alertDate ?? '2026-06-01',
      opts.daysUntilExpiry ?? 30,
      opts.status ?? 'pending',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

async function insertTemplate(opts: {
  id?: string;
  organizationId?: string;
  name?: string;
  type?: 'memberCard' | 'certificate' | 'badge' | 'license';
  status?: 'active' | 'retired';
  validityPeriod?: number | null;
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".credential_template
       (id, organization_id, name, type, status, validity_period, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.name ?? 'Member Card',
      opts.type ?? 'memberCard',
      opts.status ?? 'active',
      opts.validityPeriod ?? null,
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

async function insertDigitalCredential(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  templateId?: string;
  credentialNumber?: string;
  status?: 'active' | 'suspended' | 'revoked' | 'expired';
  qrPayload?: string | null;
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".digital_credential
       (id, organization_id, person_id, template_id, credential_number,
        credential_dc_status, qr_payload, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? PERSON_1,
      opts.templateId ?? freshId(),
      opts.credentialNumber ?? 'CRED-0001',
      opts.status ?? 'active',
      'qrPayload' in opts ? opts.qrPayload : null,
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch([
    'professional_license',
    'license_renewal_alert',
    'credential_template',
    'digital_credential',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// ProfessionalLicenseRepository — license CRUD + filter matrix
// ═══════════════════════════════════════════════════════════════════════════

describe('ProfessionalLicenseRepository (real DB)', () => {
  test('createOne persists every field and read-back round-trips', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const org = freshId();
    const person = freshId();

    const created = await repo.createOne({
      organizationId: org,
      personId: person,
      licenseType: 'Physician',
      licenseNumber: 'MD-77',
      issuingAuthority: 'PRC',
      jurisdiction: 'Manila',
      issuedDate: '2021-05-01',
      expirationDate: '2026-05-01',
      status: 'active',
    } as any);

    expect(created.id).toBeTruthy();
    // Read the row straight from Postgres to prove it actually persisted.
    const back = await H.scopedPool.query(
      `SELECT * FROM "${H.schema}".professional_license WHERE id = $1`,
      [created.id],
    );
    expect(back.rows).toHaveLength(1);
    expect(back.rows[0].license_number).toBe('MD-77');
    expect(back.rows[0].jurisdiction).toBe('Manila');
    expect(back.rows[0].status).toBe('active');
    // baseEntityFields defaults applied.
    expect(back.rows[0].version).toBe(1);
    expect(back.rows[0].created_at).toBeTruthy();
  });

  test('findOneById returns the row; missing id → null', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const id = await insertLicense({ licenseNumber: 'FIND-1' });

    const found = await repo.findOneById(id);
    expect(found?.id).toBe(id);
    expect(found?.licenseNumber).toBe('FIND-1');

    expect(await repo.findOneById(freshId())).toBeNull();
  });

  test('findMany org filter isolates rows from another organization', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertLicense({ organizationId: orgX });
    await insertLicense({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('findMany narrows by personId + status + licenseType + jurisdiction', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const org = freshId();
    const target = await insertLicense({
      organizationId: org, personId: PERSON_1, status: 'active',
      licenseType: 'Dentist', jurisdiction: 'Cebu',
    });
    // Same org but each row trips exactly one filter, so none should match the AND.
    await insertLicense({ organizationId: org, personId: PERSON_2, status: 'active', licenseType: 'Dentist', jurisdiction: 'Cebu' }); // wrong person
    await insertLicense({ organizationId: org, personId: PERSON_1, status: 'expired', licenseType: 'Dentist', jurisdiction: 'Cebu' }); // wrong status
    await insertLicense({ organizationId: org, personId: PERSON_1, status: 'active', licenseType: 'Physician', jurisdiction: 'Cebu' }); // wrong type
    await insertLicense({ organizationId: org, personId: PERSON_1, status: 'active', licenseType: 'Dentist', jurisdiction: 'Manila' }); // wrong jurisdiction

    const rows = await repo.findMany({
      organizationId: org, personId: PERSON_1, status: 'active',
      licenseType: 'Dentist', jurisdiction: 'Cebu',
    });
    expect(rows.map((r) => r.id)).toEqual([target]);
  });

  test('status filter selects exactly the matching license states', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertLicense({ organizationId: org, status: 'active' });
    await insertLicense({ organizationId: org, status: 'expired' });
    await insertLicense({ organizationId: org, status: 'revoked' });
    await insertLicense({ organizationId: org, status: 'suspended' });

    const rows = await repo.findMany({ organizationId: org, status: 'active' });
    expect(rows.map((r) => r.id)).toEqual([active]);
  });

  test('findMany with no filters orders by created_at ascending', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const org = freshId();
    const second = await insertLicense({ organizationId: org, createdAt: new Date('2026-02-01T00:00:00Z') });
    const first = await insertLicense({ organizationId: org, createdAt: new Date('2026-01-01T00:00:00Z') });
    const third = await insertLicense({ organizationId: org, createdAt: new Date('2026-03-01T00:00:00Z') });

    const rows = await repo.findMany({ organizationId: org });
    expect(rows.map((r) => r.id)).toEqual([first, second, third]);
  });

  test('updateOneById mutates the row, bumps version, and persists', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const id = await insertLicense({ status: 'active', expirationDate: '2030-01-01' });

    const updated = await repo.updateOneById(id, { status: 'expired' } as any);
    expect(updated.status).toBe('expired');
    expect(updated.version).toBe(2); // base repo does version + 1

    const back = await H.scopedPool.query(
      `SELECT status, version FROM "${H.schema}".professional_license WHERE id = $1`,
      [id],
    );
    expect(back.rows[0].status).toBe('expired');
    expect(back.rows[0].version).toBe(2);
  });

  test('deleteOneById removes the row from Postgres', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const id = await insertLicense();
    await repo.deleteOneById(id);

    const back = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".professional_license WHERE id = $1`,
      [id],
    );
    expect(back.rows).toHaveLength(0);
    expect(await repo.findOneById(id)).toBeNull();
  });

  test('count honours filters', async () => {
    if (!H.dbReachable) return;
    const repo = new ProfessionalLicenseRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertLicense({ organizationId: org, status: 'active' });
    await insertLicense({ organizationId: org, status: 'active' });
    await insertLicense({ organizationId: org, status: 'expired' });

    expect(await repo.count({ organizationId: org })).toBe(3);
    expect(await repo.count({ organizationId: org, status: 'active' })).toBe(2);
    expect(await repo.count({ organizationId: freshId() })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LicenseRenewalAlertRepository — filter matrix
// ═══════════════════════════════════════════════════════════════════════════

describe('LicenseRenewalAlertRepository (real DB)', () => {
  test('findMany scopes by licenseId and excludes other licenses', async () => {
    if (!H.dbReachable) return;
    const repo = new LicenseRenewalAlertRepository(H.db as any, noopLogger);
    const lic = freshId();
    const a = await insertAlert({ licenseId: lic });
    const b = await insertAlert({ licenseId: lic });
    await insertAlert({ licenseId: freshId() }); // different license

    const rows = await repo.findMany({ licenseId: lic });
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([a, b]));
  });

  test('findMany narrows by org + person + status together', async () => {
    if (!H.dbReachable) return;
    const repo = new LicenseRenewalAlertRepository(H.db as any, noopLogger);
    const org = freshId();
    const target = await insertAlert({ organizationId: org, personId: PERSON_1, status: 'pending' });
    await insertAlert({ organizationId: org, personId: PERSON_2, status: 'pending' }); // wrong person
    await insertAlert({ organizationId: org, personId: PERSON_1, status: 'acknowledged' }); // wrong status
    await insertAlert({ organizationId: freshId(), personId: PERSON_1, status: 'pending' }); // wrong org

    const rows = await repo.findMany({ organizationId: org, personId: PERSON_1, status: 'pending' });
    expect(rows.map((r) => r.id)).toEqual([target]);
  });

  test('acknowledge via updateOneById flips status and persists daysUntilExpiry untouched', async () => {
    if (!H.dbReachable) return;
    const repo = new LicenseRenewalAlertRepository(H.db as any, noopLogger);
    const id = await insertAlert({ status: 'pending', daysUntilExpiry: 14 });

    const updated = await repo.updateOneById(id, { status: 'acknowledged' } as any);
    expect(updated.status).toBe('acknowledged');

    const back = await H.scopedPool.query(
      `SELECT status, days_until_expiry FROM "${H.schema}".license_renewal_alert WHERE id = $1`,
      [id],
    );
    expect(back.rows[0].status).toBe('acknowledged');
    expect(back.rows[0].days_until_expiry).toBe(14);
  });

  test('count by status reflects only matching rows', async () => {
    if (!H.dbReachable) return;
    const repo = new LicenseRenewalAlertRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertAlert({ organizationId: org, status: 'pending' });
    await insertAlert({ organizationId: org, status: 'pending' });
    await insertAlert({ organizationId: org, status: 'dismissed' });

    expect(await repo.count({ organizationId: org, status: 'pending' })).toBe(2);
    expect(await repo.count({ organizationId: org, status: 'dismissed' })).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// processLicenseRenewalAlerts — renewal-alert GENERATION (real DB)
// ═══════════════════════════════════════════════════════════════════════════

describe('processLicenseRenewalAlerts (real DB generation)', () => {
  const TODAY = new Date('2026-06-01T00:00:00.000Z');

  test('inserts an alert at the smallest matching window for an expiring license', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    // Expires in 25 days → smallest window it falls within is 30.
    const lic = await insertLicense({
      organizationId: org, personId: person, status: 'active',
      expirationDate: toDateStr(addDays(TODAY, 25)),
    });

    const res = await processLicenseRenewalAlerts({ db: H.db as any, now: TODAY });
    expect(res.created).toBeGreaterThanOrEqual(1);

    // alert_date is a Postgres `date`; node-postgres parses oid 1082 into a JS
    // Date (local-midnight), so a bare `.toBe('2026-06-01')` both type-mismatches
    // (Date vs string) and is timezone-fragile across runners. Cast to ::text so
    // Postgres returns the canonical 'YYYY-MM-DD' literal directly, bypassing the
    // JS Date parser entirely — TZ-stable.
    const back = await H.scopedPool.query(
      `SELECT license_id, days_until_expiry, status, alert_date::text AS alert_date,
              organization_id, person_id
         FROM "${H.schema}".license_renewal_alert WHERE license_id = $1`,
      [lic],
    );
    expect(back.rows).toHaveLength(1);
    // window is the smallest ALERT_WINDOW the 25-days-out license falls within (30),
    // not the raw 25; integer column → JS number.
    expect(back.rows[0].days_until_expiry).toBe(30);
    expect(back.rows[0].status).toBe('pending');
    // Repo writes alertDate: toDateStr(today) — assert the same UTC date math.
    expect(back.rows[0].alert_date).toBe(toDateStr(TODAY)); // '2026-06-01'
    expect(back.rows[0].organization_id).toBe(org);
    expect(back.rows[0].person_id).toBe(person);
  });

  test('is idempotent — a second run does not duplicate the (license, window) alert', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const lic = await insertLicense({
      organizationId: org, status: 'active',
      expirationDate: toDateStr(addDays(TODAY, 5)), // 7-day window
    });

    await processLicenseRenewalAlerts({ db: H.db as any, now: TODAY });
    const second = await processLicenseRenewalAlerts({ db: H.db as any, now: TODAY });

    // Second run finds the existing alert and skips it.
    const back = await H.scopedPool.query(
      `SELECT days_until_expiry FROM "${H.schema}".license_renewal_alert WHERE license_id = $1`,
      [lic],
    );
    expect(back.rows).toHaveLength(1);
    expect(back.rows[0].days_until_expiry).toBe(7);
    expect(second.created).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);
  });

  test('ignores non-active licenses and licenses expiring beyond the largest (90d) window', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    // Expired status — must be skipped even though date is near.
    await insertLicense({ organizationId: org, status: 'expired', expirationDate: toDateStr(addDays(TODAY, 10)) });
    // Active but far out (200 days) — beyond the 90-day horizon.
    await insertLicense({ organizationId: org, status: 'active', expirationDate: toDateStr(addDays(TODAY, 200)) });

    await processLicenseRenewalAlerts({ db: H.db as any, now: TODAY });

    const back = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".license_renewal_alert WHERE organization_id = $1`,
      [org],
    );
    expect(back.rows[0].n).toBe(0);
  });

  test('does not re-alert an already-expired-by-date (negative days) active license', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    // Active row whose date is already in the past — the gte(today) scan filter
    // excludes it, so no alert is produced.
    await insertLicense({ organizationId: org, status: 'active', expirationDate: toDateStr(addDays(TODAY, -10)) });

    await processLicenseRenewalAlerts({ db: H.db as any, now: TODAY });

    const back = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".license_renewal_alert WHERE organization_id = $1`,
      [org],
    );
    expect(back.rows[0].n).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CredentialTemplateRepository — filter matrix (org/type/status + ilike q)
// ═══════════════════════════════════════════════════════════════════════════

describe('CredentialTemplateRepository (real DB)', () => {
  test('org filter isolates templates from another organization', async () => {
    if (!H.dbReachable) return;
    const repo = new CredentialTemplateRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertTemplate({ organizationId: orgX });
    await insertTemplate({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('type + status filters narrow to the matching template', async () => {
    if (!H.dbReachable) return;
    const repo = new CredentialTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const target = await insertTemplate({ organizationId: org, type: 'certificate', status: 'active' });
    await insertTemplate({ organizationId: org, type: 'badge', status: 'active' });       // wrong type
    await insertTemplate({ organizationId: org, type: 'certificate', status: 'retired' }); // wrong status

    const rows = await repo.findMany({ organizationId: org, type: 'certificate', status: 'active' });
    expect(rows.map((r) => r.id)).toEqual([target]);
  });

  test('q does a CASE-INSENSITIVE partial ilike on name', async () => {
    if (!H.dbReachable) return;
    const repo = new CredentialTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    const gold = await insertTemplate({ organizationId: org, name: 'Gold Member Badge' });
    await insertTemplate({ organizationId: org, name: 'Silver Certificate' });

    // lower-case query must still hit the mixed-case "Gold ..." name (ilike).
    const rows = await repo.findMany({ organizationId: org, q: 'gold' });
    expect(rows.map((r) => r.id)).toEqual([gold]);

    // partial substring in the middle of the name.
    const mid = await repo.findMany({ organizationId: org, q: 'Member' });
    expect(mid.map((r) => r.id)).toEqual([gold]);

    // no match → empty.
    expect(await repo.findMany({ organizationId: org, q: 'platinum' })).toEqual([]);
  });

  test('default status comes from the column default (active) when not supplied', async () => {
    if (!H.dbReachable) return;
    const repo = new CredentialTemplateRepository(H.db as any, noopLogger);
    const org = freshId();
    // createOne without status → relies on credential_template_status DEFAULT 'active'.
    const created = await repo.createOne({
      organizationId: org, name: 'Defaulted', type: 'license',
    } as any);

    const back = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".credential_template WHERE id = $1`,
      [created.id],
    );
    expect(back.rows[0].status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DigitalCredentialRepository — issue/verify + filter matrix + findByQrPayload
// ═══════════════════════════════════════════════════════════════════════════

describe('DigitalCredentialRepository (real DB)', () => {
  test('createOne (issue) persists with active default status + read-back', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const org = freshId();
    const person = freshId();
    const template = freshId();

    const issued = await repo.createOne({
      organizationId: org,
      personId: person,
      templateId: template,
      credentialNumber: 'CRED-ISSUE-1',
      qrPayload: 'hmac-token-abc',
    } as any);

    expect(issued.id).toBeTruthy();
    const back = await H.scopedPool.query(
      `SELECT credential_number, credential_dc_status, qr_payload, issued_at
         FROM "${H.schema}".digital_credential WHERE id = $1`,
      [issued.id],
    );
    expect(back.rows).toHaveLength(1);
    expect(back.rows[0].credential_number).toBe('CRED-ISSUE-1');
    expect(back.rows[0].credential_dc_status).toBe('active'); // column default
    expect(back.rows[0].qr_payload).toBe('hmac-token-abc');
    expect(back.rows[0].issued_at).toBeTruthy(); // defaultNow()
  });

  test('findByQrPayload (verify) returns the matching credential by HMAC token', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const token = `tok-${freshId()}`;
    const id = await insertDigitalCredential({ qrPayload: token, credentialNumber: 'VERIFY-1' });
    // A different credential with a different token must not be returned.
    await insertDigitalCredential({ qrPayload: `tok-${freshId()}` });

    const found = await repo.findByQrPayload(token);
    expect(found?.id).toBe(id);
    expect(found?.credentialNumber).toBe('VERIFY-1');
    expect(found?.qrPayload).toBe(token);
  });

  test('findByQrPayload returns null for an unknown token', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    await insertDigitalCredential({ qrPayload: `tok-${freshId()}` });
    expect(await repo.findByQrPayload(`missing-${freshId()}`)).toBeNull();
  });

  test('findByQrPayload does NOT match rows with a NULL qr_payload (eq null is unknown)', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    // A credential issued without a token — must never be returned by token lookup,
    // and an empty-string token must not collapse onto NULL rows.
    await insertDigitalCredential({ qrPayload: null });
    expect(await repo.findByQrPayload('')).toBeNull();
  });

  test('revoke via updateOneById flips status to revoked and persists', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const id = await insertDigitalCredential({ status: 'active' });

    const updated = await repo.updateOneById(id, { status: 'revoked' } as any);
    expect(updated.status).toBe('revoked');

    const back = await H.scopedPool.query(
      `SELECT credential_dc_status FROM "${H.schema}".digital_credential WHERE id = $1`,
      [id],
    );
    expect(back.rows[0].credential_dc_status).toBe('revoked');
  });

  test('findMany scopes by org + person + template + status together', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const org = freshId();
    const person = freshId();
    const template = freshId();
    const target = await insertDigitalCredential({
      organizationId: org, personId: person, templateId: template, status: 'active',
    });
    await insertDigitalCredential({ organizationId: org, personId: freshId(), templateId: template, status: 'active' }); // wrong person
    await insertDigitalCredential({ organizationId: org, personId: person, templateId: freshId(), status: 'active' });  // wrong template
    await insertDigitalCredential({ organizationId: org, personId: person, templateId: template, status: 'revoked' });  // wrong status
    await insertDigitalCredential({ organizationId: freshId(), personId: person, templateId: template, status: 'active' }); // wrong org

    const rows = await repo.findMany({
      organizationId: org, personId: person, templateId: template, status: 'active',
    });
    expect(rows.map((r) => r.id)).toEqual([target]);
  });

  test('q does a case-insensitive partial ilike on credential_number', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const org = freshId();
    const hit = await insertDigitalCredential({ organizationId: org, credentialNumber: 'ABC-2026-XYZ' });
    await insertDigitalCredential({ organizationId: org, credentialNumber: 'DEF-2025-QRS' });

    const rows = await repo.findMany({ organizationId: org, q: 'abc-2026' });
    expect(rows.map((r) => r.id)).toEqual([hit]);
  });

  test('findMany with no filters orders by created_at ascending', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const org = freshId();
    const second = await insertDigitalCredential({ organizationId: org, createdAt: new Date('2026-05-02T00:00:00Z') });
    const first = await insertDigitalCredential({ organizationId: org, createdAt: new Date('2026-05-01T00:00:00Z') });
    const third = await insertDigitalCredential({ organizationId: org, createdAt: new Date('2026-05-03T00:00:00Z') });

    const rows = await repo.findMany({ organizationId: org });
    expect(rows.map((r) => r.id)).toEqual([first, second, third]);
  });

  test('findMany honours pagination limit + offset over the created_at order', async () => {
    if (!H.dbReachable) return;
    const repo = new DigitalCredentialRepository(H.db as any, noopLogger);
    const org = freshId();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        await insertDigitalCredential({
          organizationId: org,
          createdAt: new Date(`2026-07-0${i + 1}T00:00:00Z`),
        }),
      );
    }

    const page = await repo.findMany({ organizationId: org }, { pagination: { offset: 1, limit: 2 } });
    expect(page.map((r) => r.id)).toEqual([ids[1], ids[2]]);
  });
});
