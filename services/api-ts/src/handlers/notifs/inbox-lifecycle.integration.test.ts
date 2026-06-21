/**
 * AXIS workflow (real-PG): the in-app notification INBOX lifecycle, end-to-end
 * through the REAL inbox handlers, against a REAL scratch-schema Postgres.
 *
 *   fire (domain event) → persist (consumer row) → list → get (+ownership)
 *   → markRead → unread-count drops → markAll → all read.
 *
 * Why this slice exists: the notifs unit tests (`listNotifications.test.ts`,
 * `getNotification.test.ts`, `mark*.test.ts`) stub `NotificationRepository`, so
 * they never prove the handlers' SQL filters, the `status IN ('sent','delivered')`
 * unread semantics, the ownership gate, or the persisted state transitions
 * (status='read' + read_at). There is no e2e proving the full inbox path. This
 * file drives the four REAL handlers with a minimal `ValidatedContext` (db =
 * scratch, user = RECIPIENT) and SEEDS the inbox via the REAL fan-out
 * (`registerDomainEventConsumers` + emit `dues.invoice.generated` +
 * `event.registered`) so the rows are produced by PRODUCTION consumer code, not
 * hand-inserted — proving the fire→persist seam too.
 *
 * No source is modified. Asserts are real persisted column values / repo counts,
 * never 200-only.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createFeedbackScratch } from '@/test-utils/feedback-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';
import { NotificationRepository } from './repos/notification.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { listNotifications } from './listNotifications';
import { getNotification } from './getNotification';
import { markNotificationAsRead } from './markNotificationAsRead';
import { markAllNotificationsAsRead } from './markAllNotificationsAsRead';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child: () => noopLogger } as any;
const freshId = () => crypto.randomUUID();

// registerDomainEventConsumers requires a membershipRepo dep; the two events we
// emit (dues.invoice.generated, event.registered) never call it.
const membershipRepo = {
  async findByPersonAndOrg() {
    return null;
  },
  async updateOneById() {
    return undefined;
  },
};

/** A real repo bound to the scratch db (for direct unread-count read-backs). */
function repo(): NotificationRepository {
  const personRepo = new PersonRepository(H.db as any, noopLogger);
  return new NotificationRepository(H.db as any, personRepo, noopLogger);
}

/** All notification rows for one recipient (column is recipient_id), oldest first. */
async function rowsFor(recipient: string): Promise<any[]> {
  const res = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".notification WHERE recipient_id = $1 ORDER BY created_at ASC`,
    [recipient],
  );
  return res.rows;
}

beforeAll(async () => {
  H = await createFeedbackScratch();
  if (!H.dbReachable) return;
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo: membershipRepo as any, db: H.db as any }, noopLogger);
});

afterAll(async () => {
  if (H?.dbReachable) domainEvents.reset();
  await H?.teardown();
});

/** Wipe between tests so each gets an isolated RECIPIENT inbox. */
beforeEach(async () => {
  if (!H?.dbReachable) return;
  await H.scopedPool.query(`DELETE FROM "${H.schema}".notification`);
});

