/**
 * Shared real-PG seed helpers for the Wave-2 "feedback" cluster (B3):
 * notifs + email.
 *
 * Built ON TOP of `createScratch` (pg-scratch.ts) — mirrors the B1
 * `scheduling-fixtures.ts` and B2 `content-fixtures.ts` patterns. The two
 * feedback modules are org-scoped and low-FK; notifs writes the singular
 * `notification` table, email writes `email_queue`/`email_template`/
 * `email_suppression`. Rather than re-hand-rolling INSERTs (and the enum
 * casts they need) per suite, this exposes `seed*` helpers that fill the
 * required NOT-NULL columns and round-trip overrides.
 *
 * FKs are NOT copied by `LIKE … INCLUDING ALL`, so a notification row can be
 * seeded without a parent person/org row — but the helpers default ids to
 * fresh UUIDs so the unique indexes (copied by INCLUDING ALL) admit
 * independent rows.
 *
 * notifs lands first in B3, so this file is built here (Slice 1). email Slice 1
 * ADDS `seedEmailQueue`/`seedEmailTemplate`/`seedSuppression` to THIS file
 * (mirrors how content-fixtures grew across reviews/surveys).
 *
 * Usage:
 *   let H: ScratchDb
 *   beforeAll(async () => { H = await createFeedbackScratch() })
 *   afterAll(async () => { await H?.teardown() })
 *   test('...', async () => {
 *     if (!H.dbReachable) return
 *     await seedNotification(H, { organizationId: ORG, recipient: R, status: 'sent' })
 *   })
 */
import { createScratch, type ScratchDb } from './pg-scratch';

/** The public table set every feedback-cluster suite needs (extend via `extra`). */
export const FEEDBACK_TABLES = ['notification', 'person'] as const;

/** A fixed org id (FKs are dropped, so any valid UUID works; reuse pda-metro-manila for realism). */
export const FEEDBACK_ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562';

/**
 * Stand up a scratch schema with the feedback tables. Pass `extra` to add
 * sibling tables a suite needs (e.g. `['email_queue','email_template']`).
 */
export function createFeedbackScratch(extra: string[] = []): Promise<ScratchDb> {
  return createScratch([...FEEDBACK_TABLES, ...extra]);
}

export interface SeedPersonOpts {
  id?: string;
  firstName?: string;
}
export interface SeededPerson {
  id: string;
}

/**
 * Insert one `person` row. Live NOT-NULL set without DB defaults is just
 * `first_name` (id/created_at/updated_at/version all have defaults). The
 * `person` table has no `email` column — the email-delivery branch in the
 * notification repo reads the email from the injected PersonRepository stub,
 * not this row, so no email is stored here.
 */
export async function seedPerson(H: ScratchDb, o: SeedPersonOpts = {}): Promise<SeededPerson> {
  const id = o.id ?? crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name) VALUES ($1, $2)`,
    [id, o.firstName ?? 'Test'],
  );
  return { id };
}

export interface SeedNotificationOpts {
  id?: string;
  organizationId?: string;
  recipient?: string;
  /** ::notification_type — defaults to 'system'. */
  type?: string;
  /** ::notification_channel — defaults to 'in-app'. */
  channel?: string;
  /** ::notification_status — defaults to 'sent'. */
  status?: string;
  title?: string;
  message?: string;
  /** ISO timestamp string or null. */
  scheduledAt?: string | null;
  relatedEntityType?: string | null;
  relatedEntity?: string | null;
}
export interface SeededNotification {
  id: string;
  organizationId: string;
  recipient: string;
  type: string;
  channel: string;
  status: string;
}

/**
 * Insert one `notification` row, filling the NOT-NULL columns without DB
 * defaults (recipient_id, type, channel, title, message). `status` defaults to
 * 'sent' (DB default is 'queued'); `organization_id` is live-NULLABLE (drift
 * vs Drizzle .notNull(), fixed by migration 0080 in Slice 4) but the helper
 * defaults it to FEEDBACK_ORG. Enum params need explicit
 * ::notification_type/::notification_channel/::notification_status casts.
 */
export async function seedNotification(
  H: ScratchDb,
  o: SeedNotificationOpts = {},
): Promise<SeededNotification> {
  const id = o.id ?? crypto.randomUUID();
  const organizationId = o.organizationId ?? FEEDBACK_ORG;
  const recipient = o.recipient ?? crypto.randomUUID();
  const type = o.type ?? 'system';
  const channel = o.channel ?? 'in-app';
  const status = o.status ?? 'sent';
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".notification
       (id, organization_id, recipient_id, type, channel, title, message,
        status, scheduled_at, related_entity_type, related_entity)
     VALUES ($1,$2,$3,
        $4::notification_type,
        $5::notification_channel,
        $6,$7,
        $8::notification_status,
        $9::timestamptz,
        $10,$11)`,
    [
      id,
      organizationId,
      recipient,
      type,
      channel,
      o.title ?? 'Test Notification',
      o.message ?? 'Test message',
      status,
      o.scheduledAt ?? null,
      o.relatedEntityType ?? null,
      o.relatedEntity ?? null,
    ],
  );
  return { id, organizationId, recipient, type, channel, status };
}
