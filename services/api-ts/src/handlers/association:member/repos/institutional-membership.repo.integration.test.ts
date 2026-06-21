/**
 * Real-DB integration tests for the institutional-membership repos.
 *
 * The existing coverage suite (institutional-membership.repo.coverage.test.ts)
 * drives a scripted recording fake DB: it only inspects the Drizzle call tree
 * (did a `where`/`set` clause get appended) and replays pre-baked update/select
 * results. It can prove neither the SQL nor the seat-count arithmetic, because
 * no query ever runs against Postgres:
 *   - `incrementUsedSeats` SEATS_FULL is decided by the
 *     `used_seats < total_seats` predicate on the UPDATE … RETURNING — the fake
 *     simply returns `[]`, so the *real* guard (and the real `used+1` math) is
 *     never exercised.
 *   - `decrementUsedSeats` uses `GREATEST(used-1, 0)` — the floor-at-zero is a
 *     pure-SQL behaviour the fake can't reproduce.
 *   - `buildWhereConditions`, `revokeAllActive` (active→revoked transition +
 *     row count) and `findActiveByMembershipAndPerson` (status='active' gate)
 *     all need real rows to prove scoping / status filtering / ordering.
 *
 * This suite runs the actual query builders against REAL rows, then asserts the
 * REAL returned data AND the persisted row state read back out of Postgres —
 * never merely "did not throw".
 *
 * Target: handlers/association:member/repos/institutional-membership.repo.ts
 *   InstitutionalMembershipRepository:
 *     - findMany / buildWhereConditions (org / parentOrg / status / tier filters,
 *       org isolation, createdAt ordering, pagination)
 *     - incrementUsedSeats (used+1, SEATS_FULL guard, not-found, updatedAt bump)
 *     - decrementUsedSeats (used-1, GREATEST floor at 0, not-found)
 *   SeatAllocationRepository:
 *     - findMany / buildWhereConditions (membership / person / status filters)
 *     - findActiveByMembershipAndPerson (active gate, revoked ignored, null miss)
 *     - revokeAllActive (active→revoked, revokedAt set, count, membership scope)
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public.institutional_membership / public.seat_allocation
 * structure (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real
 * column/default/check/UNIQUE INDEX is present — no hand-DDL drift. FKs are not
 * copied, so rows insert directly without parent org/person/tier rows.
 *
 * NOTE: seat_allocation carries a UNIQUE INDEX on
 * (institutional_membership_id, person_id) (copied by INCLUDING ALL). A given
 * membership+person pair can therefore hold only ONE allocation row at a time,
 * so the seat fixtures below always use distinct persons.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  InstitutionalMembershipRepository,
  SeatAllocationRepository,
} from './institutional-membership.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

function freshId(): string {
  return crypto.randomUUID();
}

// Stable anchors for the default fixture row.
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const PARENT_A = '00000000-0000-4000-8000-0000000000d1';
const TIER_A = '00000000-0000-4000-8000-0000000000f1';

/**
 * Insert an institutional_membership row directly via raw SQL and return its id.
 * Raw SQL (not the repo) lets us seed arbitrary used/total seat combinations,
 * status values and createdAt timestamps that the repo write-path wouldn't
 * normally produce, so the read/update-side guards can be proven against
 * adversarial data.
 *
 * Sets every NOT-NULL column without a default
 * (organization_id, parent_organization_id, tier_id, total_seats,
 *  primary_contact_id, start_date) explicitly; relies on column defaults for
 * used_seats (0), status ('pendingPayment'), and the base audit fields.
 */