describe('inbox lifecycle: fire → persist → list → read → unread-count (real handlers, real PG)', () => {
  test('full lifecycle end-to-end', async () => {
    if (!H.dbReachable) return;

    const ORG = freshId();
    const RECIPIENT = freshId();
    const OTHER = freshId();
    const invoiceId = freshId();
    const eventId = freshId();

    // ── FIRE: two single-recipient domain events for RECIPIENT, produced by the
    //    REAL fan-out consumers (proves the fire→persist seam). Both insert a
    //    channel='in-app', status='sent' row for personId=RECIPIENT.
    await domainEvents.emit('dues.invoice.generated', {
      invoiceId,
      personId: RECIPIENT,
      organizationId: ORG,
      amount: 3000,
      dueDate: '2026-09-30',
    });
    await domainEvents.emit('event.registered', {
      eventId,
      personId: RECIPIENT,
      organizationId: ORG,
    });

    // ── PERSIST: both rows landed, ordered oldest-first.
    const seeded = await rowsFor(RECIPIENT);
    expect(seeded).toHaveLength(2);
    const rowA = seeded[0]; // dues.invoice.generated
    const rowB = seeded[1]; // event.registered
    expect(rowA.related_entity).toBe(invoiceId);
    expect(rowB.related_entity).toBe(eventId);
    // both produced as in-app, sent (the unread state) by the consumers
    for (const r of seeded) {
      expect(r.recipient_id).toBe(RECIPIENT);
      expect(r.channel).toBe('in-app');
      expect(r.status).toBe('sent');
      expect(r.organization_id).toBe(ORG);
    }

    // ── LIST (default, no filter): both rows; default channel='in-app' includes
    //    them; pagination.total === 2; every row belongs to RECIPIENT.
    const listRes: any = await listNotifications(
      makeCtx({ database: H.db, user: { id: RECIPIENT, role: 'user' }, _query: {} }),
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body.pagination.totalCount).toBe(2);
    expect(listRes.body.data).toHaveLength(2);
    for (const d of listRes.body.data) {
      expect(d.recipient).toBe(RECIPIENT);
    }

    // ── LIST ?status=unread: both rows are unread (status 'sent'); repo agrees.
    const unreadRes: any = await listNotifications(
      makeCtx({ database: H.db, user: { id: RECIPIENT, role: 'user' }, _query: { status: 'unread' } }),
    );
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.pagination.totalCount).toBe(2);
    expect(await repo().getUnreadCount(RECIPIENT)).toBe(2);

    // ── GET rowA as RECIPIENT → 200, the right id.
    const getRes: any = await getNotification(
      makeCtx({ database: H.db, user: { id: RECIPIENT, role: 'user' }, _params: { notif: rowA.id } }),
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(rowA.id);

    // ── GET rowA as a DIFFERENT user → ownership gate → NotFoundError.
    await expect(
      getNotification(
        makeCtx({ database: H.db, user: { id: OTHER, role: 'user' }, _params: { notif: rowA.id } }),
      ),
    ).rejects.toThrow('Notification not found');

    // ── READ rowA → 200, status='read'; read_at persisted; unread-count drops to 1.
    const readRes: any = await markNotificationAsRead(
      makeCtx({ database: H.db, user: { id: RECIPIENT, role: 'user' }, _params: { notif: rowA.id } }),
    );
    expect(readRes.status).toBe(200);
    expect(readRes.body.status).toBe('read');

    const afterRead = await H.scopedPool.query(
      `SELECT status, read_at FROM "${H.schema}".notification WHERE id = $1`,
      [rowA.id],
    );
    expect(afterRead.rows[0].status).toBe('read');
    expect(afterRead.rows[0].read_at).not.toBeNull();
    expect(await repo().getUnreadCount(RECIPIENT)).toBe(1);

    // ── LIST ?status=unread now returns ONLY rowB.
    const unreadAfter: any = await listNotifications(
      makeCtx({ database: H.db, user: { id: RECIPIENT, role: 'user' }, _query: { status: 'unread' } }),
    );
    expect(unreadAfter.body.pagination.totalCount).toBe(1);
    expect(unreadAfter.body.data).toHaveLength(1);
    expect(unreadAfter.body.data[0].id).toBe(rowB.id);

    // ── MARK ALL → marks only the one remaining unread (rowB); count === 0 after.
    const allRes: any = await markAllNotificationsAsRead(
      makeCtx({ database: H.db, user: { id: RECIPIENT, role: 'user' }, _query: {} }),
    );
    expect(allRes.status).toBe(200);
    expect(allRes.body.markedCount).toBe(1);
    expect(await repo().getUnreadCount(RECIPIENT)).toBe(0);

    // both rows now read at the SQL layer.
    const final = await rowsFor(RECIPIENT);
    expect(final).toHaveLength(2);
    for (const r of final) {
      expect(r.status).toBe('read');
    }
  });

  test('markNotificationAsRead on a foreign recipient\'s id → NotFoundError, target row unchanged', async () => {
    if (!H.dbReachable) return;

    const ORG = freshId();
    const OWNER = freshId();
    const ATTACKER = freshId();
    const invoiceId = freshId();

    // Produce one real row owned by OWNER.
    await domainEvents.emit('dues.invoice.generated', {
      invoiceId,
      personId: OWNER,
      organizationId: ORG,
      amount: 500,
      dueDate: '2026-12-01',
    });
    const [owned] = await rowsFor(OWNER);
    expect(owned.status).toBe('sent');

    // ATTACKER tries to mark OWNER's notification read → ownership gate rejects.
    await expect(
      markNotificationAsRead(
        makeCtx({ database: H.db, user: { id: ATTACKER, role: 'user' }, _params: { notif: owned.id } }),
      ),
    ).rejects.toThrow('Notification not found');

    // The target row is untouched: still 'sent', read_at still null.
    const after = await H.scopedPool.query(
      `SELECT status, read_at FROM "${H.schema}".notification WHERE id = $1`,
      [owned.id],
    );
    expect(after.rows[0].status).toBe('sent');
    expect(after.rows[0].read_at).toBeNull();
    expect(await repo().getUnreadCount(OWNER)).toBe(1);
  });
});
