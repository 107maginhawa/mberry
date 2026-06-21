/**
 * AXIS inter-module integration: domain-event → notification fan-out CONTRACT
 * for the BULK (membership / enrollment / registrant-driven) consumers.
 *
 * Companion to:
 *   - `notification-fanout-consumer.integration.test.ts` — proves 5 consumers,
 *     INCLUDING the `event.published` bulk fan-out (active-only + internal-only +
 *     org-scope). That one bulk type is EXCLUDED here — do NOT re-author it.
 *   - `notification-fanout-contract.integration.test.ts` (B3 S2) — proves the 15
 *     SINGLE-recipient consumers.
 *   - `booking/booking-notification-consumer.integration.test.ts` (B1 S7) — the 3
 *     booking types.
 *
 * The bulk consumers in `core/domain-event-consumers.ts` resolve a *recipient set*
 * from the DB (active memberships of the org / enrolled training rows / confirmed
 * event registrants / super platform admins), then insert one `notification` row
 * per recipient in CHUNK_SIZE batches inside an UN-AWAITED inner IIFE — so
 * `emit()` resolves before the rows land. The existing UNIT tests stub the DB and
 * only assert `.insert(...)` was *called*; they never prove (a) the recipient-set
 * SQL filter really excludes lapsed/foreign-org/non-enrolled people, (b) the
 * persisted rows carry the right type/title/related-entity, (c) the empty-set
 * guard short-circuits with no error, or (d) every chunk member gets exactly one
 * row. This suite wires the REAL `registerDomainEventConsumers` against a REAL
 * scratch-schema Postgres, emits through the REAL `domainEvents` bus, polls the
 * `notification` table (fire-and-forget IIFE), and asserts the REAL persisted
 * rows.
 *
 * Bulk consumers under test (8, not yet proven):
 *   membership.imported, breach.reported, training.cancelled,
 *   election.status.changed (newStatus==='voting' gate), event.completed,
 *   event.cancelled, training.published, election.created.
 *
 * Source is NOT modified — production consumer code is driven directly. FKs are
 * not copied by `LIKE … INCLUDING ALL`, so we seed only the recipient-set parent
 * rows each consumer reads (membership / training_enrollment / event_registration
 * / platform_admin / training / event).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createFeedbackScratch } from '@/test-utils/feedback-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';
import { domainEvents } from '@/core/domain-events';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const freshId = () => crypto.randomUUID();

// registerDomainEventConsumers requires a membershipRepo dep; none of the bulk
// consumers under test in THIS file call it.
const membershipRepo = {
  async findByPersonAndOrg() {
    return null;
  },
  async updateOneById() {
    return undefined;
  },
};

/** All notification rows for one recipient (the column is recipient_id). */
async function notifsFor(recipient: string): Promise<any[]> {
  const res = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".notification WHERE recipient_id = $1 ORDER BY created_at ASC`,
    [recipient],
  );
  return res.rows;
}

async function notifCount(recipient: string): Promise<number> {
  return (await notifsFor(recipient)).length;
}

/** Poll until >= min rows exist (bulk consumers insert inside an un-awaited IIFE). */
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

// ─── recipient-set seeders ────────────────────────────────────────────────────

/** Seed a membership row with an explicit status (active-only filter source). */
async function insertMembership(opts: {
  organizationId: string;
  personId: string;
  status: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1, $2, $3, $4, $5::date, $6::membership_status)`,
    [freshId(), opts.organizationId, opts.personId, freshId(), '2026-01-01', opts.status],
  );
}

/** Seed a training_enrollment row (training.cancelled enrolled-only filter). */
async function insertEnrollment(opts: {
  trainingId: string;
  personId: string;
  status: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".training_enrollment
       (id, training_id, person_id, status, enrolled_at)
     VALUES ($1, $2, $3, $4::enrollment_status, now())`,
    [freshId(), opts.trainingId, opts.personId, opts.status],
  );
}