async function insertMembership(opts: {
  id?: string;
  organizationId?: string;
  parentOrganizationId?: string;
  tierId?: string;
  totalSeats?: number;
  usedSeats?: number;
  primaryContactId?: string;
  startDate?: string;
  status?: string;
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".institutional_membership
       (id, organization_id, parent_organization_id, tier_id, total_seats, used_seats,
        primary_contact_id, start_date, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.parentOrganizationId ?? PARENT_A,
      opts.tierId ?? TIER_A,
      opts.totalSeats ?? 5,
      opts.usedSeats ?? 0,
      opts.primaryContactId ?? freshId(),
      opts.startDate ?? '2026-01-01',
      opts.status ?? 'pendingPayment',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

/**
 * Insert a seat_allocation row directly via raw SQL and return its id.
 * Sets every NOT-NULL column without a default
 * (institutional_membership_id, person_id, allocated_by); relies on defaults
 * for allocated_at (now), status ('active') and the base audit fields.
 */
async function insertSeat(opts: {
  id?: string;
  institutionalMembershipId: string;
  personId?: string;
  allocatedBy?: string;
  status?: 'active' | 'revoked';
  revokedAt?: Date | null;
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".seat_allocation
       (id, institutional_membership_id, person_id, allocated_by, status, revoked_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      id,
      opts.institutionalMembershipId,
      opts.personId ?? freshId(),
      opts.allocatedBy ?? freshId(),
      opts.status ?? 'active',
      opts.revokedAt ?? null,
    ],
  );
  return id;
}

/** Read a membership row straight from Postgres for persisted-state assertions. */
async function readMembership(id: string): Promise<any | null> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, used_seats, total_seats, status, updated_at
       FROM "${H.schema}".institutional_membership WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Read a seat row straight from Postgres for persisted-state assertions. */
async function readSeat(id: string): Promise<any | null> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, status, revoked_at FROM "${H.schema}".seat_allocation WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

beforeAll(async () => {
  H = await createScratch(['institutional_membership', 'seat_allocation']);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── InstitutionalMembershipRepository.findMany / buildWhereConditions ──────

describe('InstitutionalMembershipRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates rows from another org', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertMembership({ organizationId: orgX });
    await insertMembership({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r: any) => r.id)).toEqual([mine]);
    expect(rows.every((r: any) => r.organizationId === orgX)).toBe(true);
  });

  test('parentOrganizationId filter narrows to one parent org', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const org = freshId();
    const parentX = freshId();
    const parentY = freshId();
    const keep = await insertMembership({ organizationId: org, parentOrganizationId: parentX });
    await insertMembership({ organizationId: org, parentOrganizationId: parentY });

    const rows = await repo.findMany({ organizationId: org, parentOrganizationId: parentX });
    expect(rows.map((r: any) => r.id)).toEqual([keep]);
  });

  test('status filter narrows to the matching membership status', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertMembership({ organizationId: org, status: 'active' });
    await insertMembership({ organizationId: org, status: 'pendingPayment' });
    await insertMembership({ organizationId: org, status: 'lapsed' });

    const rows = await repo.findMany({ organizationId: org, status: 'active' });
    expect(rows.map((r: any) => r.id)).toEqual([active]);
    expect(rows[0]!.status).toBe('active');
  });

  test('tierId filter narrows to one tier', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const org = freshId();
    const tierX = freshId();
    const tierY = freshId();
    const keep = await insertMembership({ organizationId: org, tierId: tierX });
    await insertMembership({ organizationId: org, tierId: tierY });

    const rows = await repo.findMany({ organizationId: org, tierId: tierX });
    expect(rows.map((r: any) => r.id)).toEqual([keep]);
  });

  test('combined filters AND together (org + parent + status + tier)', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const org = freshId();
    const parent = freshId();
    const tier = freshId();
    const match = await insertMembership({
      organizationId: org,
      parentOrganizationId: parent,
      tierId: tier,
      status: 'active',
    });
    // Differs on exactly one dimension each → all excluded.
    await insertMembership({ organizationId: org, parentOrganizationId: parent, tierId: tier, status: 'lapsed' });
    await insertMembership({ organizationId: org, parentOrganizationId: freshId(), tierId: tier, status: 'active' });
    await insertMembership({ organizationId: org, parentOrganizationId: parent, tierId: freshId(), status: 'active' });

    const rows = await repo.findMany({
      organizationId: org,
      parentOrganizationId: parent,
      tierId: tier,
      status: 'active',
    });
    expect(rows.map((r: any) => r.id)).toEqual([match]);
  });

  test('no filters returns rows ordered by createdAt ascending', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const org = freshId();
    // Insert out of chronological order; base findMany orders by created_at asc.
    const second = await insertMembership({ organizationId: org, createdAt: new Date('2026-02-02T00:00:00Z') });
    const first = await insertMembership({ organizationId: org, createdAt: new Date('2026-01-01T00:00:00Z') });
    const third = await insertMembership({ organizationId: org, createdAt: new Date('2026-03-03T00:00:00Z') });

    const rows = await repo.findMany({ organizationId: org });
    expect(rows.map((r: any) => r.id)).toEqual([first, second, third]);
  });

  test('pagination applies limit + offset against the ordered window', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const org = freshId();
    const a = await insertMembership({ organizationId: org, createdAt: new Date('2026-01-01T00:00:00Z') });
    const b = await insertMembership({ organizationId: org, createdAt: new Date('2026-01-02T00:00:00Z') });
    const c = await insertMembership({ organizationId: org, createdAt: new Date('2026-01-03T00:00:00Z') });

    const page = await repo.findMany({ organizationId: org }, { pagination: { offset: 1, limit: 1 } });
    expect(page.map((r: any) => r.id)).toEqual([b]);
    // Sanity: full window in order.
    const all = await repo.findMany({ organizationId: org });
    expect(all.map((r: any) => r.id)).toEqual([a, b, c]);
  });
});

