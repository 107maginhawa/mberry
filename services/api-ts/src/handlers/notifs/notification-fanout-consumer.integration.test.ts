/**
 * AXIS-3 inter-module integration: domain-event → notification fan-out.
 *
 * The domain-event consumers in `core/domain-event-consumers.ts` are the glue
 * that turns a cross-module business event (an officer being assigned, a member
 * suspended, CPD credits awarded, an event published, a membership status
 * change) into a REAL row in the `notification` table that the member then sees
 * in-app. The existing unit tests for these consumers stub the DB and only
 * assert that `.insert(notifications).values(...)` was *called* with some shape —
 * they never prove the row actually persists with the correct columns, that the
 * active-member / org-scope filtering really excludes the rows it should, or
 * that the enum/uuid columns Postgres enforces accept the values the consumer
 * writes.
 *
 * This suite wires the REAL `registerDomainEventConsumers(...)` against a REAL
 * scratch-schema Postgres (so the actual `notification` enums + NOT NULL +
 * length constraints are enforced), emits the events through the REAL
 * `domainEvents` bus, and asserts the REAL persisted notification rows:
 * recipient, type, channel, title, message, status, related-entity mapping,
 * org scoping, and the per-consumer fan-out filters (e.g. event.published only
 * reaches ACTIVE members of the SAME org, and only for INTERNAL-visibility
 * events).
 *
 * Consumers under test (5):
 *   - officer.assigned          (looks up position.title, notifies assignee)
 *   - member.suspended          (notifies suspended member; actionType/expiresAt in body)
 *   - credit.awarded            (relatedEntityType branches training vs credit-entry)
 *   - membership.status.changed (notifies member; newStatus in body)
 *   - event.published           (bulk fan-out: active-members-only + internal-only + org-scoped)
 *
 * Isolation: the shared `createScratch` harness copies the real public table
 * structures (`LIKE ... INCLUDING ALL`), so every enum/default/NOT NULL the
 * consumers depend on is present without hand-DDL drift. FKs are not copied, so
 * we seed notification/officer_term/position/membership/event rows directly
 * without standing up every parent. If Postgres is unreachable the suite skips
 * cleanly. Source is NOT modified — we drive the production consumer code.
 *
 * Because several consumers fire the insert inside an un-awaited inner IIFE
 * (event.published, etc.), `emit()` resolves before the row lands. We poll the
 * table with a bounded timeout for those, and assert directly for the
 * synchronous-insert consumers.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const freshId = () => crypto.randomUUID();

// A membership repo stub — the fan-out consumers under test never call it, but
// registerDomainEventConsumers requires the dep. (dues.payment.recorded uses it,
// which we don't drive.)
const membershipRepo = {
  async findByPersonAndOrg() {
    return null;
  },
  async updateOneById() {
    return undefined;
  },
};

/** Read all notification rows for one recipient (scratch schema). */
async function notifsFor(recipient: string): Promise<any[]> {
  const res = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".notification WHERE recipient_id = $1 ORDER BY created_at ASC`,
    [recipient],
  );
  return res.rows;
}

/** Count notifications for a recipient. */
async function notifCount(recipient: string): Promise<number> {
  const rows = await notifsFor(recipient);
  return rows.length;
}

/**
 * Poll until at least `min` notifications exist for a recipient (for the
 * fire-and-forget IIFE consumers whose insert outlives emit()). Returns the rows.
 */
async function waitForNotifs(recipient: string, min = 1, timeoutMs = 4000): Promise<any[]> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await notifsFor(recipient);
    if (rows.length >= min) return rows;
    if (Date.now() > deadline) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Seed a position row; returns id. */
async function insertPosition(opts: { organizationId: string; title: string }): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (id, organization_id, title, level)
     VALUES ($1, $2, $3, $4::position_level)`,
    [id, opts.organizationId, opts.title, 'national'],
  );
  return id;
}

/** Seed a membership row; returns id. */
async function insertMembership(opts: {
  organizationId: string;
  personId: string;
  status: string;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1, $2, $3, $4, $5::date, $6::membership_status)`,
    [id, opts.organizationId, opts.personId, freshId(), '2026-01-01', opts.status],
  );
  return id;
}

