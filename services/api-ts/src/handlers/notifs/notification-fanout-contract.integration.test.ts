/**
 * AXIS inter-module integration: domain-event → notification fan-out CONTRACT
 * for the SINGLE-RECIPIENT consumers (the 15 not yet proven elsewhere).
 *
 * Companion to `notification-fanout-consumer.integration.test.ts`, which already
 * proves 5 consumers (officer.assigned, member.suspended, credit.awarded,
 * membership.status.changed, event.published), and to the B1
 * `booking-notification-consumer.integration.test.ts`, which proves the 3
 * booking types (booking.confirmed, booking.rejected, booking.cancelled). Those
 * 8 are intentionally EXCLUDED here — do NOT re-author them.
 *
 * The consumers in `core/domain-event-consumers.ts` are the glue that turns a
 * cross-module business event into a REAL row in the `notification` table the
 * member sees in-app. The existing UNIT tests stub the DB and only assert
 * `.insert(...)` was *called* — they never prove the row persists with the
 * correct recipient / type / channel / status / org-scope / related-entity
 * mapping / interpolated message, nor that Postgres' notification enums accept
 * the written values. This suite wires the REAL `registerDomainEventConsumers`
 * against a REAL scratch-schema Postgres, emits through the REAL `domainEvents`
 * bus, and asserts the REAL persisted rows.
 *
 * Consumers under test (15 single-recipient, not yet proven):
 *   dues.payment.refunded, dues.invoice.generated, dues.payment.proof.rejected,
 *   officer.removed, officer.transitioned, membership.created, ticket.reopened,
 *   ticket.status.changed, training.enrollment.cancelled, event.registered,
 *   nomination.submitted, member.removed, credit.adjusted, invite.claimed,
 *   data-export.ready.
 *
 * Source is NOT modified — we drive the production consumer code. FKs are not
 * copied by `LIKE … INCLUDING ALL`, so we seed only the few parent rows a
 * consumer actually reads (position for officer.transitioned/nomination.submitted,
 * invitation_token for invite.claimed, an active membership for data-export.ready).
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

// registerDomainEventConsumers requires a membershipRepo dep; none of the
// consumers under test in THIS file call it (dues.payment.recorded does, which
// we never emit here).
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

/** Poll until >= min rows exist (for consumers that insert inside an un-awaited IIFE). */
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

/** Seed a position row (officer.transitioned / nomination.submitted title lookup). */
async function insertPosition(opts: { organizationId: string; title: string }): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".position (id, organization_id, title, level)
     VALUES ($1, $2, $3, $4::position_level)`,
    [id, opts.organizationId, opts.title, 'national'],
  );
  return id;
}

/** Seed an invitation_token row (invite.claimed officer lookup). */
async function insertInvite(opts: {
  organizationId: string;
  createdByOfficer: string;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".invitation_token
       (id, token_hash, type, expires_at, created_by_officer, email, organization_id)
     VALUES ($1, $2, $3::invite_type, $4::timestamptz, $5, $6, $7)`,
    [
      id,
      `hash-${id}`,
      'invite',
      '2099-01-01T00:00:00Z',
      opts.createdByOfficer,
      `invitee-${id}@example.com`,
      opts.organizationId,
    ],
  );
  return id;
}

