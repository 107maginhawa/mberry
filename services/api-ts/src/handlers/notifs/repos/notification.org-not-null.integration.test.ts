/**
 * AXIS BR (REAL BUG — decision taken: ship migration 0080).
 *
 * `notification.organization_id` schema-vs-DB drift: the Drizzle schema
 * (`notification.schema.ts:59`) declares `organizationId: uuid('organization_id').notNull()`,
 * and `createNotificationForModule` (repo:148) throws a `ValidationError` when
 * org_id is missing — the application contract IS "org_id required". But the
 * LIVE `public.notification.organization_id` was NULLABLE (`is_nullable=YES`,
 * no NOT-NULL constraint, no CHECK) — pure Drizzle-side `.notNull()` never
 * enforced at the DB. Any write path that bypasses the repo guard could persist
 * a tenant-less notification (cross-tenant leak risk).
 *
 * This is the IDENTICAL drift class B1/events Slice 4 found and fixed with
 * migration 0079 (Drizzle `.notNull()` but DB nullable). The fix here is
 * migration 0080 (`0080_enforce_notification_org_id_not_null.sql`):
 *   DELETE FROM notification WHERE organization_id IS NULL;   -- none expected
 *   ALTER TABLE notification ALTER COLUMN organization_id SET NOT NULL;
 *
 * createScratch copies `LIKE public.notification INCLUDING ALL`, so the scratch
 * table faithfully reproduces whatever nullability `public.notification` has at
 * the moment the suite runs:
 *   - BEFORE migration 0080: a raw INSERT omitting organization_id SUCCEEDS
 *     (the drift) → this suite's "rejected with 23502" assert is RED.
 *   - AFTER migration 0080 (applied on server restart / ci-migrate): the scratch
 *     table picks up SET NOT NULL → the same INSERT raises Postgres 23502 → GREEN.
 *
 * The other notification NOT-NULL columns (recipient_id/type/channel/title/
 * message) already have constraints and are NOT the subject here — the insert
 * below fills all of them so the ONLY missing required column is organization_id,
 * isolating the assertion to the org_id invariant.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createFeedbackScratch } from '@/test-utils/feedback-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;
const membershipRepo = {
  async findByPersonAndOrg() {
    return null;
  },
  async updateOneById() {
    return undefined;
  },
};

beforeAll(async () => {
  H = await createFeedbackScratch();
});

afterAll(async () => {
  await H?.teardown();
});

/**
 * Raw INSERT into the scratch notification table filling every NOT-NULL column
 * EXCEPT organization_id. `omitOrg=false` includes a valid org id (positive
 * characterization). Returns the inserted id.
 */
async function insertNotification(opts: {
  omitOrg: boolean;
  organizationId?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const recipient = crypto.randomUUID();
  if (opts.omitOrg) {
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".notification
         (id, recipient_id, type, channel, title, message, status)
       VALUES ($1, $2, $3::notification_type, $4::notification_channel,
               $5, $6, $7::notification_status)`,
      [id, recipient, 'system', 'in-app', 'Title', 'Body', 'sent'],
    );
  } else {
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".notification
         (id, organization_id, recipient_id, type, channel, title, message, status)
       VALUES ($1, $2, $3, $4::notification_type, $5::notification_channel,
               $6, $7, $8::notification_status)`,
      [
        id,
        opts.organizationId ?? crypto.randomUUID(),
        recipient,
        'system',
        'in-app',
        'Title',
        'Body',
        'sent',
      ],
    );
  }
  return id;
}

describe('notification.organization_id NOT NULL invariant (migration 0080)', () => {
  test('INSERT omitting organization_id is REJECTED with Postgres 23502', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await insertNotification({ omitOrg: true });
    } catch (e) {
      code = (e as { code?: string; cause?: { code?: string } }).code
        ?? (e as { cause?: { code?: string } }).cause?.code;
    }
    // Before migration 0080 this is undefined (insert succeeds = drift = RED).
    // After migration 0080 the scratch column is NOT NULL → 23502.
    expect(code).toBe('23502');
  });

  test('INSERT with a valid organization_id succeeds and persists the org uuid', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const id = await insertNotification({ omitOrg: false, organizationId: org });
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".notification WHERE id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].organization_id).toBe(org);
  });

  test('consumer-side guard: dues.invoice.generated without organizationId is rejected and logged, no crash', async () => {
    if (!H.dbReachable) return;
    const recipient = crypto.randomUUID();

    // The consumer wraps the DB insert in try/catch + logger.error (no rethrow),
    // so after migration 0080 the missing-org insert fails with 23502 inside the
    // consumer, is logged, and NO row is persisted — the bus emit does not crash.
    domainEvents.reset();
    registerDomainEventConsumers({ db: H.db as any, membershipRepo } as any, noopLogger);

    // Emit WITHOUT organizationId. The consumer must not throw out of emit.
    await expect(
      (async () => {
        domainEvents.emit('dues.invoice.generated', {
          personId: recipient,
          invoiceId: crypto.randomUUID(),
          amount: 5000,
          dueDate: '2026-12-31',
          // organizationId intentionally omitted
        } as any);
        // give the fire-and-forget consumer a tick to run its insert+catch
        await new Promise((r) => setTimeout(r, 200));
      })(),
    ).resolves.toBeUndefined();

    // After migration 0080 the tenant-less insert is rejected → no row persisted.
    const { rows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".notification WHERE recipient_id = $1`,
      [recipient],
    );
    expect(rows).toHaveLength(0);

    domainEvents.reset();
  });
});