/** Seed an event row; returns id. */
async function insertEvent(opts: {
  organizationId: string;
  title: string;
  visibility: 'internal' | 'network';
  status?: string;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".event
       (id, organization_id, title, start_date, end_date, status, visibility)
     VALUES ($1, $2, $3, $4, $5, $6::event_status, $7::event_visibility)`,
    [
      id,
      opts.organizationId,
      opts.title,
      new Date('2026-07-01T00:00:00Z'),
      new Date('2026-07-02T00:00:00Z'),
      opts.status ?? 'published',
      opts.visibility,
    ],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch([
    'notification',
    'position',
    'officer_term',
    'membership',
    'event',
  ]);

  if (!H.dbReachable) return;

  // Wire the REAL production consumers onto the singleton bus, pointed at the
  // scratch DB. Reset first so we don't double-register against a bus another
  // suite touched, then re-register at teardown is unnecessary (suite-isolated).
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo: membershipRepo as any, db: H.db as any }, noopLogger);
});

afterAll(async () => {
  if (H?.dbReachable) domainEvents.reset();
  await H?.teardown();
});

// ─── officer.assigned → notify the assignee (with position title) ─────────────

describe('consumer: officer.assigned (real DB)', () => {
  test('inserts an in-app notification to the assigned person, titled with the real position title', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const termId = freshId();
    const positionId = await insertPosition({ organizationId: org, title: 'Treasurer' });

    await domainEvents.emit('officer.assigned', {
      termId,
      personId: person,
      positionId,
      organizationId: org,
      assignedBy: freshId(),
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('system');
    expect(n.channel).toBe('in-app');
    expect(n.status).toBe('sent');
    expect(n.sent_at).not.toBeNull();
    // Title interpolates the looked-up position title (proves the join ran).
    expect(n.title).toBe('You have been assigned as Treasurer');
    expect(n.related_entity_type).toBe('officer_term');
    expect(n.related_entity).toBe(termId);
    expect(n.consent_validated).toBe(false);
    expect(n.created_by).toBe(SYSTEM_USER_ID);
  });

  test('falls back to a generic title when the position row is missing', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const termId = freshId();

    await domainEvents.emit('officer.assigned', {
      termId,
      personId: person,
      positionId: freshId(), // no position row exists → fallback path
      organizationId: org,
      assignedBy: freshId(),
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('You have been assigned as an officer position');
    expect(rows[0].related_entity).toBe(termId);
  });
});

// ─── member.suspended → notify the suspended member ───────────────────────────

describe('consumer: member.suspended (real DB)', () => {
  test('notifies the member; body carries the actionType and the expiry date', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const disciplinaryActionId = freshId();

    await domainEvents.emit('member.suspended', {
      disciplinaryActionId,
      personId: person,
      organizationId: org,
      actionType: 'suspension',
      issuedBy: freshId(),
      expiresAt: '2026-12-31',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('system');
    expect(n.title).toBe('Membership Suspended');
    expect(n.message).toContain('suspension');
    expect(n.message).toContain('2026-12-31');
    // relatedEntity maps to the disciplinary action, not the membership id.
    expect(n.related_entity_type).toBe('membership');
    expect(n.related_entity).toBe(disciplinaryActionId);
  });

  test('omits the expiry sentence when expiresAt is null', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();

    await domainEvents.emit('member.suspended', {
      disciplinaryActionId: freshId(),
      personId: person,
      organizationId: org,
      actionType: 'removal',
      issuedBy: freshId(),
      expiresAt: null,
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain('removal');
    expect(rows[0].message).not.toContain('Suspension expires');
  });
});

// ─── credit.awarded → notify the member of CPD credits earned ─────────────────

describe('consumer: credit.awarded (real DB)', () => {
  test('training-sourced award: relatedEntityType=training, relatedEntity=trainingId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const trainingId = freshId();

    await domainEvents.emit('credit.awarded', {
      personId: person,
      organizationId: org,
      trainingId,
      creditEntryId: freshId(),
      creditAmount: 2.5,
      activityName: 'Advanced Periodontics',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('CPD Credits Awarded');
    expect(n.message).toContain('2.5');
    expect(n.message).toContain('Advanced Periodontics');
    // trainingId present → relatedEntityType is 'training' and points at training.
    expect(n.related_entity_type).toBe('training');
    expect(n.related_entity).toBe(trainingId);
  });

  test('manual award (no trainingId): relatedEntityType=credit-entry, relatedEntity=creditEntryId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const creditEntryId = freshId();

    await domainEvents.emit('credit.awarded', {
      personId: person,
      organizationId: org,
      creditEntryId,
      creditAmount: 1,
      activityName: 'Self-Directed Study',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    expect(rows[0].related_entity_type).toBe('credit-entry');
    expect(rows[0].related_entity).toBe(creditEntryId);
  });
});

// ─── membership.status.changed → notify the member (newStatus in body) ────────

describe('consumer: membership.status.changed (real DB)', () => {
  test('notifies the member with the new status quoted in the message', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const membershipId = freshId();

    await domainEvents.emit('membership.status.changed', {
      membershipId,
      personId: person,
      organizationId: org,
      oldStatus: 'pendingPayment',
      newStatus: 'active',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('Member ID Card Updated');
    expect(n.message).toContain('"active"');
    expect(n.related_entity_type).toBe('membership');
    expect(n.related_entity).toBe(membershipId);
    expect(n.recipient_id).toBe(person);
    expect(n.organization_id).toBe(org);
  });
});

// ─── event.published → bulk fan-out: active-only + internal-only + org-scoped ──

describe('consumer: event.published (real DB, bulk fan-out + filters)', () => {
  test('notifies ONLY active members of the SAME org, with the real event title', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const otherOrg = freshId();

    const activeA = freshId();
    const activeB = freshId();
    const lapsed = freshId();
    const suspended = freshId();
    const foreignActive = freshId(); // active, but in another org

    await insertMembership({ organizationId: org, personId: activeA, status: 'active' });
    await insertMembership({ organizationId: org, personId: activeB, status: 'active' });
    await insertMembership({ organizationId: org, personId: lapsed, status: 'lapsed' });
    await insertMembership({ organizationId: org, personId: suspended, status: 'suspended' });
    await insertMembership({ organizationId: otherOrg, personId: foreignActive, status: 'active' });

    const eventId = await insertEvent({
      organizationId: org,
      title: 'Annual General Assembly',
      visibility: 'internal',
    });

    await domainEvents.emit('event.published', {
      eventId,
      organizationId: org,
      publishedBy: freshId(),
    });

    // Active members of THIS org receive exactly one notification each.
    const aRows = await waitForNotifs(activeA, 1);
    const bRows = await waitForNotifs(activeB, 1);
    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
    expect(aRows[0].title).toBe('New Event: Annual General Assembly');
    expect(aRows[0].type).toBe('system');
    expect(aRows[0].channel).toBe('in-app');
    expect(aRows[0].related_entity_type).toBe('event');
    expect(aRows[0].related_entity).toBe(eventId);
    expect(aRows[0].organization_id).toBe(org);

    // Non-active members and the foreign-org active member get NOTHING.
    // (Give the IIFE a beat to have finished — A/B already landed, so the
    // fan-out loop has run; these counts are now stable.)
    expect(await notifCount(lapsed)).toBe(0);
    expect(await notifCount(suspended)).toBe(0);
    expect(await notifCount(foreignActive)).toBe(0);
  });

  test('network-visibility events do NOT fan out to members (internal-only gate)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const member = freshId();
    await insertMembership({ organizationId: org, personId: member, status: 'active' });

    const eventId = await insertEvent({
      organizationId: org,
      title: 'Public Networking Mixer',
      visibility: 'network',
    });

    await domainEvents.emit('event.published', {
      eventId,
      organizationId: org,
      publishedBy: freshId(),
    });

    // Bounded wait — but we expect ZERO, so allow the timeout to lapse.
    const rows = await waitForNotifs(member, 1, 800);
    expect(rows).toHaveLength(0);
  });

  test('a missing event row produces no notifications (guard branch)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const member = freshId();
    await insertMembership({ organizationId: org, personId: member, status: 'active' });

    await domainEvents.emit('event.published', {
      eventId: freshId(), // no event row
      organizationId: org,
      publishedBy: freshId(),
    });

    const rows = await waitForNotifs(member, 1, 800);
    expect(rows).toHaveLength(0);
  });
});
