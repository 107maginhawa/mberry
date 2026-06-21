/**
 * Inter-module integration: booking domain events → notification fan-out.
 *
 * Wires the REAL registerDomainEventConsumers against a scratch-schema Postgres,
 * emits booking events through the REAL domainEvents bus, and asserts the REAL
 * persisted `notification` rows (the unit tests only check `.insert` was called).
 * Mirrors notifs/notification-fanout-consumer.integration.test.ts.
 *
 * The booking.confirmed/cancelled consumers `await` their insert, so the row is
 * persisted by the time emit() resolves — no polling needed. Skips when DB down.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as never;
const ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

// registerDomainEventConsumers requires a membershipRepo dep; the booking
// consumers never call it.
const membershipRepo = {
  async findByPersonAndOrg() { return null; },
  async updateOneById() { return undefined; },
} as never;

/** Seed a booking row (cancelled-consumer looks up booking.client_id by id). */
async function seedBooking(id: string, clientId: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".booking
       (id, organization_id, client_id, host_id, slot_id, location_type, scheduled_at, duration_minutes, status)
     VALUES ($1,$2,$3,$4,$5,'video'::location_type, now(), 30, 'confirmed'::booking_status)`,
    [id, ORG, clientId, crypto.randomUUID(), crypto.randomUUID()],
  );
}

async function notifsFor(recipientId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT type, organization_id, related_entity, related_entity_type
       FROM "${H.schema}".notification WHERE recipient_id = $1`,
    [recipientId],
  );
  return rows;
}

beforeAll(async () => {
  H = await createScratch(['notification', 'booking', 'person']);
  if (!H.dbReachable) return;
  // Clean slate on the global bus, then register the real consumers against our db.
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo, db: H.db as never }, noopLogger);
});

afterAll(async () => {
  domainEvents.reset();
  await H?.teardown();
});

describe('booking domain events → notification fan-out (real-PG)', () => {
  test('booking.confirmed → one notification row for the client with correct columns', async () => {
    if (!H.dbReachable) return;
    const clientId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();

    await domainEvents.emit('booking.confirmed', {
      bookingId, hostId: crypto.randomUUID(), clientId, organizationId: ORG,
    } as never);

    const rows = await notifsFor(clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe('booking.confirmed');
    expect(rows[0]!.organization_id).toBe(ORG);
    expect(rows[0]!.related_entity).toBe(bookingId);
    expect(rows[0]!.related_entity_type).toBe('booking');
  });

  test('booking.cancelled → looks up client from the booking row and notifies them', async () => {
    if (!H.dbReachable) return;
    const clientId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    await seedBooking(bookingId, clientId);

    await domainEvents.emit('booking.cancelled', {
      bookingId, organizationId: ORG, reason: 'host unavailable',
    } as never);

    const rows = await notifsFor(clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe('booking.cancelled');
    expect(rows[0]!.related_entity).toBe(bookingId);
  });

  test('booking.cancelled for an ABSENT booking → no notification (lookup guard)', async () => {
    if (!H.dbReachable) return;
    const missingBooking = crypto.randomUUID();
    // No booking row seeded → consumer logs "booking not found, skipping".
    await domainEvents.emit('booking.cancelled', {
      bookingId: missingBooking, organizationId: ORG, reason: 'n/a',
    } as never);

    // Nothing should have been inserted for any recipient tied to this booking.
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".notification WHERE related_entity = $1`,
      [missingBooking],
    );
    expect(rows[0]!.c).toBe(0);
  });

  test('booking.rejected → one notification row for the client with correct columns', async () => {
    if (!H.dbReachable) return;
    const clientId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();

    await domainEvents.emit('booking.rejected', {
      bookingId, hostId: crypto.randomUUID(), clientId, organizationId: ORG, reason: 'declined',
    } as never);

    // Product decision (Option A): the booking.rejected consumer inserts exactly
    // ONE in-app notification for the client, straight from the payload (clientId
    // + organizationId carried inline — no booking-row lookup needed). The inline
    // client createNotification in rejectBooking.ts was removed to avoid a double
    // notify; the consumer is now the single source of the client notification.
    const rows = await notifsFor(clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe('booking.rejected');
    expect(rows[0]!.organization_id).toBe(ORG);
    expect(rows[0]!.related_entity).toBe(bookingId);
    expect(rows[0]!.related_entity_type).toBe('booking');
  });
});
