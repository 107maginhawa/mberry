/**
 * Real-DB integration tests for the platform-admin repositories.
 *
 * Two source files, both very thinly covered before this suite:
 *   - dashboard.repo.ts        (~8% line) — DashboardRepository: chapter
 *     snapshots, national-officer access grants (BR-36), export logs, and the
 *     cross-chapter aggregate computed in JS over real snapshot rows.
 *   - platform-admin.repo.ts   (~27% line) — the five admin CRUD repos
 *     (Association / Organization / FeatureFlag / PlatformAdmin /
 *     ImpersonationSession). These back platform-tier ops + the port adapters
 *     consumed by core middleware.
 *
 * These drive the actual drizzle query builders against REAL Postgres rows so
 * WHERE predicates, RETURNING, upsert branches, inArray, selectDistinct, and the
 * revoke/end soft-update paths all execute end-to-end.
 *
 * Pattern mirrors dues/repos/dues-repos.integration.test.ts: a per-run scratch
 * schema with hand-written DDL for ONLY the tables the exercised methods touch.
 * Enums modelled as `text`; numeric columns as `numeric`. Requires a reachable
 * Postgres (DATABASE_URL or the repo default); skips cleanly if unreachable.
 *
 * SKIPPED (untestable without re-creating large slices of schema):
 *   - featureFlagRepoPort.findEnforcementFlags — joins organization +
 *     subscription + pricing_tier (3 extra tables, dynamic import); the
 *     enforcement-precedence logic is the gate's job, not the repo's. Out of scope.
 *   - DashboardRepository.getAssociationAggregate's downstream handler usage —
 *     we test the aggregate math directly via seeded snapshots (the repo method
 *     reads only chapter_snapshot, so it IS covered).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DashboardRepository } from './dashboard.repo';
import {
  AssociationRepository,
  OrganizationRepository,
  FeatureFlagRepository,
  PlatformAdminRepository,
  ImpersonationSessionRepository,
} from './platform-admin.repo';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TEST_SCHEMA = `platformadmin_repos_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let setupPool: Pool;
let scopedPool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

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

  // ── dashboard.repo tables ───────────────────────────────────────────────

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".chapter_snapshot (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      association_id uuid NOT NULL,
      snapshot_month varchar(7) NOT NULL,
      total_members integer NOT NULL,
      active_members integer,
      grace_members integer,
      lapsed_members integer,
      suspended_members integer,
      collection_rate numeric,
      total_collected numeric,
      total_expected numeric,
      cpd_compliance_rate numeric,
      avg_credits_per_member numeric,
      activity_count_90d integer,${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".national_dashboard_access (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id uuid NOT NULL,
      member_id uuid NOT NULL,
      granted_by uuid NOT NULL,
      granted_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz,${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".dashboard_export_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exported_by uuid NOT NULL,
      association_id uuid NOT NULL,
      report_type text NOT NULL,
      scope text NOT NULL,
      date_range_start timestamptz NOT NULL,
      date_range_end timestamptz NOT NULL,
      output_format text NOT NULL,${baseCols}
    )
  `);

  // ── platform-admin.repo tables ──────────────────────────────────────────

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".association (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      country varchar(2) NOT NULL,
      currency varchar(3) NOT NULL,
      locale varchar(10) DEFAULT 'en',
      license_format_regex varchar(500),
      credit_cycle_period integer,
      required_credits_per_cycle integer,
      carryover_enabled boolean DEFAULT false,
      cycle_start_month integer,
      cycle_start_day integer,
      status varchar(20) NOT NULL DEFAULT 'active',${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".organization (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      association_id uuid NOT NULL,
      name varchar(255) NOT NULL,
      slug varchar(100) NOT NULL,
      org_type text NOT NULL DEFAULT 'chapter',
      region varchar(100),
      contact_email varchar(255),
      status text NOT NULL DEFAULT 'trial',
      trial_start_date timestamptz,
      trial_end_date timestamptz,
      feature_flags jsonb,${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".feature_flag (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_type varchar(50) NOT NULL,
      target_id varchar(255) NOT NULL,
      module_name varchar(100) NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      is_override boolean NOT NULL DEFAULT false,${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".platform_admin (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE,
      email varchar(255) NOT NULL UNIQUE,
      name varchar(200) NOT NULL,
      role text NOT NULL,${baseCols}
    )
  `);

  await client.query(`
    CREATE TABLE "${TEST_SCHEMA}".impersonation_session (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id uuid NOT NULL,
      target_user_id uuid NOT NULL,
      target_org_id uuid,
      session_token varchar(255) NOT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      ended_at timestamptz,${baseCols}
    )
  `);
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
    console.warn(`[platformadmin-repos integration] Postgres unreachable, skipping: ${(err as Error).message}`);
    return;
  }

  scopedPool = new Pool({
    connectionString: DB_URL,
    options: `-c search_path="${TEST_SCHEMA}",public`,
    max: 4,
    connectionTimeoutMillis: 15000,
  });
  db = drizzle(scopedPool);
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

// ════════════════════════════════════════════════════════════════════════
//  DashboardRepository
// ════════════════════════════════════════════════════════════════════════

describe('DashboardRepository chapter snapshots (real DB)', () => {
  test('createChapterSnapshot + listChapterSnapshots round-trips, scoped by assoc+month', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const assoc = freshId();
    const month = '2026-01';

    await repo.createChapterSnapshot({
      orgId: freshId(),
      associationId: assoc,
      snapshotMonth: month,
      totalMembers: 100,
      activeMembers: 80,
    } as any);
    // A snapshot for a different month (excluded).
    await repo.createChapterSnapshot({
      orgId: freshId(),
      associationId: assoc,
      snapshotMonth: '2026-02',
      totalMembers: 50,
    } as any);

    const rows = await repo.listChapterSnapshots(assoc, month);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.totalMembers).toBe(100);
    expect(rows[0]!.snapshotMonth).toBe(month);
  });

  test('getChapterSnapshot fetches a single org/month row, optionally assoc-scoped', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const assoc = freshId();
    const org = freshId();
    const month = '2026-03';
    await repo.createChapterSnapshot({
      orgId: org,
      associationId: assoc,
      snapshotMonth: month,
      totalMembers: 42,
    } as any);

    const found = await repo.getChapterSnapshot(org, month);
    expect(found?.totalMembers).toBe(42);

    // Wrong association → no match even with right org/month.
    expect(await repo.getChapterSnapshot(org, month, freshId())).toBeUndefined();
    // Right association → match.
    expect((await repo.getChapterSnapshot(org, month, assoc))?.orgId).toBe(org);
  });

  test('listAssociationIdsForMonth returns distinct association ids for the month', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const month = '2026-09';
    const assocA = freshId();
    const assocB = freshId();
    // Two snapshots for assocA (should dedupe), one for assocB.
    await repo.createChapterSnapshot({ orgId: freshId(), associationId: assocA, snapshotMonth: month, totalMembers: 1 } as any);
    await repo.createChapterSnapshot({ orgId: freshId(), associationId: assocA, snapshotMonth: month, totalMembers: 2 } as any);
    await repo.createChapterSnapshot({ orgId: freshId(), associationId: assocB, snapshotMonth: month, totalMembers: 3 } as any);

    const ids = await repo.listAssociationIdsForMonth(month);
    expect(ids).toContain(assocA);
    expect(ids).toContain(assocB);
    // Distinct: assocA appears once.
    expect(ids.filter((i) => i === assocA)).toHaveLength(1);
  });

  test('getAssociationAggregate computes sums + weighted rates over real snapshot rows', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const assoc = freshId();
    const month = '2026-06';

    // Chapter 1: 100 members, 50% cpd, 90% collection (900/1000)
    await repo.createChapterSnapshot({
      orgId: freshId(), associationId: assoc, snapshotMonth: month,
      totalMembers: 100, activeMembers: 70, graceMembers: 10, lapsedMembers: 15, suspendedMembers: 5,
      totalCollected: '900', totalExpected: '1000',
      cpdComplianceRate: '0.5', avgCreditsPerMember: '10', activityCount90d: 30,
    } as any);
    // Chapter 2: 200 members, 80% cpd, 75% collection (1500/2000)
    await repo.createChapterSnapshot({
      orgId: freshId(), associationId: assoc, snapshotMonth: month,
      totalMembers: 200, activeMembers: 150, graceMembers: 20, lapsedMembers: 20, suspendedMembers: 10,
      totalCollected: '1500', totalExpected: '2000',
      cpdComplianceRate: '0.8', avgCreditsPerMember: '20', activityCount90d: 70,
    } as any);

    const agg = await repo.getAssociationAggregate(assoc, month);
    expect(agg.chapterCount).toBe(2);
    expect(agg.totalMembers).toBe(300);
    expect(agg.activeMembers).toBe(220);
    expect(agg.totalCollected).toBe(2400);
    expect(agg.totalExpected).toBe(3000);
    // collectionRate = 2400/3000 = 0.8
    expect(agg.collectionRate).toBeCloseTo(0.8, 5);
    // weighted cpd = (0.5*100 + 0.8*200)/300 = (50+160)/300 = 0.7
    expect(agg.cpdComplianceRate).toBeCloseTo(0.7, 5);
    // weighted avg credits = (10*100 + 20*200)/300 = (1000+4000)/300 = 16.666...
    expect(agg.avgCreditsPerMember).toBeCloseTo(16.6667, 3);
    expect(agg.totalActivityCount90d).toBe(100);
  });

  test('getAssociationAggregate returns zeroed rates when no snapshots exist', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const agg = await repo.getAssociationAggregate(freshId(), '1999-01');
    expect(agg.chapterCount).toBe(0);
    expect(agg.totalMembers).toBe(0);
    expect(agg.collectionRate).toBe(0);
    expect(agg.cpdComplianceRate).toBe(0);
    expect(agg.avgCreditsPerMember).toBe(0);
  });
});

describe('DashboardRepository national officer access — BR-36 (real DB)', () => {
  test('grant → isDesignatedNationalOfficer true; revoke → false', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const assoc = freshId();
    const member = freshId();

    expect(await repo.isDesignatedNationalOfficer(member, assoc)).toBe(false);

    const grant = await repo.grantNationalAccess({
      associationId: assoc,
      memberId: member,
      grantedBy: freshId(),
    } as any);
    expect(grant.id).toBeTruthy();
    expect(grant.revokedAt).toBeNull();

    expect(await repo.isDesignatedNationalOfficer(member, assoc)).toBe(true);

    const revoked = await repo.revokeNationalAccess(grant.id);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);

    // BR-36: revoked grant no longer confers access.
    expect(await repo.isDesignatedNationalOfficer(member, assoc)).toBe(false);
  });

  test('isDesignatedNationalOfficer is scoped per association', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const member = freshId();
    const assocA = freshId();
    const assocB = freshId();
    await repo.grantNationalAccess({ associationId: assocA, memberId: member, grantedBy: freshId() } as any);

    expect(await repo.isDesignatedNationalOfficer(member, assocA)).toBe(true);
    // Grant for assocA does not leak to assocB.
    expect(await repo.isDesignatedNationalOfficer(member, assocB)).toBe(false);
  });

  test('getOfficerAssociationIds returns only active (non-revoked) grants, deduped', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const member = freshId();
    const assocA = freshId();
    const assocB = freshId();
    await repo.grantNationalAccess({ associationId: assocA, memberId: member, grantedBy: freshId() } as any);
    await repo.grantNationalAccess({ associationId: assocB, memberId: member, grantedBy: freshId() } as any);
    const revokable = await repo.grantNationalAccess({ associationId: freshId(), memberId: member, grantedBy: freshId() } as any);
    await repo.revokeNationalAccess(revokable.id);

    const ids = await repo.getOfficerAssociationIds(member);
    expect(ids).toContain(assocA);
    expect(ids).toContain(assocB);
    expect(ids).not.toContain(revokable.associationId);
    expect(ids).toHaveLength(2);
  });
});

describe('DashboardRepository org names + export logs (real DB)', () => {
  test('getOrgNames maps ids → names; empty input returns empty map', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const orgRepo = new OrganizationRepository(db as any);
    const assoc = freshId();
    const o1 = await orgRepo.create({ associationId: assoc, name: 'Alpha Chapter', slug: `alpha-${freshId()}`, orgType: 'chapter' } as any);
    const o2 = await orgRepo.create({ associationId: assoc, name: 'Beta Chapter', slug: `beta-${freshId()}`, orgType: 'chapter' } as any);

    expect((await repo.getOrgNames([])).size).toBe(0);

    const map = await repo.getOrgNames([o1.id, o2.id]);
    expect(map.get(o1.id)).toBe('Alpha Chapter');
    expect(map.get(o2.id)).toBe('Beta Chapter');
  });

  test('createExportLog persists the immutable audit row', async () => {
    if (!dbReachable) return;
    const repo = new DashboardRepository(db as any);
    const log = await repo.createExportLog({
      exportedBy: freshId(),
      associationId: freshId(),
      reportType: 'association_summary',
      scope: 'all_chapters',
      dateRangeStart: new Date('2026-01-01'),
      dateRangeEnd: new Date('2026-01-31'),
      outputFormat: 'csv',
    } as any);
    expect(log.id).toBeTruthy();
    expect(log.reportType).toBe('association_summary');
    expect(log.outputFormat).toBe('csv');
    expect(log.scope).toBe('all_chapters');
  });
});

// ════════════════════════════════════════════════════════════════════════
//  AssociationRepository
// ════════════════════════════════════════════════════════════════════════

describe('AssociationRepository CRUD (real DB)', () => {
  test('create → findById / findByName, update, delete', async () => {
    if (!dbReachable) return;
    const repo = new AssociationRepository(db as any);
    const name = `Assoc-${freshId()}`;
    const created = await repo.create({ name, country: 'PH', currency: 'PHP' } as any);
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('active');

    expect((await repo.findById(created.id))?.name).toBe(name);
    expect((await repo.findByName(name))?.id).toBe(created.id);
    expect(await repo.findByName(`missing-${freshId()}`)).toBeUndefined();

    const updated = await repo.update(created.id, { status: 'suspended' } as any);
    expect(updated?.status).toBe('suspended');

    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeUndefined();
  });

  test('findAll returns created associations', async () => {
    if (!dbReachable) return;
    const repo = new AssociationRepository(db as any);
    const a = await repo.create({ name: `FindAll-${freshId()}`, country: 'PH', currency: 'PHP' } as any);
    const all = await repo.findAll();
    expect(all.some((x) => x.id === a.id)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  OrganizationRepository
// ════════════════════════════════════════════════════════════════════════

describe('OrganizationRepository CRUD + scoping (real DB)', () => {
  test('create → findById / findBySlug / findByNameInAssociation', async () => {
    if (!dbReachable) return;
    const repo = new OrganizationRepository(db as any);
    const assoc = freshId();
    const slug = `org-${freshId()}`;
    const created = await repo.create({ associationId: assoc, name: 'Manila Chapter', slug, orgType: 'chapter' } as any);
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('trial');

    expect((await repo.findById(created.id))?.slug).toBe(slug);
    expect((await repo.findBySlug(slug))?.id).toBe(created.id);
    expect((await repo.findByNameInAssociation('Manila Chapter', assoc))?.id).toBe(created.id);
    // Same name in a DIFFERENT association → not found.
    expect(await repo.findByNameInAssociation('Manila Chapter', freshId())).toBeUndefined();
  });

  test('findByAssociation scopes orgs to their association', async () => {
    if (!dbReachable) return;
    const repo = new OrganizationRepository(db as any);
    const assocA = freshId();
    const assocB = freshId();
    await repo.create({ associationId: assocA, name: 'A1', slug: `a1-${freshId()}`, orgType: 'chapter' } as any);
    await repo.create({ associationId: assocA, name: 'A2', slug: `a2-${freshId()}`, orgType: 'chapter' } as any);
    await repo.create({ associationId: assocB, name: 'B1', slug: `b1-${freshId()}`, orgType: 'chapter' } as any);

    const aOrgs = await repo.findByAssociation(assocA);
    expect(aOrgs).toHaveLength(2);
    expect(aOrgs.every((o) => o.associationId === assocA)).toBe(true);
    expect(await repo.findByAssociation(assocB)).toHaveLength(1);
  });

  test('findAll filters by status when provided, update mutates row', async () => {
    if (!dbReachable) return;
    const repo = new OrganizationRepository(db as any);
    const assoc = freshId();
    const active = await repo.create({ associationId: assoc, name: 'Act', slug: `act-${freshId()}`, orgType: 'chapter', status: 'active' } as any);
    await repo.create({ associationId: assoc, name: 'Trl', slug: `trl-${freshId()}`, orgType: 'chapter', status: 'trial' } as any);

    const activeOnly = await repo.findAll('active');
    expect(activeOnly.some((o) => o.id === active.id)).toBe(true);
    expect(activeOnly.every((o) => o.status === 'active')).toBe(true);

    const updated = await repo.update(active.id, { status: 'suspended' } as any);
    expect(updated?.status).toBe('suspended');
  });
});

// ════════════════════════════════════════════════════════════════════════
//  FeatureFlagRepository
// ════════════════════════════════════════════════════════════════════════

describe('FeatureFlagRepository (real DB)', () => {
  test('upsert inserts then updates the same (target,module) row in place', async () => {
    if (!dbReachable) return;
    const repo = new FeatureFlagRepository(db as any);
    const targetId = freshId();
    const first = await repo.upsert({ targetType: 'org', targetId, moduleName: 'events', enabled: true } as any);
    expect(first.enabled).toBe(true);

    // Same key, enabled flipped → updates existing row (no new row).
    const second = await repo.upsert({ targetType: 'org', targetId, moduleName: 'events', enabled: false } as any);
    expect(second.id).toBe(first.id);
    expect(second.enabled).toBe(false);

    const byTarget = await repo.findByTarget('org', targetId);
    expect(byTarget).toHaveLength(1);
  });

  test('findByTarget filters; findById + delete behave', async () => {
    if (!dbReachable) return;
    const repo = new FeatureFlagRepository(db as any);
    const targetId = freshId();
    const flag = await repo.upsert({ targetType: 'association', targetId, moduleName: 'dues', enabled: true } as any);

    expect((await repo.findById(flag.id))?.id).toBe(flag.id);
    const filtered = await repo.findByTarget('association', targetId);
    expect(filtered.every((f) => f.targetType === 'association' && f.targetId === targetId)).toBe(true);

    await repo.delete(flag.id);
    expect(await repo.findById(flag.id)).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PlatformAdminRepository
// ════════════════════════════════════════════════════════════════════════

describe('PlatformAdminRepository (real DB)', () => {
  test('create → findById / findByEmail (lowercased) / findByUserId', async () => {
    if (!dbReachable) return;
    const repo = new PlatformAdminRepository(db as any);
    const userId = freshId();
    const email = `Admin-${freshId()}@Example.com`;
    const created = await repo.create({ userId, email: email.toLowerCase(), name: 'Root Admin', role: 'super' } as any);

    expect((await repo.findById(created.id))?.role).toBe('super');
    expect((await repo.findByUserId(userId))?.id).toBe(created.id);
    // findByEmail lowercases its argument before matching.
    expect((await repo.findByEmail(email))?.id).toBe(created.id);
  });

  test('update + delete + countByRole', async () => {
    if (!dbReachable) return;
    const repo = new PlatformAdminRepository(db as any);
    const a1 = await repo.create({ userId: freshId(), email: `a-${freshId()}@x.com`, name: 'A', role: 'analyst' } as any);
    await repo.create({ userId: freshId(), email: `a-${freshId()}@x.com`, name: 'B', role: 'analyst' } as any);

    const before = await repo.countByRole('analyst');
    expect(before).toBeGreaterThanOrEqual(2);

    const updated = await repo.update(a1.id, { name: 'A-renamed' } as any);
    expect(updated?.name).toBe('A-renamed');

    await repo.delete(a1.id);
    expect(await repo.findById(a1.id)).toBeUndefined();
    expect(await repo.countByRole('analyst')).toBe(before - 1);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  ImpersonationSessionRepository
// ════════════════════════════════════════════════════════════════════════

describe('ImpersonationSessionRepository (real DB)', () => {
  test('create → findById / findByToken, end stamps endedAt', async () => {
    if (!dbReachable) return;
    const repo = new ImpersonationSessionRepository(db as any);
    const token = `tok-${freshId()}`;
    const created = await repo.create({
      adminId: freshId(),
      targetUserId: freshId(),
      sessionToken: token,
      expiresAt: new Date(Date.now() + 3600_000),
    } as any);
    expect(created.endedAt).toBeNull();

    expect((await repo.findById(created.id))?.id).toBe(created.id);
    expect((await repo.findByToken(token))?.id).toBe(created.id);
    expect(await repo.findByToken(`missing-${freshId()}`)).toBeUndefined();

    const ended = await repo.end(created.id);
    expect(ended?.endedAt).toBeInstanceOf(Date);

    const reread = await repo.findByToken(token);
    expect(reread?.endedAt).toBeInstanceOf(Date);
  });
});