/** Seed an active membership row (data-export.ready derives org from it). */
async function insertActiveMembership(opts: {
  organizationId: string;
  personId: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1, $2, $3, $4, $5::date, $6::membership_status)`,
    [freshId(), opts.organizationId, opts.personId, freshId(), '2026-01-01', 'active'],
  );
}

beforeAll(async () => {
  H = await createFeedbackScratch(['position', 'invitation_token', 'membership']);
  if (!H.dbReachable) return;
  domainEvents.reset();
  registerDomainEventConsumers({ membershipRepo: membershipRepo as any, db: H.db as any }, noopLogger);
});

afterAll(async () => {
  if (H?.dbReachable) domainEvents.reset();
  await H?.teardown();
});

// ─── dues.payment.refunded → notify member of a refund ────────────────────────

describe('consumer: dues.payment.refunded (real DB)', () => {
  test('full refund: one row to personId, dues-payment entity, refund amount in message', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const paymentId = freshId();

    await domainEvents.emit('dues.payment.refunded', {
      paymentId,
      personId: person,
      organizationId: org,
      refundAmount: 1500,
      isFullRefund: true,
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
    expect(n.consent_validated).toBe(false);
    expect(n.created_by).toBe(SYSTEM_USER_ID);
    expect(n.updated_by).toBe(SYSTEM_USER_ID);
    expect(n.title).toBe('Your dues payment was refunded');
    expect(n.message).toContain('1500');
    expect(n.related_entity_type).toBe('dues-payment');
    expect(n.related_entity).toBe(paymentId);
  });

  test('partial refund flips the title', async () => {
    if (!H.dbReachable) return;
    const person = freshId();
    await domainEvents.emit('dues.payment.refunded', {
      paymentId: freshId(),
      personId: person,
      organizationId: freshId(),
      refundAmount: 200,
      isFullRefund: false,
    });
    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Your dues payment was partially refunded');
  });
});

// ─── dues.invoice.generated → notify member of a new invoice ──────────────────

describe('consumer: dues.invoice.generated (real DB)', () => {
  test('one row to personId, dues-invoice entity, amount + due date in message', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const invoiceId = freshId();

    await domainEvents.emit('dues.invoice.generated', {
      invoiceId,
      personId: person,
      organizationId: org,
      amount: 3000,
      dueDate: '2026-09-30',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('system');
    expect(n.title).toBe('New dues invoice');
    expect(n.message).toContain('3000');
    expect(n.message).toContain('2026-09-30');
    expect(n.related_entity_type).toBe('dues-invoice');
    expect(n.related_entity).toBe(invoiceId);
  });
});

// ─── dues.payment.proof.rejected → notify member to resubmit ──────────────────

describe('consumer: dues.payment.proof.rejected (real DB)', () => {
  test('one row carrying the reject reason; dues-payment entity', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const paymentId = freshId();

    await domainEvents.emit('dues.payment.proof.rejected', {
      paymentId,
      personId: person,
      organizationId: org,
      reason: 'Blurry receipt',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('Payment proof rejected');
    expect(n.message).toContain('Blurry receipt');
    expect(n.related_entity_type).toBe('dues-payment');
    expect(n.related_entity).toBe(paymentId);
    expect(n.organization_id).toBe(org);
  });
});

// ─── officer.removed → notify the person whose term ended ─────────────────────

describe('consumer: officer.removed (real DB)', () => {
  test('one row to personId, officer_term entity = termId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const termId = freshId();

    await domainEvents.emit('officer.removed', {
      termId,
      personId: person,
      organizationId: org,
      removedBy: freshId(),
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('Your officer term has ended');
    expect(n.related_entity_type).toBe('officer_term');
    expect(n.related_entity).toBe(termId);
  });
});

// ─── officer.transitioned → notify the successor (with looked-up title) ───────

describe('consumer: officer.transitioned (real DB)', () => {
  test('notifies successorPersonId; title interpolates the real position title', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const successor = freshId();
    const newTermId = freshId();
    const positionId = await insertPosition({ organizationId: org, title: 'Secretary' });

    await domainEvents.emit('officer.transitioned', {
      positionId,
      successorPersonId: successor,
      newTermId,
      organizationId: org,
    });

    const rows = await notifsFor(successor);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(successor);
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('Officer Transition: You are the new Secretary');
    expect(n.message).toContain('Secretary');
    expect(n.related_entity_type).toBe('officer_term');
    expect(n.related_entity).toBe(newTermId);
  });
});

// ─── membership.created → welcome notification (3 consumers registered; only the
//     notify one writes a `notification` row — the other two touch channels /
//     dues and never insert a notification for this seed) ──────────────────────

describe('consumer: membership.created (real DB)', () => {
  test('welcome notification: one membership-entity row to personId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const membershipId = freshId();

    await domainEvents.emit('membership.created', {
      membershipId,
      personId: person,
      organizationId: org,
    });

    // The channel-auto-join + first-invoice consumers swallow their own errors
    // (no parent channel/tier rows seeded) and emit no notification, so the
    // welcome row is the only notification persisted.
    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('Welcome! Your membership is now active');
    expect(n.related_entity_type).toBe('membership');
    expect(n.related_entity).toBe(membershipId);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('system');
  });
});

// ─── ticket.reopened → notify the assigned officer ───────────────────────────

describe('consumer: ticket.reopened (real DB)', () => {
  test('notifies assignedTo; subject in message; support-ticket entity', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const assignee = freshId();
    const ticketId = freshId();

    await domainEvents.emit('ticket.reopened', {
      ticketId,
      assignedTo: assignee,
      organizationId: org,
      subject: 'Cannot log in',
    });

    const rows = await notifsFor(assignee);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(assignee);
    expect(n.title).toBe('Support ticket reopened');
    expect(n.message).toContain('Cannot log in');
    expect(n.related_entity_type).toBe('support-ticket');
    expect(n.related_entity).toBe(ticketId);
    expect(n.organization_id).toBe(org);
  });

  test('unassigned ticket → no notification', async () => {
    if (!H.dbReachable) return;
    const ticketId = freshId();
    await domainEvents.emit('ticket.reopened', {
      ticketId,
      assignedTo: null,
      organizationId: freshId(),
      subject: 'Orphan',
    });
    // No recipient to read by; assert via the related entity that nothing landed.
    const res = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".notification WHERE related_entity = $1`,
      [ticketId],
    );
    expect(res.rows[0].c).toBe(0);
  });
});

