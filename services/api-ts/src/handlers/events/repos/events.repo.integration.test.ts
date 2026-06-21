/**
 * Real-PG integration suite for EventsRepository (handlers/events/repos/events.repo.ts).
 *
 * The pre-existing events.repo.test.ts runs against a hand-rolled db/tx stub, so
 * `registerAtomic`'s `SELECT … FOR UPDATE` serialisation, the confirmed-count
 * capacity branch, terminal-row reactivation, and the `uq_event_reg_active` 23505
 * backstop were NEVER exercised against real Postgres. This suite stands up the
 * shared scheduling-cluster scratch schema (scheduling-fixtures.ts) and proves the
 * SQL the stub cannot — including the P0 concurrent capacity race.
 *
 * Skips cleanly when Postgres is unreachable (`if (!H.dbReachable) return`).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { EventsRepository } from './events.repo';
import { type ScratchDb } from '@/test-utils/pg-scratch';
import {
  createSchedulingScratch,
  seedEvent,
  seedRegistration,
  SCHED_ORG,
} from '@/test-utils/scheduling-fixtures';

let H: ScratchDb;
let repo: EventsRepository;

const SYS = '00000000-0000-4000-8000-00000000005a';

/** Count rows for a given (event, person) regardless of status — proves single-row model. */
async function countByPair(eventId: string, personId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS c FROM "${H.schema}".event_registration
       WHERE event_id = $1 AND person_id = $2`,
    [eventId, personId],
  );
  return rows[0]?.c ?? 0;
}

/** Read one registration row back for assertions. */
async function readReg(id: string): Promise<{ status: string; cancelled_at: string | null } | undefined> {
  const { rows } = await H.scopedPool.query(
    `SELECT status, cancelled_at FROM "${H.schema}".event_registration WHERE id = $1`,
    [id],
  );
  return rows[0];
}

beforeAll(async () => {
  H = await createSchedulingScratch();
  if (H.dbReachable) repo = new EventsRepository(H.db as never);
});

afterAll(async () => {
  await H?.teardown();
});

describe('EventsRepository.registerAtomic — real-PG capacity + lock + unique-index proofs', () => {
  test('at capacity=2, a 3rd distinct registrant is persisted waitlisted (created)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, { capacity: 2 });
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'confirmed' });
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'confirmed' });

    const third = crypto.randomUUID();
    const res = await repo.registerAtomic({
      eventId: ev.id,
      personId: third,
      organizationId: ev.organizationId,
      capacity: 2,
      createdBy: SYS,
      updatedBy: SYS,
    });

    expect(res.outcome).toBe('created');
    expect(res.status).toBe('waitlisted');
    // Read back through a fresh query — prove the persisted row really is waitlisted.
    const persisted = await readReg(res.id);
    expect(persisted?.status).toBe('waitlisted');
  });

  test('under capacity, a fresh registrant is confirmed (created)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, { capacity: 5 });
    const res = await repo.registerAtomic({
      eventId: ev.id,
      personId: crypto.randomUUID(),
      organizationId: ev.organizationId,
      capacity: 5,
      createdBy: SYS,
      updatedBy: SYS,
    });
    expect(res.outcome).toBe('created');
    expect(res.status).toBe('confirmed');
  });

  test('P0 RACE: two concurrent registrants for a capacity=1 event → exactly one confirmed, one waitlisted; confirmed never exceeds capacity', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, { capacity: 1 });
    const personA = crypto.randomUUID();
    const personB = crypto.randomUUID();

    // Fire both concurrently. The FOR UPDATE lock on the event row must serialise
    // them so the second sees the first's committed confirmed-count.
    const [a, b] = await Promise.all([
      repo.registerAtomic({ eventId: ev.id, personId: personA, organizationId: ev.organizationId, capacity: 1, createdBy: SYS, updatedBy: SYS }),
      repo.registerAtomic({ eventId: ev.id, personId: personB, organizationId: ev.organizationId, capacity: 1, createdBy: SYS, updatedBy: SYS }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(['confirmed', 'waitlisted']);

    // The invariant the stub can never prove: confirmed_count <= capacity, always.
    const confirmed = await repo.getRegistrationCount(ev.id);
    expect(confirmed).toBe(1);
    expect(confirmed).toBeLessThanOrEqual(1);
  });

  test('23505 backstop: two concurrent fresh INSERTs for the SAME (event, person) → loser raises Postgres 23505 from uq_event_reg_active', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, { capacity: 100 });
    const person = crypto.randomUUID();

    // Plain register() = raw INSERT with no lock — the partial unique index is the
    // only thing standing between a genuine concurrent double-insert and a dup.
    const results = await Promise.allSettled([
      repo.register({ eventId: ev.id, personId: person, organizationId: ev.organizationId, status: 'confirmed', createdBy: SYS, updatedBy: SYS }),
      repo.register({ eventId: ev.id, personId: person, organizationId: ev.organizationId, status: 'confirmed', createdBy: SYS, updatedBy: SYS }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Assert the RAW Postgres error code, not a stubbed throw. drizzle may wrap the
    // pg error, so look at both the error and its cause.
    const err = rejected[0]!.reason as { code?: string; cause?: { code?: string } };
    const code = err.code ?? err.cause?.code;
    expect(code).toBe('23505');

    // Exactly one active row survived.
    expect(await countByPair(ev.id, person)).toBe(1);
  });

  test('terminal reactivation: a cancelled row is re-activated in place (same row id, no new row)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, { capacity: 10 });
    const person = crypto.randomUUID();
    const seeded = await seedRegistration(H, {
      eventId: ev.id,
      organizationId: ev.organizationId,
      personId: person,
      status: 'cancelled',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await repo.registerAtomic({
      eventId: ev.id,
      personId: person,
      organizationId: ev.organizationId,
      capacity: 10,
      createdBy: SYS,
      updatedBy: SYS,
    });

    expect(res.outcome).toBe('reactivated');
    expect(res.id).toBe(seeded.id); // SAME row reused
    expect(res.status).toBe('confirmed');
    const persisted = await readReg(res.id);
    expect(persisted?.status).toBe('confirmed');
    expect(persisted?.cancelled_at).toBeNull();
    expect(await countByPair(ev.id, person)).toBe(1); // no duplicate
  });

  test('idempotent: re-registering an already-confirmed row returns it unchanged (no new row)', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, { capacity: 10 });
    const person = crypto.randomUUID();
    const seeded = await seedRegistration(H, {
      eventId: ev.id,
      organizationId: ev.organizationId,
      personId: person,
      status: 'confirmed',
    });

    const res = await repo.registerAtomic({
      eventId: ev.id,
      personId: person,
      organizationId: ev.organizationId,
      capacity: 10,
      createdBy: SYS,
      updatedBy: SYS,
    });

    expect(res.outcome).toBe('idempotent');
    expect(res.id).toBe(seeded.id);
    expect(res.status).toBe('confirmed');
    expect(await countByPair(ev.id, person)).toBe(1);
  });
});

describe('EventsRepository.getRegistrationCount / getFirstWaitlisted — real-PG', () => {
  test('getRegistrationCount counts ONLY confirmed rows', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, {});
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'confirmed' });
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'confirmed' });
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'waitlisted' });
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'cancelled' });

    expect(await repo.getRegistrationCount(ev.id)).toBe(2);
  });

  test('getFirstWaitlisted returns the oldest waitlisted by created_at (FIFO), inserted out of order', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, {});
    // Insert the NEWER waitlisted first, the OLDER second — FIFO must still pick the older.
    const newer = await seedRegistration(H, {
      eventId: ev.id, organizationId: ev.organizationId, status: 'waitlisted',
      createdAt: new Date('2026-02-02T00:00:00Z'),
    });
    const older = await seedRegistration(H, {
      eventId: ev.id, organizationId: ev.organizationId, status: 'waitlisted',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const first = await repo.getFirstWaitlisted(ev.id);
    expect(first?.id).toBe(older.id);
    expect(first?.id).not.toBe(newer.id);
  });

  test('getFirstWaitlisted returns undefined when no waitlisted rows exist', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, {});
    await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId, status: 'confirmed' });
    expect(await repo.getFirstWaitlisted(ev.id)).toBeUndefined();
  });
});

/**
 * listPublic is NETWORK-wide (no org filter) so it sees every row in the shared
 * scratch schema. Each test below seeds events carrying a unique title token and
 * filters by that token via the `search` param, so pre-seeded rows from other
 * tests can never pollute the assertion.
 */
describe('EventsRepository.listPublic — real-PG SQL filters', () => {
  test('pricing filter binds the raw `registration_fee > 0` fragment correctly', async () => {
    if (!H.dbReachable) return;
    const tok = 'PRICINGTEST';
    await seedEvent(H, { title: `${tok} free`, registrationFee: 0 });
    await seedEvent(H, { title: `${tok} paid`, registrationFee: 5000 });

    const paid = await repo.listPublic({ search: tok, pricing: 'paid' });
    expect(paid.data).toHaveLength(1);
    expect(paid.data[0]!.registrationFee).toBe(5000);
    expect(paid.total).toBe(1);

    const free = await repo.listPublic({ search: tok, pricing: 'free' });
    expect(free.data).toHaveLength(1);
    expect(free.data[0]!.registrationFee).toBe(0);

    const all = await repo.listPublic({ search: tok, pricing: 'all' });
    expect(all.data).toHaveLength(2);
    expect(all.total).toBe(2);
  });

  test('visibility/status guard: draft and internal-visibility events are NEVER returned', async () => {
    if (!H.dbReachable) return;
    const tok = 'VISTEST';
    // The only row that should ever surface: published + network.
    const visible = await seedEvent(H, { title: `${tok} visible`, status: 'published', visibility: 'network' });
    await seedEvent(H, { title: `${tok} draft`, status: 'draft', visibility: 'network' });
    await seedEvent(H, { title: `${tok} internal`, status: 'published', visibility: 'internal' });

    const res = await repo.listPublic({ search: tok });
    expect(res.data).toHaveLength(1);
    expect(res.data[0]!.id).toBe(visible.id);
    // A draft + an internal must not leak under any pricing filter either.
    expect((await repo.listPublic({ search: tok, pricing: 'all' })).data).toHaveLength(1);
  });

  test('date filters apply gte/lte on start_date inclusive of the boundary', async () => {
    if (!H.dbReachable) return;
    const tok = 'DATETEST';
    const jan = new Date('2030-01-01T00:00:00Z');
    const jun = new Date('2030-06-01T00:00:00Z');
    await seedEvent(H, { title: `${tok} jan`, startDate: jan });
    await seedEvent(H, { title: `${tok} jun`, startDate: jun });

    const fromMar = await repo.listPublic({ search: tok, dateFrom: new Date('2030-03-01T00:00:00Z') });
    expect(fromMar.data.map((e) => e.title)).toEqual([`${tok} jun`]);

    const toMar = await repo.listPublic({ search: tok, dateTo: new Date('2030-03-01T00:00:00Z') });
    expect(toMar.data.map((e) => e.title)).toEqual([`${tok} jan`]);

    // Boundary: dateFrom EXACTLY equal to a row's start_date includes it (gte).
    const fromJun = await repo.listPublic({ search: tok, dateFrom: jun });
    expect(fromJun.data.map((e) => e.title)).toEqual([`${tok} jun`]);
  });
});

describe('EventsRepository.findBySlug — real-PG', () => {
  test('finds the row by its unique slug; returns undefined for an absent slug', async () => {
    if (!H.dbReachable) return;
    const seeded = await seedEvent(H, { eventSlug: 'spring-gala-s2' });
    const found = await repo.findBySlug('spring-gala-s2');
    expect(found?.id).toBe(seeded.id);
    expect(found?.eventSlug).toBe('spring-gala-s2');
    expect(await repo.findBySlug('absent-slug-xyz')).toBeUndefined();
  });
});

/**
 * org_id NOT NULL invariant (multi-tenant scoping). events.schema.ts declares
 * organization_id `.notNull()` on ALL three tables, but only `event` enforced it
 * at the DB layer — `event_registration` + `check_in` were added nullable in 0019
 * and never tightened (migration 0078 only touched invoice + notification_preference).
 * Migration 0079 backfills NULLs from the parent event and adds SET NOT NULL so the
 * DB enforces what the schema already claims. These tests assert the 23502 fires
 * (they were RED before 0079).
 */
function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

describe('org_id NOT NULL invariant (migration 0079) — real-PG', () => {
  test('register WITHOUT organizationId is rejected by NOT NULL (23502) on event_registration', async () => {
    if (!H.dbReachable) return;
    const ev = await seedEvent(H, {});
    let code: string | undefined;
    try {
      // Deliberately omit organizationId (cast past the notNull insert type).
      await repo.register({
        eventId: ev.id,
        personId: crypto.randomUUID(),
        status: 'confirmed',
        createdBy: SYS,
        updatedBy: SYS,
      } as never);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('create WITHOUT organizationId is rejected by NOT NULL (23502) on event', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.create({
        title: 'No Org Event',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600_000),
      } as never);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('checkIn WITHOUT organizationId is rejected by NOT NULL (23502) on check_in', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await repo.checkIn({
        eventId: crypto.randomUUID(),
        personId: crypto.randomUUID(),
        method: 'manual',
      } as never);
    } catch (e) {
      code = pgCode(e);
    }
    expect(code).toBe('23502');
  });

  test('positive: register/create WITH a valid org_id persist it (read-back)', async () => {
    if (!H.dbReachable) return;
    const ev = await repo.create({
      organizationId: SCHED_ORG,
      title: 'Org Event',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600_000),
    } as never);
    expect(ev.organizationId).toBe(SCHED_ORG);

    const reg = await repo.register({
      eventId: ev.id,
      personId: crypto.randomUUID(),
      organizationId: SCHED_ORG,
      status: 'confirmed',
      createdBy: SYS,
      updatedBy: SYS,
    });
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".event_registration WHERE id = $1`,
      [reg.id],
    );
    expect(rows[0]?.organization_id).toBe(SCHED_ORG);
  });
});