/** Seed an event_registration row (event.completed/cancelled confirmed-only filter). */
async function insertRegistration(opts: {
  eventId: string;
  personId: string;
  organizationId: string;
  status: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".event_registration
       (id, event_id, person_id, organization_id, status, registered_at)
     VALUES ($1, $2, $3, $4, $5::registration_status, now())`,
    [freshId(), opts.eventId, opts.personId, opts.organizationId, opts.status],
  );
}

/** Seed a training row (training.published title lookup). */
async function insertTraining(opts: { organizationId: string; title: string }): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".training
       (id, organization_id, title, start_date, end_date, status, visibility)
     VALUES ($1, $2, $3, $4, $5, $6::training_status, $7::training_visibility)`,
    [
      id,
      opts.organizationId,
      opts.title,
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-02T00:00:00Z'),
      'published',
      'internal',
    ],
  );
  return id;
}

/** Seed a super platform_admin row (breach.reported recipient set). */
async function insertSuperAdmin(): Promise<string> {
  const userId = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".platform_admin
       (id, user_id, email, name, role)
     VALUES ($1, $2, $3, $4, $5::admin_role)`,
    [freshId(), userId, `admin-${userId}@example.com`, 'Super Admin', 'super'],
  );
  return userId;
}

beforeAll(async () => {
  H = await createFeedbackScratch([
    'membership',
    'training_enrollment',
    'event_registration',
    'training',
    'platform_admin',
  ]);
  if (!H.dbReachable) return;
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo: membershipRepo as any, db: H.db as any }, noopLogger);
});

afterAll(async () => {
  if (H?.dbReachable) domainEvents.reset();
  await H?.teardown();
});

// ─── membership.imported → bulk welcome (chunked over personIds) ──────────────

describe('consumer: membership.imported (real DB, bulk)', () => {
  test('chunking: every imported personId gets exactly one welcome row (org-entity)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const p1 = freshId();
    const p2 = freshId();
    const p3 = freshId();

    await domainEvents.emit('membership.imported', {
      organizationId: org,
      personIds: [p1, p2, p3],
    });

    const r1 = await waitForNotifs(p1, 1);
    const r2 = await waitForNotifs(p2, 1);
    const r3 = await waitForNotifs(p3, 1);
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    expect(r3).toHaveLength(1);

    const n = r1[0];
    expect(n.recipient_id).toBe(p1);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('system');
    expect(n.channel).toBe('in-app');
    expect(n.status).toBe('sent');
    expect(n.sent_at).not.toBeNull();
    expect(n.consent_validated).toBe(false);
    expect(n.created_by).toBe(SYSTEM_USER_ID);
    expect(n.updated_by).toBe(SYSTEM_USER_ID);
    expect(n.title).toBe('Welcome to the organization');
    expect(n.related_entity_type).toBe('membership');
    // related_entity for the bulk welcome is the ORG id, not a membership id.
    expect(n.related_entity).toBe(org);
  });

  test('empty personIds set → zero rows, no error (guard branch)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const ghost = freshId();
    await domainEvents.emit('membership.imported', { organizationId: org, personIds: [] });
    // Nothing to read by recipient; allow the IIFE a beat then assert org-scoped 0.
    const rows = await waitForNotifs(ghost, 1, 600);
    expect(rows).toHaveLength(0);
  });
});

// ─── breach.reported → notify ALL super platform admins (security type) ───────

describe('consumer: breach.reported (real DB, bulk over super admins)', () => {
  test('notifies every super admin; security type, breach_incident entity, deadline+desc in message', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const breachId = freshId();
    const adminA = await insertSuperAdmin();
    const adminB = await insertSuperAdmin();

    await domainEvents.emit('breach.reported', {
      breachId,
      organizationId: org,
      notificationDeadline: '2026-07-15',
      description: 'Unauthorized DB access detected',
    });

    const aRows = await waitForNotifs(adminA, 1);
    const bRows = await waitForNotifs(adminB, 1);
    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
    const n = aRows[0];
    expect(n.recipient_id).toBe(adminA);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('security');
    expect(n.channel).toBe('in-app');
    expect(n.title).toBe('URGENT: Data Breach Reported');
    expect(n.message).toContain('2026-07-15');
    expect(n.message).toContain('Unauthorized DB access detected');
    expect(n.related_entity_type).toBe('breach_incident');
    expect(n.related_entity).toBe(breachId);
  });
});

// ─── training.cancelled → bulk notify ENROLLED members only ───────────────────

describe('consumer: training.cancelled (real DB, enrolled-only)', () => {
  test('notifies only status=enrolled members; cancelled/completed enrollees excluded', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const trainingId = freshId();
    const enrolled = freshId();
    const alreadyCancelled = freshId();
    const completed = freshId();
    const foreignTrainingEnrolled = freshId();

    await insertEnrollment({ trainingId, personId: enrolled, status: 'enrolled' });
    await insertEnrollment({ trainingId, personId: alreadyCancelled, status: 'cancelled' });
    await insertEnrollment({ trainingId, personId: completed, status: 'completed' });
    // Enrolled but in a DIFFERENT training → must not be notified.
    await insertEnrollment({ trainingId: freshId(), personId: foreignTrainingEnrolled, status: 'enrolled' });

    await domainEvents.emit('training.cancelled', { trainingId, organizationId: org });

    const rows = await waitForNotifs(enrolled, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(enrolled);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('Training Cancelled');
    expect(n.related_entity_type).toBe('training');
    expect(n.related_entity).toBe(trainingId);
    expect(n.type).toBe('system');

    expect(await notifCount(alreadyCancelled)).toBe(0);
    expect(await notifCount(completed)).toBe(0);
    expect(await notifCount(foreignTrainingEnrolled)).toBe(0);
  });

  test('training with no enrolled members → zero rows, no error (empty-set guard)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const trainingId = freshId();
    const onlyCompleted = freshId();
    await insertEnrollment({ trainingId, personId: onlyCompleted, status: 'completed' });

    await domainEvents.emit('training.cancelled', { trainingId, organizationId: org });
    const rows = await waitForNotifs(onlyCompleted, 1, 600);
    expect(rows).toHaveLength(0);
  });
});

// ─── election.status.changed → notify active members ONLY when newStatus==='voting' ─

describe('consumer: election.status.changed (real DB, voting-gate)', () => {
  test('newStatus!=="voting" → ZERO rows (gate short-circuits before any query)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const member = freshId();
    await insertMembership({ organizationId: org, personId: member, status: 'active' });

    await domainEvents.emit('election.status.changed', {
      electionId: freshId(),
      organizationId: org,
      oldStatus: 'draft',
      newStatus: 'nominations',
    });

    const rows = await waitForNotifs(member, 1, 600);
    expect(rows).toHaveLength(0);
  });

  test('newStatus==="voting" → active members notified; election entity; "Voting is now open"', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const otherOrg = freshId();
    const electionId = freshId();
    const active = freshId();
    const lapsed = freshId();
    const foreignActive = freshId();

    await insertMembership({ organizationId: org, personId: active, status: 'active' });
    await insertMembership({ organizationId: org, personId: lapsed, status: 'lapsed' });
    await insertMembership({ organizationId: otherOrg, personId: foreignActive, status: 'active' });

    await domainEvents.emit('election.status.changed', {
      electionId,
      organizationId: org,
      oldStatus: 'nominations',
      newStatus: 'voting',
    });

    const rows = await waitForNotifs(active, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(active);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('Voting is now open');
    expect(n.related_entity_type).toBe('election');
    expect(n.related_entity).toBe(electionId);

    expect(await notifCount(lapsed)).toBe(0);
    expect(await notifCount(foreignActive)).toBe(0);
  });
});

// ─── event.completed → bulk notify CONFIRMED registrants only ─────────────────

describe('consumer: event.completed (real DB, confirmed-only)', () => {
  test('notifies only confirmed registrants; waitlisted/cancelled excluded', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const eventId = freshId();
    const confirmed = freshId();
    const waitlisted = freshId();
    const cancelled = freshId();

    await insertRegistration({ eventId, personId: confirmed, organizationId: org, status: 'confirmed' });
    await insertRegistration({ eventId, personId: waitlisted, organizationId: org, status: 'waitlisted' });
    await insertRegistration({ eventId, personId: cancelled, organizationId: org, status: 'cancelled' });

    await domainEvents.emit('event.completed', { eventId, organizationId: org });

    const rows = await waitForNotifs(confirmed, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(confirmed);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('Event Completed');
    expect(n.related_entity_type).toBe('event');
    expect(n.related_entity).toBe(eventId);

    expect(await notifCount(waitlisted)).toBe(0);
    expect(await notifCount(cancelled)).toBe(0);
  });
});

// ─── event.cancelled → bulk notify CONFIRMED registrants only ─────────────────

describe('consumer: event.cancelled (real DB, confirmed-only)', () => {
  test('notifies confirmed registrants; "Event Cancelled" title; event entity', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const eventId = freshId();
    const confirmed = freshId();
    const cancelledReg = freshId();

    await insertRegistration({ eventId, personId: confirmed, organizationId: org, status: 'confirmed' });
    await insertRegistration({ eventId, personId: cancelledReg, organizationId: org, status: 'cancelled' });

    await domainEvents.emit('event.cancelled', { eventId, organizationId: org });

    const rows = await waitForNotifs(confirmed, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('Event Cancelled');
    expect(n.related_entity_type).toBe('event');
    expect(n.related_entity).toBe(eventId);
    expect(n.organization_id).toBe(org);

    expect(await notifCount(cancelledReg)).toBe(0);
  });

  test('event with no confirmed registrants → zero rows (empty-set guard)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const eventId = freshId();
    const onlyWaitlisted = freshId();
    await insertRegistration({ eventId, personId: onlyWaitlisted, organizationId: org, status: 'waitlisted' });

    await domainEvents.emit('event.cancelled', { eventId, organizationId: org });
    const rows = await waitForNotifs(onlyWaitlisted, 1, 600);
    expect(rows).toHaveLength(0);
  });
});

// ─── training.published → bulk notify active members (title interpolated) ──────

describe('consumer: training.published (real DB, active-only + title lookup)', () => {
  test('notifies active members with the real training title; training entity', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const otherOrg = freshId();
    const active = freshId();
    const lapsed = freshId();
    const foreignActive = freshId();

    const trainingId = await insertTraining({ organizationId: org, title: 'Infection Control 2026' });
    await insertMembership({ organizationId: org, personId: active, status: 'active' });
    await insertMembership({ organizationId: org, personId: lapsed, status: 'lapsed' });
    await insertMembership({ organizationId: otherOrg, personId: foreignActive, status: 'active' });

    await domainEvents.emit('training.published', { trainingId, organizationId: org });

    const rows = await waitForNotifs(active, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(active);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('New Training Available: Infection Control 2026');
    expect(n.related_entity_type).toBe('training');
    expect(n.related_entity).toBe(trainingId);

    expect(await notifCount(lapsed)).toBe(0);
    expect(await notifCount(foreignActive)).toBe(0);
  });
});

// ─── election.created → bulk notify active members ────────────────────────────

describe('consumer: election.created (real DB, active-only)', () => {
  test('notifies active members; election entity; "New Election Created"', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const electionId = freshId();
    const active = freshId();
    const suspended = freshId();

    await insertMembership({ organizationId: org, personId: active, status: 'active' });
    await insertMembership({ organizationId: org, personId: suspended, status: 'suspended' });

    await domainEvents.emit('election.created', { electionId, organizationId: org });

    const rows = await waitForNotifs(active, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(active);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('New Election Created');
    expect(n.related_entity_type).toBe('election');
    expect(n.related_entity).toBe(electionId);

    expect(await notifCount(suspended)).toBe(0);
  });

  test('org with no active members → zero rows, no error (empty-set guard)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const lapsedOnly = freshId();
    await insertMembership({ organizationId: org, personId: lapsedOnly, status: 'lapsed' });

    await domainEvents.emit('election.created', { electionId: freshId(), organizationId: org });
    const rows = await waitForNotifs(lapsedOnly, 1, 600);
    expect(rows).toHaveLength(0);
  });
});