// ─── ticket.status.changed → notify the reporter ─────────────────────────────

describe('consumer: ticket.status.changed (real DB)', () => {
  test('notifies reportedBy; the new status is quoted in the message', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const reporter = freshId();
    const ticketId = freshId();

    await domainEvents.emit('ticket.status.changed', {
      ticketId,
      reportedBy: reporter,
      organizationId: org,
      subject: 'Billing question',
      status: 'resolved',
    });

    const rows = await notifsFor(reporter);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(reporter);
    expect(n.title).toBe('Support ticket update');
    expect(n.message).toContain('Billing question');
    expect(n.message).toContain('"resolved"');
    expect(n.related_entity_type).toBe('support-ticket');
    expect(n.related_entity).toBe(ticketId);
  });
});

// ─── training.enrollment.cancelled → notify member (un-awaited IIFE) ──────────

describe('consumer: training.enrollment.cancelled (real DB)', () => {
  test('notifies personId; training entity = trainingId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const trainingId = freshId();

    await domainEvents.emit('training.enrollment.cancelled', {
      personId: person,
      organizationId: org,
      trainingId,
    });

    const rows = await waitForNotifs(person, 1);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    expect(n.title).toBe('Training Enrollment Cancelled');
    expect(n.related_entity_type).toBe('training');
    expect(n.related_entity).toBe(trainingId);
    expect(n.organization_id).toBe(org);
  });
});

// ─── event.registered → confirm the registrant ───────────────────────────────

describe('consumer: event.registered (real DB)', () => {
  test('notifies personId; event entity = eventId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const eventId = freshId();

    await domainEvents.emit('event.registered', {
      eventId,
      personId: person,
      organizationId: org,
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    expect(n.title).toBe('Registration Confirmed');
    expect(n.related_entity_type).toBe('event');
    expect(n.related_entity).toBe(eventId);
    expect(n.organization_id).toBe(org);
  });
});

// ─── nomination.submitted → notify the nominee (with looked-up title) ─────────

describe('consumer: nomination.submitted (real DB)', () => {
  test('notifies nomineeId; title interpolates position; election entity', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const nominee = freshId();
    const electionId = freshId();
    const positionId = await insertPosition({ organizationId: org, title: 'President' });

    await domainEvents.emit('nomination.submitted', {
      nomineeId: nominee,
      positionId,
      electionId,
      organizationId: org,
    });

    const rows = await notifsFor(nominee);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(nominee);
    expect(n.title).toBe('You have been nominated for President');
    expect(n.message).toContain('President');
    expect(n.related_entity_type).toBe('election');
    expect(n.related_entity).toBe(electionId);
    expect(n.organization_id).toBe(org);
  });
});

