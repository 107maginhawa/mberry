/**
 * Integration coverage for BookingRepository.createBooking against real Postgres.
 *
 * REGRESSION GUARD for the FK-ordering bug: createBooking used to set
 * time_slot.booking_id BEFORE the booking row existed, violating
 * time_slot_booking_id_booking_id_fk and 500-ing every real-DB createBooking.
 * Mocked unit tests never caught it. This test inserts a real slot + claims it
 * via createBooking and asserts: no FK violation, slot flips to 'booked' and
 * points at the new booking, and the race guard still rejects a second claim.
 *
 * Skips (does not fail) when Postgres is unreachable — documented env skip.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { BookingRepository } from './booking.repo';
import { ConflictError } from '@/core/errors';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;
let repo: BookingRepository;

const OWNER = randomUUID();
const CLIENT = randomUUID();
const EVENT = randomUUID();
const ORG = randomUUID();

const createdSlotIds: string[] = [];

const base = new Date('2032-03-01T10:00:00Z');
const at = (mins: number) => new Date(base.getTime() + mins * 60000);

/** Insert an available time_slot directly and return its id. */
async function makeSlot(startMin: number, endMin: number): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO time_slot (id, organization_id, owner_id, event_id, location_types, start_time, end_time, status)
     VALUES ($1,$2,$3,$4,'["video"]'::jsonb,$5,$6,'available')`,
    [id, ORG, OWNER, EVENT, at(startMin).toISOString(), at(endMin).toISOString()],
  );
  createdSlotIds.push(id);
  return id;
}

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const c = await pool.connect();
    c.release();
    db = drizzle(pool);
    dbReachable = true;
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[booking.repo integration] Postgres unreachable; skipping. ${(err as Error).message}`);
    return;
  }

  repo = new BookingRepository(db as any);

  await pool.query(`INSERT INTO person (id, first_name) VALUES ($1, 'Bk Owner') ON CONFLICT DO NOTHING`, [OWNER]);
  await pool.query(`INSERT INTO person (id, first_name) VALUES ($1, 'Bk Client') ON CONFLICT DO NOTHING`, [CLIENT]);
  await pool.query(
    `INSERT INTO booking_event (id, organization_id, owner_id, title, timezone, location_types, daily_configs, status)
     VALUES ($1,$2,$3,'Bk Event','UTC','["video"]'::jsonb,'{}'::jsonb,'active') ON CONFLICT DO NOTHING`,
    [EVENT, ORG, OWNER],
  );
});

afterAll(async () => {
  if (pool) {
    if (dbReachable) {
      await pool.query(`DELETE FROM booking WHERE slot_id IN (SELECT id FROM time_slot WHERE event_id=$1)`, [EVENT]);
      await pool.query(`DELETE FROM time_slot WHERE event_id=$1`, [EVENT]);
      await pool.query(`DELETE FROM booking_event WHERE id=$1`, [EVENT]);
      await pool.query(`DELETE FROM person WHERE id IN ($1,$2)`, [OWNER, CLIENT]);
    }
    await pool.end();
  }
});

describe('BookingRepository.createBooking (real-PG, FK-ordering regression)', () => {
  test('createBooking inserts booking + claims slot with NO FK violation', async () => {
    if (!dbReachable) return;
    const slotId = await makeSlot(0, 30);

    // This used to throw 23503 (time_slot_booking_id_booking_id_fk). Must not.
    const booking = await repo.createBooking(CLIENT, slotId, { slot: slotId }, ORG);

    expect(booking.id).toBeTruthy();
    expect(booking.status).toBe('pending');
    expect(booking.slot).toBe(slotId);

    // Slot flipped to booked and FK now points at the real booking row.
    const r = await pool.query(`SELECT status, booking_id FROM time_slot WHERE id=$1`, [slotId]);
    expect(r.rows[0].status).toBe('booked');
    expect(r.rows[0].booking_id).toBe(booking.id);
  });

  test('second createBooking on the same slot is rejected (race guard intact)', async () => {
    if (!dbReachable) return;
    const slotId = await makeSlot(60, 90);

    await repo.createBooking(CLIENT, slotId, { slot: slotId }, ORG);

    // Slot is no longer 'available' → atomic claim returns 0 rows → ConflictError.
    let err: unknown;
    try {
      await repo.createBooking(CLIENT, slotId, { slot: slotId }, ORG);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);

    // Exactly one booking row references the slot.
    const r = await pool.query(`SELECT count(*)::int AS n FROM booking WHERE slot_id=$1`, [slotId]);
    expect(r.rows[0].n).toBe(1);
  });
});
