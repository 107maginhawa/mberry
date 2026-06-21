/**
 * Real-PG integration tests for the membership-domain MembershipRepository.
 *
 * The module ships TWO membership repos against the SAME `membership` schema:
 *
 *   1. handlers/association:member/repos/membership.repo.ts  (TypeSpec-generated,
 *      `DatabaseRepository` base) — atomic CRUD + a schema-only `buildWhereConditions`
 *      whose `q` filter ILIKEs the membership's own member_number, plus the
 *      reminder helpers `findByPersonAndOrg` / `findAllByPerson` / `findMembersExpiringOn`.
 *
 *   2. handlers/membership/repos/membership.repo.ts  (hand-wired "rich roster" repo)
 *      — this is where the module's MOST COMPLEX SQL lives:
 *        • `listMembersWithOfficerStatus` — TWO correlated subqueries
 *          (latest dues-invoice status + active-cycle credit SUM), with the
 *          dues-status and training-compliance filters pushed down to the DB
 *          as WHERE clauses, a person LEFT JOIN, ORDER BY joined_at DESC, and
 *          LIMIT/OFFSET pagination.
 *        • `listMembers` / `getMember` / `getMemberById` person-join reads.
 *        • ILIKE search with anti-wildcard-injection escaping via
 *          `escapeLikePattern` (a "%"/"_" in the search term must be matched
 *          LITERALLY, not as a SQL wildcard).
 *        • the `membershipRepoPort.findActiveMembershipByPersonAndOrg` port
 *          used by org-context middleware (excludes removed/expelled/deceased).
 *
 * The existing mock suites (membership.repo.coverage.test.ts,
 * membership.repo.test.ts) only inspect the Drizzle `where`/builder tree — they
 * never run a query, so they cannot catch a busted correlated subquery, a
 * wrong cast on the dues `membership_id::text` join, a wildcard-injection hole
 * in the search, an org-scope leak, an ordering/pagination regression, or a
 * status-filter mistake. This suite drives the REAL SQL against REAL rows and
 * asserts the returned data + read-back persisted state — never "no throw".
 *
 * Isolation: the shared `createScratch` harness copies the real public table
 * structures via `CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`, so every
 * real column / default / enum is present (no hand-DDL drift). FKs are not
 * copied, so we insert membership/person/dues/credit rows directly.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
// Rich roster repo (correlated subqueries, person joins, escaped ILIKE, port).
import {
  MembershipRepository as RichMembershipRepository,
  membershipRepoPort,
} from '@/handlers/membership/repos/membership.repo';
// TypeSpec-generated repo (schema-only buildWhereConditions, reminder helpers).
import { MembershipRepository as TypeSpecMembershipRepository } from './membership.repo';

let H: ScratchDb;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const TIER_1 = '00000000-0000-4000-8000-0000000000f1';

function freshId(): string {
  return crypto.randomUUID();
}

// ─── raw seeders ──────────────────────────────────────────────────────────
// Raw SQL (not the repo write path) lets us seed arbitrary status / member_number
// / dues / credit combinations so the read-side SQL can be proven against
// adversarial data. We set every real NOT-NULL column lacking a default and
// rely on column defaults (id, timestamps, version, status, …) for the rest.
//
// GOTCHA: `start_date`/`period_*` are real Postgres `date` columns — we pass
// 'YYYY-MM-DD' string literals (auto-cast) and never compare a raw JS Date to
// them. Enum columns are real PG enums; string literals auto-cast, but bound
// $N enum params would need a ::membership_status cast (we use literals here).

async function insertPerson(opts: {
  id?: string;
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name, last_name, contact_info)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      id,
      opts.firstName ?? 'Test',
      'lastName' in opts ? opts.lastName : 'Member',
      opts.email === undefined ? null : JSON.stringify({ email: opts.email }),
    ],
  );
  return id;
}

async function insertMembership(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  tierId?: string;
  categoryId?: string | null;
  memberNumber?: string | null;
  status?: string; // membership_status enum literal
  startDate?: string; // 'YYYY-MM-DD'
  duesExpiryDate?: string | null; // 'YYYY-MM-DD'
  joinedAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, category_id, member_number,
        status, start_date, dues_expiry_date, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7,'pendingPayment')::membership_status, $8, $9, $10)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? freshId(),
      opts.tierId ?? TIER_1,
      opts.categoryId ?? null,
      'memberNumber' in opts ? opts.memberNumber : 'M-0001',
      opts.status ?? null,
      opts.startDate ?? '2026-01-01',
      'duesExpiryDate' in opts ? opts.duesExpiryDate : null,
      opts.joinedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    ],
  );
  return id;
}

async function insertCategory(opts: {
  id?: string;
  organizationId?: string;
  name?: string;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership_category
       (id, organization_id, name, applicable_tiers)
     VALUES ($1,$2,$3,$4::jsonb)`,
    [id, opts.organizationId ?? ORG_A, opts.name ?? 'Regular', JSON.stringify([TIER_1])],
  );
  return id;
}

async function insertDuesInvoice(opts: {
  membershipId: string;
  personId: string;
  organizationId?: string;
  status?: string; // dues_invoice_status enum literal
  createdAt?: Date;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_invoice
       (id, membership_id, person_id, organization_id, invoice_number,
        period_start, period_end, total_amount, fund_allocations, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, COALESCE($10,'generated')::dues_invoice_status, $11)`,
    [
      id,
      opts.membershipId, // dues_invoice.membership_id is varchar — the subquery casts membership.id::text
      opts.personId,
      opts.organizationId ?? ORG_A,
      `INV-${id.slice(0, 8)}`,
      '2026-01-01',
      '2026-12-31',
      1000,
      JSON.stringify([]),
      opts.status ?? null,
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

async function insertCredit(opts: {
  personId: string;
  organizationId?: string;
  creditAmount: number;
  cycleStart?: Date;
  cycleEnd?: Date;
  activityDate?: Date;
}): Promise<string> {
  const id = freshId();
  // The credit correlated subquery sums creditAmount where cycleStart <= NOW()
  // <= cycleEnd. Use a wide window straddling "now" so seeded credits count.
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".credit_entry
       (id, person_id, organization_id, type, activity_name, activity_date,
        credit_amount, cycle_start, cycle_end)
     VALUES ($1,$2,$3,'manual','Activity',$4,$5,$6,$7)`,
    [
      id,
      opts.personId,
      opts.organizationId ?? ORG_A,
      opts.activityDate ?? new Date(),
      opts.creditAmount,
      opts.cycleStart ?? new Date('2000-01-01T00:00:00.000Z'),
      opts.cycleEnd ?? new Date('2999-12-31T00:00:00.000Z'),
    ],
  );
  return id;
}

async function insertStatusHistory(opts: {
  membershipId: string;
  personId: string;
  organizationId?: string;
  fromStatus?: string | null;
  toStatus: string;
  changedAt?: Date;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership_status_history
       (id, organization_id, membership_id, person_id, from_status, to_status, changed_at)
     VALUES ($1,$2,$3,$4,$5::membership_status,$6::membership_status,$7)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.membershipId,
      opts.personId,
      opts.fromStatus ?? null,
      opts.toStatus,
      opts.changedAt ?? new Date(),
    ],
  );
  return id;
}

beforeAll(async () => {
  // Tables the two repos actually read: membership (both), person +
  // membership_category (rich joins), dues_invoice + credit_entry (correlated
  // subqueries), and membership_status_history (transition-log read-back).
  H = await createScratch([
    'membership',
    'membership_category',
    'person',
    'dues_invoice',
    'credit_entry',
    'membership_status_history',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// Rich roster repo — listMembers (person join + escaped ILIKE search)
// ═══════════════════════════════════════════════════════════════════════════

describe('Rich MembershipRepository.listMembers (real DB)', () => {
  test('org-scopes the roster and excludes other orgs, ordered by joined_at DESC', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const pA = await insertPerson({ firstName: 'Alice' });
    const pB = await insertPerson({ firstName: 'Bob' });
    const pOther = await insertPerson({ firstName: 'Zed' });
    // Two in-org members with distinct joined_at to assert ordering.
    const older = await insertMembership({ organizationId: org, personId: pA, joinedAt: new Date('2026-01-01T00:00:00Z') });
    const newer = await insertMembership({ organizationId: org, personId: pB, joinedAt: new Date('2026-06-01T00:00:00Z') });
    // Different org — must be excluded.
    await insertMembership({ organizationId: freshId(), personId: pOther });

    const { data, total } = await repo.listMembers({ organizationId: org });
    expect(total).toBe(2);
    // ORDER BY joined_at DESC → newest first.
    expect(data.map((r: any) => r.membership.id)).toEqual([newer, older]);
    // Person LEFT JOIN actually resolved names.
    expect(data.find((r: any) => r.membership.id === newer)?.person?.firstName).toBe('Bob');
  });

  test('status + categoryId filters narrow the roster', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const cat = await insertCategory({ organizationId: org, name: 'Fellow' });
    const p1 = await insertPerson();
    const p2 = await insertPerson();
    const p3 = await insertPerson();
    const wanted = await insertMembership({ organizationId: org, personId: p1, status: 'active', categoryId: cat });
    await insertMembership({ organizationId: org, personId: p2, status: 'lapsed', categoryId: cat }); // wrong status
    await insertMembership({ organizationId: org, personId: p3, status: 'active', categoryId: null }); // wrong category

    const { data } = await repo.listMembers({ organizationId: org, status: 'active', categoryId: cat });
    expect(data.map((r: any) => r.membership.id)).toEqual([wanted]);
    // category LEFT JOIN resolved.
    expect(data[0]?.category?.name).toBe('Fellow');
  });

  test('search matches person first/last name and member_number (ILIKE)', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const pName = await insertPerson({ firstName: 'Florence', lastName: 'Nightingale' });
    const pNum = await insertPerson({ firstName: 'Xx', lastName: 'Yy' });
    const pMiss = await insertPerson({ firstName: 'Nobody', lastName: 'Here' });
    const byFirst = await insertMembership({ organizationId: org, personId: pName, memberNumber: 'AAA-1' });
    const byNumber = await insertMembership({ organizationId: org, personId: pNum, memberNumber: 'FLOR-9' });
    await insertMembership({ organizationId: org, personId: pMiss, memberNumber: 'ZZZ-0' });

    // "flor" hits Florence (firstName) AND FLOR-9 (member_number), case-insensitive.
    const { data } = await repo.listMembers({ organizationId: org, search: 'flor' });
    expect(new Set(data.map((r: any) => r.membership.id))).toEqual(new Set([byFirst, byNumber]));
  });

  test('SEARCH ESCAPES "%" — a literal percent is NOT treated as a wildcard', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    // One member whose last name literally contains "%", and a decoy that does not.
    const pPercent = await insertPerson({ firstName: 'Per', lastName: '50%off' });
    const pPlain = await insertPerson({ firstName: 'Plain', lastName: 'Jane' });
    const percentMember = await insertMembership({ organizationId: org, personId: pPercent, memberNumber: 'P-1' });
    await insertMembership({ organizationId: org, personId: pPlain, memberNumber: 'P-2' });

    // Unescaped, ILIKE '%%%' would match EVERY row. Escaped, '%' is literal →
    // only the member whose name actually contains a percent sign matches.
    const { data } = await repo.listMembers({ organizationId: org, search: '%' });
    expect(data.map((r: any) => r.membership.id)).toEqual([percentMember]);
  });

  test('SEARCH ESCAPES "_" — underscore is matched literally, not as any-char', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    // Member numbers: one literally contains "_", one is "AXB" (would match if _
    // were treated as the single-char wildcard in 'A_B').
    const pUnderscore = await insertPerson({ firstName: 'Und', lastName: 'Score' });
    const pWild = await insertPerson({ firstName: 'Wild', lastName: 'Card' });
    const underscoreMember = await insertMembership({ organizationId: org, personId: pUnderscore, memberNumber: 'A_B' });
    await insertMembership({ organizationId: org, personId: pWild, memberNumber: 'AXB' });

    const { data } = await repo.listMembers({ organizationId: org, search: 'A_B' });
    // Only the literal "A_B" member — "AXB" must NOT match an escaped underscore.
    expect(data.map((r: any) => r.membership.id)).toEqual([underscoreMember]);
  });

  test('pagination: limit + offset slice the roster while total stays the full count', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = await insertPerson();
      // Strictly increasing joined_at so DESC order is deterministic (newest first).
      ids.push(await insertMembership({ organizationId: org, personId: p, joinedAt: new Date(2026, 0, i + 1) }));
    }
    const newestFirst = [...ids].reverse();

    const page1 = await repo.listMembers({ organizationId: org, limit: 2, offset: 0 });
    expect(page1.total).toBe(5); // count() ignores limit/offset
    expect(page1.data.map((r: any) => r.membership.id)).toEqual(newestFirst.slice(0, 2));

    const page2 = await repo.listMembers({ organizationId: org, limit: 2, offset: 2 });
    expect(page2.data.map((r: any) => r.membership.id)).toEqual(newestFirst.slice(2, 4));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rich roster repo — listMembersWithOfficerStatus (TWO correlated subqueries
// + DB-level dues-status & training-compliance filters)
// ═══════════════════════════════════════════════════════════════════════════

describe('Rich MembershipRepository.listMembersWithOfficerStatus (real DB)', () => {
  test('correlated subqueries: latest dues-invoice status + active-cycle credit SUM', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const p = await insertPerson({ firstName: 'Sub', lastName: 'Query' });
    const m = await insertMembership({ organizationId: org, personId: p });

    // Three invoices — the subquery must pick the LATEST by created_at ('paid').
    await insertDuesInvoice({ membershipId: m, personId: p, organizationId: org, status: 'generated', createdAt: new Date('2026-01-01T00:00:00Z') });
    await insertDuesInvoice({ membershipId: m, personId: p, organizationId: org, status: 'overdue', createdAt: new Date('2026-02-01T00:00:00Z') });
    await insertDuesInvoice({ membershipId: m, personId: p, organizationId: org, status: 'paid', createdAt: new Date('2026-03-01T00:00:00Z') });

    // Credit SUM across the active cycle → 25 + 20 = 45 (>= 40 threshold).
    await insertCredit({ personId: p, organizationId: org, creditAmount: 25 });
    await insertCredit({ personId: p, organizationId: org, creditAmount: 20 });

    const { data } = await repo.listMembersWithOfficerStatus({ organizationId: org });
    const row = data.find((r: any) => r.membership.id === m)!;
    expect(row.duesInvoiceStatus).toBe('paid'); // latest invoice, not generated/overdue
    expect(row.creditsEarned).toBe(45);
    expect(row.trainingCompliant).toBe(true); // 45 >= 40
  });

  test('credit SUM ignores credits outside the active cycle window', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p });

    // In-window credit (wide default window straddles NOW()).
    await insertCredit({ personId: p, organizationId: org, creditAmount: 10 });
    // Out-of-window credit: cycle entirely in the past → excluded by cycleEnd >= NOW().
    await insertCredit({
      personId: p,
      organizationId: org,
      creditAmount: 999,
      cycleStart: new Date('2000-01-01T00:00:00Z'),
      cycleEnd: new Date('2001-01-01T00:00:00Z'),
    });

    const { data } = await repo.listMembersWithOfficerStatus({ organizationId: org });
    const row = data.find((r: any) => r.membership.id === m)!;
    expect(row.creditsEarned).toBe(10); // 999 excluded
  });

  test('member with NO invoices/credits gets null dues status and 0 credits (COALESCE)', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p });

    const { data } = await repo.listMembersWithOfficerStatus({ organizationId: org });
    const row = data.find((r: any) => r.membership.id === m)!;
    expect(row.duesInvoiceStatus).toBeNull();
    expect(Number(row.creditsEarned)).toBe(0); // COALESCE(... , 0)
    expect(row.trainingCompliant).toBe(false); // 0 < 40
  });

  test('duesStatus filter is pushed to the DB and selects by LATEST invoice', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    // Member whose latest invoice is overdue.
    const pOver = await insertPerson();
    const mOver = await insertMembership({ organizationId: org, personId: pOver });
    await insertDuesInvoice({ membershipId: mOver, personId: pOver, organizationId: org, status: 'paid', createdAt: new Date('2026-01-01T00:00:00Z') });
    await insertDuesInvoice({ membershipId: mOver, personId: pOver, organizationId: org, status: 'overdue', createdAt: new Date('2026-05-01T00:00:00Z') });
    // Member whose latest invoice is paid — must be filtered out.
    const pPaid = await insertPerson();
    const mPaid = await insertMembership({ organizationId: org, personId: pPaid });
    await insertDuesInvoice({ membershipId: mPaid, personId: pPaid, organizationId: org, status: 'paid', createdAt: new Date('2026-05-01T00:00:00Z') });

    const { data, total } = await repo.listMembersWithOfficerStatus({ organizationId: org, duesStatus: 'overdue' });
    expect(data.map((r: any) => r.membership.id)).toEqual([mOver]);
    expect(total).toBe(1); // count() also applies the dues filter
  });

  test('trainingCompliant=true keeps only members at/above the 40-credit threshold', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const pHi = await insertPerson();
    const mHi = await insertMembership({ organizationId: org, personId: pHi });
    await insertCredit({ personId: pHi, organizationId: org, creditAmount: 40 }); // exactly threshold
    const pLo = await insertPerson();
    const mLo = await insertMembership({ organizationId: org, personId: pLo });
    await insertCredit({ personId: pLo, organizationId: org, creditAmount: 39.5 }); // just below

    const compliant = await repo.listMembersWithOfficerStatus({ organizationId: org, trainingCompliant: true });
    expect(compliant.data.map((r: any) => r.membership.id)).toEqual([mHi]);

    const nonCompliant = await repo.listMembersWithOfficerStatus({ organizationId: org, trainingCompliant: false });
    expect(nonCompliant.data.map((r: any) => r.membership.id)).toEqual([mLo]);
  });

  test('dues credit subqueries are person+org correlated — a same-person credit in another org does not leak', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const otherOrg = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p });
    // 5 credits in-org + 500 credits for the SAME person but a DIFFERENT org.
    await insertCredit({ personId: p, organizationId: org, creditAmount: 5 });
    await insertCredit({ personId: p, organizationId: otherOrg, creditAmount: 500 });

    const { data } = await repo.listMembersWithOfficerStatus({ organizationId: org });
    const row = data.find((r: any) => r.membership.id === m)!;
    // Subquery joins on credit.organizationId = membership.organizationId → 5 only.
    expect(row.creditsEarned).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rich roster repo — getMember / getMemberById (single-row person joins)
// ═══════════════════════════════════════════════════════════════════════════

describe('Rich MembershipRepository.getMember / getMemberById (real DB)', () => {
  test('getMember resolves by (organizationId, personId) with person + category joins', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const cat = await insertCategory({ organizationId: org, name: 'Honorary' });
    const p = await insertPerson({ firstName: 'Single', lastName: 'Row' });
    const m = await insertMembership({ organizationId: org, personId: p, categoryId: cat });

    const row = await repo.getMember(org, p);
    expect(row?.membership.id).toBe(m);
    expect(row?.person?.firstName).toBe('Single');
    expect(row?.category?.name).toBe('Honorary');
  });

  test('getMember does not cross org boundaries', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const p = await insertPerson();
    await insertMembership({ organizationId: ORG_A, personId: p });
    // Same person, queried under a different org → no row.
    expect(await repo.getMember(ORG_B, p)).toBeUndefined();
  });

  test('getMemberById resolves a membership by its primary key', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const p = await insertPerson({ firstName: 'By', lastName: 'Id' });
    const m = await insertMembership({ organizationId: org, personId: p });

    const row = await repo.getMemberById(m);
    expect(row?.membership.id).toBe(m);
    expect(row?.person?.firstName).toBe('By');
  });

  test('getMemberCountByCategory counts only memberships in that category', async () => {
    if (!H.dbReachable) return;
    const repo = new RichMembershipRepository(H.db as any);
    const org = freshId();
    const cat = await insertCategory({ organizationId: org });
    const other = await insertCategory({ organizationId: org });
    await insertMembership({ organizationId: org, personId: await insertPerson(), categoryId: cat });
    await insertMembership({ organizationId: org, personId: await insertPerson(), categoryId: cat });
    await insertMembership({ organizationId: org, personId: await insertPerson(), categoryId: other });

    expect(await repo.getMemberCountByCategory(cat)).toBe(2);
    expect(await repo.getMemberCountByCategory(freshId())).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rich roster repo — membershipRepoPort.findActiveMembershipByPersonAndOrg
// (org-context middleware port; excludes permanent-removal statuses)
// ═══════════════════════════════════════════════════════════════════════════

describe('membershipRepoPort.findActiveMembershipByPersonAndOrg (real DB)', () => {
  test('returns the membership for an active member of the org', async () => {
    if (!H.dbReachable) return;
    const port = membershipRepoPort(H.db as any);
    const org = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p, status: 'active' });

    const found = await port.findActiveMembershipByPersonAndOrg(p, org);
    expect(found?.membershipId).toBe(m);
    expect(found?.personId).toBe(p);
    expect(found?.organizationId).toBe(org);
    expect(found?.status).toBe('active');
  });

  test('still resolves non-active-but-not-removed statuses (lapsed/grace/suspended)', async () => {
    if (!H.dbReachable) return;
    const port = membershipRepoPort(H.db as any);
    for (const status of ['gracePeriod', 'lapsed', 'suspended', 'pendingPayment']) {
      const org = freshId();
      const p = await insertPerson();
      await insertMembership({ organizationId: org, personId: p, status });
      const found = await port.findActiveMembershipByPersonAndOrg(p, org);
      expect(found?.status).toBe(status);
    }
  });

  test('excludes permanently-removed statuses (removed / expelled / deceased)', async () => {
    if (!H.dbReachable) return;
    const port = membershipRepoPort(H.db as any);
    for (const status of ['removed', 'expelled', 'deceased']) {
      const org = freshId();
      const p = await insertPerson();
      await insertMembership({ organizationId: org, personId: p, status });
      // notInArray gate → no eligible membership.
      expect(await port.findActiveMembershipByPersonAndOrg(p, org)).toBeUndefined();
    }
  });

  test('does not match the person in a different org', async () => {
    if (!H.dbReachable) return;
    const port = membershipRepoPort(H.db as any);
    const p = await insertPerson();
    await insertMembership({ organizationId: ORG_A, personId: p, status: 'active' });
    expect(await port.findActiveMembershipByPersonAndOrg(p, ORG_B)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TypeSpec repo — buildWhereConditions (schema-only filters) + helpers
// ═══════════════════════════════════════════════════════════════════════════

describe('TypeSpec MembershipRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId + personId + tierId + status filters narrow the result', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const org = freshId();
    const tier = freshId();
    const p = await insertPerson();
    const wanted = await insertMembership({ organizationId: org, personId: p, tierId: tier, status: 'active' });
    await insertMembership({ organizationId: org, personId: await insertPerson(), tierId: tier, status: 'lapsed' }); // wrong status
    await insertMembership({ organizationId: org, personId: await insertPerson(), tierId: freshId(), status: 'active' }); // wrong tier
    await insertMembership({ organizationId: freshId(), personId: await insertPerson(), tierId: tier, status: 'active' }); // wrong org

    const rows = await (repo as any).findMany({ organizationId: org, tierId: tier, status: 'active' });
    expect(rows.map((r: any) => r.id)).toEqual([wanted]);
  });

  test('q filter ILIKEs the membership member_number (FIX-017)', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const org = freshId();
    const hit = await insertMembership({ organizationId: org, personId: await insertPerson(), memberNumber: 'DENT-2026-007' });
    await insertMembership({ organizationId: org, personId: await insertPerson(), memberNumber: 'MED-2026-009' });

    const rows = await (repo as any).findMany({ organizationId: org, q: 'dent' });
    expect(rows.map((r: any) => r.id)).toEqual([hit]);
  });

  test('count() respects org scope', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const org = freshId();
    await insertMembership({ organizationId: org, personId: await insertPerson() });
    await insertMembership({ organizationId: org, personId: await insertPerson() });
    await insertMembership({ organizationId: freshId(), personId: await insertPerson() });
    expect(await (repo as any).count({ organizationId: org })).toBe(2);
  });
});

describe('TypeSpec MembershipRepository.findByPersonAndOrg / findAllByPerson (real DB)', () => {
  test('findByPersonAndOrg returns exactly the org-scoped membership', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const p = await insertPerson();
    const inA = await insertMembership({ organizationId: ORG_A, personId: p });
    await insertMembership({ organizationId: ORG_B, personId: p });

    const found = await repo.findByPersonAndOrg(p, ORG_A);
    expect(found?.id).toBe(inA);
    expect(found?.organizationId).toBe(ORG_A);

    expect(await repo.findByPersonAndOrg(p, freshId())).toBeNull();
  });

  test('findAllByPerson returns memberships across every org for the person', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const p = await insertPerson();
    const a = await insertMembership({ organizationId: freshId(), personId: p });
    const b = await insertMembership({ organizationId: freshId(), personId: p });
    // Another person's membership must not appear.
    await insertMembership({ organizationId: ORG_A, personId: await insertPerson() });

    const rows = await repo.findAllByPerson(p);
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([a, b]));
  });
});

describe('TypeSpec MembershipRepository.findMembersExpiringOn (real DB)', () => {
  test('returns active/grace members whose dues_expiry_date matches the target date', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const org = freshId();
    const target = '2026-07-15';
    const pActive = await insertPerson();
    const pGrace = await insertPerson();
    const active = await insertMembership({ organizationId: org, personId: pActive, status: 'active', duesExpiryDate: target });
    const grace = await insertMembership({ organizationId: org, personId: pGrace, status: 'gracePeriod', duesExpiryDate: target });
    // Lapsed on the same date — excluded (status not in [active, gracePeriod]).
    await insertMembership({ organizationId: org, personId: await insertPerson(), status: 'lapsed', duesExpiryDate: target });
    // Active but a DIFFERENT expiry date — excluded by the date match.
    await insertMembership({ organizationId: org, personId: await insertPerson(), status: 'active', duesExpiryDate: '2026-07-16' });
    // Right date+status but a different org — excluded.
    await insertMembership({ organizationId: freshId(), personId: await insertPerson(), status: 'active', duesExpiryDate: target });

    const rows = await repo.findMembersExpiringOn(org, target);
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([active, grace]));
    // `date` column asserted TZ-stably as a 'YYYY-MM-DD' string.
    for (const r of rows) expect(r.duesExpiryDate).toBe(target);
  });

  test('returns an empty array when nobody expires on the target date', async () => {
    if (!H.dbReachable) return;
    const repo = new TypeSpecMembershipRepository(H.db as any);
    const org = freshId();
    await insertMembership({ organizationId: org, personId: await insertPerson(), status: 'active', duesExpiryDate: '2026-08-01' });
    expect(await repo.findMembersExpiringOn(org, '2026-09-01')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// membership_status_history — transition-log read-back (additive audit table)
// ═══════════════════════════════════════════════════════════════════════════

describe('membership_status_history transition log (real DB)', () => {
  test('records a from→to status transition that reads back faithfully', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p, status: 'active' });
    const histId = await insertStatusHistory({
      membershipId: m,
      personId: p,
      organizationId: org,
      fromStatus: 'pendingPayment',
      toStatus: 'active',
      changedAt: new Date('2026-02-02T00:00:00.000Z'),
    });

    const { rows } = await H.scopedPool.query(
      `SELECT from_status, to_status, membership_id, organization_id
         FROM "${H.schema}".membership_status_history WHERE id = $1`,
      [histId],
    );
    expect(rows[0].from_status).toBe('pendingPayment');
    expect(rows[0].to_status).toBe('active');
    expect(rows[0].membership_id).toBe(m);
    expect(rows[0].organization_id).toBe(org);
  });

  test('an initial transition may have a NULL from_status (first record)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p });
    const histId = await insertStatusHistory({
      membershipId: m,
      personId: p,
      organizationId: org,
      fromStatus: null,
      toStatus: 'pendingPayment',
    });

    const { rows } = await H.scopedPool.query(
      `SELECT from_status, to_status FROM "${H.schema}".membership_status_history WHERE id = $1`,
      [histId],
    );
    expect(rows[0].from_status).toBeNull();
    expect(rows[0].to_status).toBe('pendingPayment');
  });

  test('multiple transitions for a membership are retrievable in changed_at order', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const p = await insertPerson();
    const m = await insertMembership({ organizationId: org, personId: p });
    await insertStatusHistory({ membershipId: m, personId: p, organizationId: org, fromStatus: null, toStatus: 'pendingPayment', changedAt: new Date('2026-01-01T00:00:00Z') });
    await insertStatusHistory({ membershipId: m, personId: p, organizationId: org, fromStatus: 'pendingPayment', toStatus: 'active', changedAt: new Date('2026-01-02T00:00:00Z') });
    await insertStatusHistory({ membershipId: m, personId: p, organizationId: org, fromStatus: 'active', toStatus: 'lapsed', changedAt: new Date('2026-06-01T00:00:00Z') });

    const { rows } = await H.scopedPool.query(
      `SELECT to_status FROM "${H.schema}".membership_status_history
         WHERE membership_id = $1 ORDER BY changed_at ASC`,
      [m],
    );
    expect(rows.map((r: any) => r.to_status)).toEqual(['pendingPayment', 'active', 'lapsed']);
  });
});
