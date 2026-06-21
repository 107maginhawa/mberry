/**
 * Real-PG integration for the booking lifecycle SQL the unit/mocked tests can't
 * reach: slot-release on cancel (and re-claimability of the freed slot), the
 * no-show transition, the illegal-transition guards, and the duration/reason DB
 * CHECK constraints. createScratch(['booking','time_slot']) — FKs dropped, so the
 * slot/booking rows seed without parents. Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { BookingRepository } from './booking.repo';
import { timeSlots } from './booking.schema';
import { eq } from 'drizzle-orm';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: BookingRepository;

const ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';
const base = new Date('2033-01-01T10:00:00Z');
const at = (m: number) => new Date(base.getTime() + m * 60000);

/** Insert an available 30-min slot and return its id. */
async function seedSlot(startMin: number): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".time_slot
       (id, organization_id, owner_id, event_id, location_types, start_time, end_time, status)
     VALUES ($1,$2,$3,$4,'["video"]'::jsonb,$5,$6,'available')`,
    [id, ORG, crypto.randomUUID(), crypto.randomUUID(), at(startMin).toISOString(), at(startMin + 30).toISOString()],
  );
  return id;
}

async function slotRow(id: string): Promise<{ status: string; booking_id: string | null }> {
  const { rows } = await H.scopedPool.query(
    `SELECT status, booking_id FROM "${H.schema}".time_slot WHERE id = $1`, [id]);
  return rows[0];
}

beforeAll(async () => {
  H = await createScratch(['booking', 'time_slot']);
  if (H.dbReachable) repo = new BookingRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('booking cancel → slot release → re-claim (real-PG)', () => {
  test('cancelBooking frees the slot (available + booking_id NULL) and it is re-claimable', async () => {
    if (!H.dbReachable) return;
    const slotId = await seedSlot(0);
    const booking = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);
    expect((await slotRow(slotId)).status).toBe('booked');

    const cancelled = await repo.cancelBooking(booking.id, 'client', 'changed mind');
    expect(cancelled.status).toBe('cancelled');
    const freed = await slotRow(slotId);
    expect(freed.status).toBe('available');
    expect(freed.booking_id).toBeNull();

    // The freed slot can be claimed again (cancelled row doesn't trip the active-slot unique).
    const reclaim = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);
    expect(reclaim.status).toBe('pending');
    expect((await slotRow(slotId)).status).toBe('booked');
  });

  test('cancelling an already-cancelled booking is an illegal transition (throws)', async () => {
    if (!H.dbReachable) return;
    const slotId = await seedSlot(60);
    const booking = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);
    await repo.cancelBooking(booking.id, 'client', 'first');
    await expect(repo.cancelBooking(booking.id, 'client', 'again')).rejects.toThrow();
  });
});

describe('booking no-show transition (real-PG)', () => {
  test('markAsNoShow(host) on a confirmed booking sets no_show_host + markedBy/At', async () => {
    if (!H.dbReachable) return;
    const slotId = await seedSlot(120);
    const booking = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);
    await repo.confirmBooking(booking.id); // pending → confirmed

    const noShow = await repo.markAsNoShow(booking.id, 'host');
    expect(noShow.status).toBe('no_show_host');
    expect(noShow.noShowMarkedBy).toBe('host');
    expect(noShow.noShowMarkedAt).toBeInstanceOf(Date);
  });

  test('markAsNoShow on a cancelled booking is an illegal transition (throws)', async () => {
    if (!H.dbReachable) return;
    const slotId = await seedSlot(180);
    const booking = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);
    await repo.cancelBooking(booking.id, 'host', 'cancelled first');
    await expect(repo.markAsNoShow(booking.id, 'host')).rejects.toThrow();
  });
});

describe('reject slot-release SQL → re-claimable (real-PG)', () => {
  test('the reject release writes (status=rejected + slot available/null) free the slot for a new claim', async () => {
    if (!H.dbReachable) return;
    const slotId = await seedSlot(240);
    const booking = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);

    // Replicate rejectBooking.ts's two writes (the handler's inline release SQL):
    await H.db.update(timeSlots).set({ status: 'available', booking: null }).where(eq(timeSlots.id, slotId));
    await H.scopedPool.query(
      `UPDATE "${H.schema}".booking SET status='rejected', cancelled_by='host', cancelled_at=now() WHERE id=$1`,
      [booking.id]);

    const freed = await slotRow(slotId);
    expect(freed.status).toBe('available');
    expect(freed.booking_id).toBeNull();

    const reclaim = await repo.createBooking(crypto.randomUUID(), slotId, { slot: slotId } as never, ORG);
    expect(reclaim.status).toBe('pending');
  });
});

describe('booking DB CHECK constraints (real-PG)', () => {
  function pgCode(e: unknown): string | undefined {
    const err = e as { code?: string; cause?: { code?: string } };
    return err?.code ?? err?.cause?.code;
  }

  async function rawInsertBooking(durationMinutes: number, reason: string): Promise<void> {
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".booking
         (id, organization_id, client_id, host_id, slot_id, location_type, scheduled_at, duration_minutes, status, reason)
       VALUES ($1,$2,$3,$4,$5,'video'::location_type, now(), $6, 'pending'::booking_status, $7)`,
      [crypto.randomUUID(), ORG, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), durationMinutes, reason],
    );
  }

  test('duration_minutes < 15 violates bookings_duration_minutes_check (23514)', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try { await rawInsertBooking(5, 'ok'); } catch (e) { code = pgCode(e); }
    expect(code).toBe('23514');
  });

  test('reason longer than 500 chars violates bookings_reason_check (23514)', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try { await rawInsertBooking(30, 'x'.repeat(501)); } catch (e) { code = pgCode(e); }
    expect(code).toBe('23514');
  });
});