// ─── member.removed → notify the removed member ──────────────────────────────

describe('consumer: member.removed (real DB)', () => {
  test('notifies personId; membership entity = disciplinaryActionId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const disciplinaryActionId = freshId();

    await domainEvents.emit('member.removed', {
      personId: person,
      organizationId: org,
      disciplinaryActionId,
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('Membership Removed');
    expect(n.related_entity_type).toBe('membership');
    expect(n.related_entity).toBe(disciplinaryActionId);
    expect(n.organization_id).toBe(org);
  });
});

// ─── credit.adjusted → notify member of the manual adjustment ────────────────

describe('consumer: credit.adjusted (real DB)', () => {
  test('notifies personId; amount + reason in message; training entity = creditEntryId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const creditEntryId = freshId();

    await domainEvents.emit('credit.adjusted', {
      personId: person,
      organizationId: org,
      creditEntryId,
      creditAmount: -2,
      reason: 'Duplicate entry',
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.title).toBe('CPD Credit Adjustment');
    expect(n.message).toContain('-2');
    expect(n.message).toContain('Duplicate entry');
    expect(n.related_entity_type).toBe('training');
    expect(n.related_entity).toBe(creditEntryId);
    expect(n.organization_id).toBe(org);
  });
});

// ─── invite.claimed → notify the inviting officer (looked up from the token) ──

describe('consumer: invite.claimed (real DB)', () => {
  test('notifies the createdByOfficer of the token; invite entity = inviteId', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const officer = freshId();
    const inviteId = await insertInvite({ organizationId: org, createdByOfficer: officer });

    await domainEvents.emit('invite.claimed', {
      inviteId,
      organizationId: org,
      personId: freshId(),
    });

    const rows = await notifsFor(officer);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(officer);
    expect(n.title).toBe('Invitation Accepted');
    expect(n.related_entity_type).toBe('invite');
    expect(n.related_entity).toBe(inviteId);
    expect(n.organization_id).toBe(org);
  });

  test('unknown invite id → no notification (no officer to notify)', async () => {
    if (!H.dbReachable) return;
    const ghostInvite = freshId();
    await domainEvents.emit('invite.claimed', {
      inviteId: ghostInvite,
      organizationId: freshId(),
      personId: freshId(),
    });
    const res = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".notification WHERE related_entity = $1`,
      [ghostInvite],
    );
    expect(res.rows[0].c).toBe(0);
  });
});

// ─── data-export.ready → notify the person (org derived from active membership) ─

describe('consumer: data-export.ready (real DB)', () => {
  test('derives org from the active membership; notifies personId; data-export entity', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const person = freshId();
    const exportId = freshId();
    await insertActiveMembership({ organizationId: org, personId: person });

    await domainEvents.emit('data-export.ready', {
      personId: person,
      exportId,
    });

    const rows = await notifsFor(person);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(person);
    // org is NOT in the payload — it must come from the active membership row.
    expect(n.organization_id).toBe(org);
    expect(n.title).toBe('Your data export is ready');
    expect(n.related_entity_type).toBe('data-export');
    expect(n.related_entity).toBe(exportId);
  });

  test('person with no active membership → no notification (org-null guard)', async () => {
    if (!H.dbReachable) return;
    const person = freshId();
    const exportId = freshId();

    await domainEvents.emit('data-export.ready', {
      personId: person,
      exportId,
    });

    expect(await notifCount(person)).toBe(0);
  });
});