// ─── InstitutionalMembershipRepository.incrementUsedSeats ──────────────────

describe('InstitutionalMembershipRepository.incrementUsedSeats (real DB)', () => {
  test('increments used_seats by 1 and persists, bumping updated_at', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const past = new Date('2020-01-01T00:00:00Z');
    const id = await insertMembership({ totalSeats: 5, usedSeats: 2 });
    // Pin updated_at to the past so we can prove the handler bumps it.
    await H.scopedPool.query(
      `UPDATE "${H.schema}".institutional_membership SET updated_at = $2 WHERE id = $1`,
      [id, past],
    );

    const updated = await repo.incrementUsedSeats(id);
    expect(updated.usedSeats).toBe(3);

    const persisted = await readMembership(id);
    expect(persisted.used_seats).toBe(3);
    expect(new Date(persisted.updated_at).getTime()).toBeGreaterThan(past.getTime());
  });

  test('fills the final seat (used = total - 1 → total)', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const id = await insertMembership({ totalSeats: 3, usedSeats: 2 });

    const updated = await repo.incrementUsedSeats(id);
    expect(updated.usedSeats).toBe(3);
    expect((await readMembership(id)).used_seats).toBe(3);
  });

  test('throws BusinessLogicError SEATS_FULL when used_seats === total_seats (no row mutated)', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const id = await insertMembership({ totalSeats: 4, usedSeats: 4 });

    await expect(repo.incrementUsedSeats(id)).rejects.toBeInstanceOf(BusinessLogicError);
    await expect(repo.incrementUsedSeats(id)).rejects.toMatchObject({ code: 'SEATS_FULL' });
    // Guard predicate (used < total) matched nothing → seat count unchanged.
    expect((await readMembership(id)).used_seats).toBe(4);
  });

  test('throws SEATS_FULL when used_seats already exceeds total_seats', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const id = await insertMembership({ totalSeats: 2, usedSeats: 3 });

    await expect(repo.incrementUsedSeats(id)).rejects.toMatchObject({ code: 'SEATS_FULL' });
    expect((await readMembership(id)).used_seats).toBe(3);
  });

  test('throws NotFoundError for an unknown membership id', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    await expect(repo.incrementUsedSeats(freshId())).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── InstitutionalMembershipRepository.decrementUsedSeats ──────────────────

describe('InstitutionalMembershipRepository.decrementUsedSeats (real DB)', () => {
  test('decrements used_seats by 1 and persists', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const id = await insertMembership({ totalSeats: 5, usedSeats: 3 });

    const updated = await repo.decrementUsedSeats(id);
    expect(updated.usedSeats).toBe(2);
    expect((await readMembership(id)).used_seats).toBe(2);
  });

  test('GREATEST floors at 0 — decrementing from 0 stays 0 (no negative seats)', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    const id = await insertMembership({ totalSeats: 5, usedSeats: 0 });

    const updated = await repo.decrementUsedSeats(id);
    expect(updated.usedSeats).toBe(0);
    expect((await readMembership(id)).used_seats).toBe(0);
  });

  test('throws NotFoundError for an unknown membership id', async () => {
    if (!H.dbReachable) return;
    const repo = new InstitutionalMembershipRepository(H.db as any, noopLogger);
    await expect(repo.decrementUsedSeats(freshId())).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── SeatAllocationRepository.findMany / buildWhereConditions ──────────────

describe('SeatAllocationRepository.findMany / buildWhereConditions (real DB)', () => {
  test('institutionalMembershipId filter isolates one membership\'s seats', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const imA = freshId();
    const imB = freshId();
    const a1 = await insertSeat({ institutionalMembershipId: imA });
    const a2 = await insertSeat({ institutionalMembershipId: imA });
    await insertSeat({ institutionalMembershipId: imB });

    const rows = await repo.findMany({ institutionalMembershipId: imA });
    expect(new Set(rows.map((r: any) => r.id))).toEqual(new Set([a1, a2]));
    expect(rows.every((r: any) => r.institutionalMembershipId === imA)).toBe(true);
  });

  test('personId filter narrows to one person across memberships', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    const person = freshId();
    const mine = await insertSeat({ institutionalMembershipId: im, personId: person });
    await insertSeat({ institutionalMembershipId: im, personId: freshId() });

    const rows = await repo.findMany({ personId: person });
    expect(rows.map((r: any) => r.id)).toEqual([mine]);
  });

  test('status filter narrows to active vs revoked', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    const active = await insertSeat({ institutionalMembershipId: im, status: 'active' });
    const revoked = await insertSeat({ institutionalMembershipId: im, status: 'revoked', revokedAt: new Date() });

    const actives = await repo.findMany({ institutionalMembershipId: im, status: 'active' });
    expect(actives.map((r: any) => r.id)).toEqual([active]);
    const revokeds = await repo.findMany({ institutionalMembershipId: im, status: 'revoked' });
    expect(revokeds.map((r: any) => r.id)).toEqual([revoked]);
  });
});

