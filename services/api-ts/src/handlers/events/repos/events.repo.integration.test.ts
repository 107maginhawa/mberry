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
