/**
 * Real-PG integration test for the manual slot-regeneration endpoint
 * (POST /booking/events/{event}/regenerate-slots, Phase 47b).
 *
 * Drives the REAL regenerateBookingEventSlots handler over a createScratch
 * booking schema so the full path runs: ownership gate → regenerateEventSlots
 * (the job) → persisted time_slot rows. Proves the manual trigger actually
 * (re)generates availability, not just that it returns 200. Skips when the DB
 * is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { regenerateBookingEventSlots } from './regenerateBookingEventSlots';

const ORG = '00000000-0000-4000-8000-0000000000b1';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['booking_event', 'time_slot', 'person']);
});
afterAll(async () => {
  await H?.teardown();
});

/** mon 09:00–17:00 → plenty of Mondays in the next 30 days yield slots. */
function dailyConfigs() {
  return { mon: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '17:00' }] } } as never;
}

async function seedPerson(id: string): Promise<string> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name) VALUES ($1, $2)`,
    [id, 'Owner'],
  );
  return id;
}

/** Drive the real handler with a ctx bound to the scratch DB + the given user. */
function handlerCtx(userId: string, eventId: string) {
  const ctx = makeCtx({ database: H.db, user: { id: userId, role: 'user' } }) as any;
  ctx.req.param = (key?: string) => (key ? ({ event: eventId } as any)[key] || '' : { event: eventId });
  ctx.json = (body: any, status: number = 200) => ({ status, body });
  return ctx;
}

async function slotCount(eventId: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".time_slot WHERE event_id = $1`,
    [eventId],
  );
  return rows[0].n as number;
}

describe('regenerateBookingEventSlots — real PG', () => {
  test('owner trigger regenerates real time_slot rows + returns 200', async () => {
    if (!H.dbReachable) return;
    const repo = new BookingEventRepository(H.db as never);
    const owner = await seedPerson(crypto.randomUUID());
    const ev = await repo.createWithSmartDefaults(owner, { title: 'Consults', dailyConfigs: dailyConfigs() }, ORG);

    expect(await slotCount(ev.id)).toBe(0); // none until generated

    const res = await regenerateBookingEventSlots(handlerCtx(owner, ev.id));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ev.id);

    // Real availability was written to the store (the whole point of the endpoint).
    expect(await slotCount(ev.id)).toBeGreaterThan(0);
  });

  test('non-owner is rejected (403) and writes no slots', async () => {
    if (!H.dbReachable) return;
    const repo = new BookingEventRepository(H.db as never);
    const owner = await seedPerson(crypto.randomUUID());
    const ev = await repo.createWithSmartDefaults(owner, { title: 'Private', dailyConfigs: dailyConfigs() }, ORG);

    const res = await regenerateBookingEventSlots(handlerCtx(crypto.randomUUID(), ev.id));
    expect(res.status).toBe(403);
    expect(await slotCount(ev.id)).toBe(0); // gate fired before regeneration
  });

  test('missing event → 404', async () => {
    if (!H.dbReachable) return;
    const res = await regenerateBookingEventSlots(handlerCtx(crypto.randomUUID(), crypto.randomUUID()));
    expect(res.status).toBe(404);
  });
});