// ─── SeatAllocationRepository.findActiveByMembershipAndPerson ──────────────

describe('SeatAllocationRepository.findActiveByMembershipAndPerson (real DB)', () => {
  test('returns the active seat for a membership+person', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    const person = freshId();
    const id = await insertSeat({ institutionalMembershipId: im, personId: person, status: 'active' });

    const found = await repo.findActiveByMembershipAndPerson(im, person);
    expect(found?.id).toBe(id);
    expect(found?.status).toBe('active');
    expect(found?.personId).toBe(person);
  });

  test('ignores a revoked seat for the same membership+person (re-allocation allowed)', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    const person = freshId();
    // Unique (membership, person) index ⇒ at most one row; a revoked one must
    // not block re-allocation, so the active-gated lookup returns null.
    await insertSeat({ institutionalMembershipId: im, personId: person, status: 'revoked', revokedAt: new Date() });

    expect(await repo.findActiveByMembershipAndPerson(im, person)).toBeNull();
  });

  test('returns null when no seat exists for the membership+person', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    expect(await repo.findActiveByMembershipAndPerson(freshId(), freshId())).toBeNull();
  });

  test('does not match the same person in a different membership', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const imA = freshId();
    const imB = freshId();
    const person = freshId();
    await insertSeat({ institutionalMembershipId: imA, personId: person, status: 'active' });

    // Active in imA, but queried against imB → no cross-membership match.
    expect(await repo.findActiveByMembershipAndPerson(imB, person)).toBeNull();
  });
});

// ─── SeatAllocationRepository.revokeAllActive ──────────────────────────────

describe('SeatAllocationRepository.revokeAllActive (real DB)', () => {
  test('flips every active seat to revoked, sets revoked_at, and returns the count', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    const s1 = await insertSeat({ institutionalMembershipId: im, status: 'active' });
    const s2 = await insertSeat({ institutionalMembershipId: im, status: 'active' });

    const count = await repo.revokeAllActive(im);
    expect(count).toBe(2);

    for (const id of [s1, s2]) {
      const row = await readSeat(id);
      expect(row.status).toBe('revoked');
      expect(row.revoked_at).not.toBeNull();
    }
  });

  test('leaves already-revoked seats untouched and counts only the active ones revoked', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    const active = await insertSeat({ institutionalMembershipId: im, status: 'active' });
    const priorRevokedAt = new Date('2025-05-05T00:00:00Z');
    const alreadyRevoked = await insertSeat({
      institutionalMembershipId: im,
      status: 'revoked',
      revokedAt: priorRevokedAt,
    });

    const count = await repo.revokeAllActive(im);
    // Only the active row transitions; the WHERE status='active' excludes the rest.
    expect(count).toBe(1);

    expect((await readSeat(active)).status).toBe('revoked');
    // The pre-existing revoked row keeps its original revoked_at (not re-stamped).
    const untouched = await readSeat(alreadyRevoked);
    expect(untouched.status).toBe('revoked');
    expect(new Date(untouched.revoked_at).getTime()).toBe(priorRevokedAt.getTime());
  });

  test('scopes revocation to the target membership — other memberships are untouched', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const target = freshId();
    const other = freshId();
    const t1 = await insertSeat({ institutionalMembershipId: target, status: 'active' });
    const o1 = await insertSeat({ institutionalMembershipId: other, status: 'active' });

    const count = await repo.revokeAllActive(target);
    expect(count).toBe(1);
    expect((await readSeat(t1)).status).toBe('revoked');
    // A different membership's active seat is left alone.
    expect((await readSeat(o1)).status).toBe('active');
  });

  test('returns 0 when the membership has no active seats', async () => {
    if (!H.dbReachable) return;
    const repo = new SeatAllocationRepository(H.db as any, noopLogger);
    const im = freshId();
    await insertSeat({ institutionalMembershipId: im, status: 'revoked', revokedAt: new Date() });

    expect(await repo.revokeAllActive(im)).toBe(0);
    expect(await repo.revokeAllActive(freshId())).toBe(0);
  });
});
