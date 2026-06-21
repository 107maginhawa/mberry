/**
 * Shared real-PG seed helpers for the B1 "scheduling" cluster
 * (events + booking + association:operations).
 *
 * All three modules read/write the SAME public tables owned by
 * `association:operations/repos/events.schema.ts` — `event`, `event_registration`,
 * `check_in`, `waitlist_entry`. Rather than re-hand-rolling INSERTs (and the enum
 * casts they need) in every suite, this builds ON TOP of `createScratch`
 * (`pg-scratch.ts`) and exposes a few `seed*` helpers that fill the required
 * NOT-NULL columns and round-trip overrides.
 *
 * Usage:
 *   let H: ScratchDb
 *   beforeAll(async () => { H = await createSchedulingScratch() })
 *   afterAll(async () => { await H?.teardown() })
 *   test('...', async () => {
 *     if (!H.dbReachable) return
 *     const ev = await seedEvent(H, { capacity: 2 })
 *     await seedRegistration(H, { eventId: ev.id, organizationId: ev.organizationId })
 *   })
 *
 * FKs are NOT copied by `LIKE … INCLUDING ALL`, so a registration/check-in can be
 * seeded without a parent event/person row — but the helpers default `eventId`/
 * `personId` to fresh UUIDs so the partial-unique `uq_event_reg_active` index
 * (copied by INCLUDING ALL) admits independent rows.
 */
import { createScratch, type ScratchDb } from './pg-scratch';

/** The public table set every scheduling-cluster suite needs. */
export const SCHEDULING_TABLES = ['event', 'event_registration', 'check_in'] as const;

/** A fixed org id (FKs are dropped, so any valid UUID works; reuse pda-metro-manila for realism). */
export const SCHED_ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

/**
 * Stand up a scratch schema with the scheduling tables. Pass `extra` to add
 * sibling tables (e.g. `['waitlist_entry']` or assoc:operations training tables).
 */
export function createSchedulingScratch(extra: string[] = []): Promise<ScratchDb> {
  return createScratch([...SCHEDULING_TABLES, ...extra]);
}

export interface SeedEventOpts {
  id?: string;
  organizationId?: string;
  title?: string;
  description?: string | null;
  eventType?: string | null;
  location?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  capacity?: number | null;
  registrationFee?: number | null;
  currency?: string | null;
  creditBearing?: boolean | null;
  creditAmount?: number | null;
  cpdActivityType?: string | null;
  eventSlug?: string | null;
  coverImageUrl?: string | null;
  /** Defaults to 'published' so the row is listPublic-visible out of the box. */
  status?: 'draft' | 'published' | 'cancelled' | 'completed' | null;
  /** Defaults to 'network' so the row is listPublic-visible out of the box. */
  visibility?: 'internal' | 'network' | null;
  publishedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface SeededEvent {
  id: string;
  organizationId: string;
}

/**
 * Insert one `event` row. Required-by-schema columns (title/start/end) default to
 * sane values; `status`/`visibility` default to published+network so the row is
 * immediately public-listable. Enum params need explicit ::casts (bound params do
 * not auto-cast the way literals do).
 */
export async function seedEvent(H: ScratchDb, o: SeedEventOpts = {}): Promise<SeededEvent> {
  const id = o.id ?? crypto.randomUUID();
  const organizationId = o.organizationId ?? SCHED_ORG;
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".event
       (id, organization_id, title, description, event_type, location,
        start_date, end_date, capacity, registration_fee, currency,
        credit_bearing, credit_amount, cpd_activity_type, event_slug,
        cover_image_url, status, visibility, published_at, created_by, updated_by)
     VALUES ($1,$2,$3,$4,
        $5::event_type, $6,
        COALESCE($7, now()), COALESCE($8, now() + interval '1 day'),
        $9, COALESCE($10, 0), COALESCE($11,'PHP'),
        COALESCE($12,false), COALESCE($13,0), $14::cpd_activity_type, $15,
        $16, COALESCE($17::event_status,'published'),
        COALESCE($18::event_visibility,'network'), $19, $20, $21)`,
    [
      id,
      organizationId,
      o.title ?? 'Test Event',
      o.description ?? null,
      o.eventType ?? null,
      o.location ?? null,
      o.startDate ?? null,
      o.endDate ?? null,
      o.capacity ?? null,
      o.registrationFee ?? null,
      o.currency ?? null,
      o.creditBearing ?? null,
      o.creditAmount ?? null,
      o.cpdActivityType ?? null,
      o.eventSlug ?? null,
      o.coverImageUrl ?? null,
      o.status ?? null,
      o.visibility ?? null,
      o.publishedAt ?? null,
      o.createdBy ?? null,
      o.updatedBy ?? null,
    ],
  );
  return { id, organizationId };
}

export interface SeedRegistrationOpts {
  id?: string;
  organizationId?: string;
  eventId?: string;
  personId?: string;
  status?: 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded' | 'noShow';
  paidAt?: Date | null;
  /** Override to control `getFirstWaitlisted` FIFO ordering (orders by created_at). */
  createdAt?: Date | null;
  registeredAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface SeededRegistration {
  id: string;
  organizationId: string;
  eventId: string;
  personId: string;
  status: string;
}

/** Insert one `event_registration` row (status defaults to 'confirmed'). */
export async function seedRegistration(
  H: ScratchDb,
  o: SeedRegistrationOpts = {},
): Promise<SeededRegistration> {
  const id = o.id ?? crypto.randomUUID();
  const organizationId = o.organizationId ?? SCHED_ORG;
  const eventId = o.eventId ?? crypto.randomUUID();
  const personId = o.personId ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".event_registration
       (id, organization_id, event_id, person_id, status, paid_at,
        registered_at, created_at, created_by, updated_by)
     VALUES ($1,$2,$3,$4,COALESCE($5::registration_status,'confirmed'),$6,
        COALESCE($7, now()), COALESCE($8, now()), $9, $10)`,
    [
      id,
      organizationId,
      eventId,
      personId,
      o.status ?? null,
      o.paidAt ?? null,
      o.registeredAt ?? null,
      o.createdAt ?? null,
      o.createdBy ?? null,
      o.updatedBy ?? null,
    ],
  );
  return { id, organizationId, eventId, personId, status: o.status ?? 'confirmed' };
}

export interface SeedCheckInOpts {
  id?: string;
  organizationId?: string;
  eventId?: string;
  personId?: string;
  method?: 'qr' | 'manual';
  checkedInBy?: string | null;
  attestation?: Record<string, unknown> | null;
}

export interface SeededCheckIn {
  id: string;
  organizationId: string;
  eventId: string;
  personId: string;
}

/** Insert one `check_in` row (`method` is NOT NULL with no default → defaults to 'manual' here). */
export async function seedCheckIn(H: ScratchDb, o: SeedCheckInOpts = {}): Promise<SeededCheckIn> {
  const id = o.id ?? crypto.randomUUID();
  const organizationId = o.organizationId ?? SCHED_ORG;
  const eventId = o.eventId ?? crypto.randomUUID();
  const personId = o.personId ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".check_in
       (id, organization_id, event_id, person_id, method, checked_in_by, attestation)
     VALUES ($1,$2,$3,$4,COALESCE($5::check_in_method,'manual'),$6,$7::jsonb)`,
    [
      id,
      organizationId,
      eventId,
      personId,
      o.method ?? null,
      o.checkedInBy ?? null,
      o.attestation ? JSON.stringify(o.attestation) : null,
    ],
  );
  return { id, organizationId, eventId, personId };
}
