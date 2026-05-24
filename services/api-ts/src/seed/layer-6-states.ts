/**
 * Layer 6: State coverage seeding — Phase 30
 *
 * Fills every state machine gap so every enum value has at least
 * one record for UI testing.
 */

import { eq, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { daysAgo, daysFromNow } from './helpers';

// Schema imports
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { duesPaymentStatusHistory } from '@/handlers/association:member/repos/dues-payment-status-history.schema';
import { events, eventRegistrations } from '@/handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from '@/handlers/association:operations/repos/training.schema';
import { notifications } from '@/handlers/notifs/repos/notification.schema';
import { announcements } from '@/handlers/communication/repos/communication.schema';

// ═══════════════════════════════════════════════════════════════
// Phase 30: State Coverage — fill every state machine gap
// Ensures every enum value has at least 1 record for UI testing
// ═══════════════════════════════════════════════════════════════

export async function seedStateCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  State coverage (filling enum gaps)...');

  // ─── Payment States (7 missing: failed, expired, refunded, partiallyRefunded, underReview, confirmed, rejected) ──
  try {
    const existingPayments = await db.select().from(duesPayments).limit(1);
    // Only seed if duesPayments table has some data (means base payments exist)
    if (existingPayments.length > 0) {
      const paymentStates = [
        { status: 'failed', receiptNumber: 'STATE-FAIL-001', amount: 200000, method: 'online', paidAt: null, expiredAt: daysAgo(10), referenceNumber: 'GW-FAIL-TIMEOUT', metadata: { failureReason: 'Gateway timeout', gatewayCode: 'TIMEOUT' } },
        { status: 'expired', receiptNumber: 'STATE-EXP-001', amount: 200000, method: 'online', paidAt: null, expiredAt: daysAgo(5), referenceNumber: null, metadata: { expiryReason: '24h payment window elapsed' } },
        { status: 'refunded', receiptNumber: 'STATE-REF-001', amount: 200000, method: 'bankTransfer', paidAt: daysAgo(20), expiredAt: null, referenceNumber: 'REF-2025-001', metadata: { refundReason: 'Duplicate payment', refundedAt: daysAgo(15).toISOString() } },
        { status: 'partiallyRefunded', receiptNumber: 'STATE-PREF-001', amount: 200000, method: 'gcash', paidAt: daysAgo(25), expiredAt: null, referenceNumber: 'PREF-2025-001', metadata: { partialRefundAmount: 100000, refundReason: 'Overpayment adjustment' } },
        { status: 'underReview', receiptNumber: 'STATE-REV-001', amount: 200000, method: 'cash', paidAt: null, expiredAt: null, referenceNumber: null, proofStorageKey: 'proofs/manual-payment-001.jpg', proofFileName: 'deposit-slip.jpg', proofMimeType: 'image/jpeg' },
        { status: 'confirmed', receiptNumber: 'STATE-CONF-001', amount: 200000, method: 'check', paidAt: daysAgo(3), expiredAt: null, referenceNumber: 'CHK-0012345', metadata: { confirmedBy: presidentPersonId, confirmNote: 'Verified via bank statement' } },
        { status: 'rejected', receiptNumber: 'STATE-REJ-001', amount: 200000, method: 'cash', paidAt: null, expiredAt: null, referenceNumber: null, rejectionReason: 'Proof of payment is illegible — please resubmit a clear photo', proofStorageKey: 'proofs/blurry-receipt.jpg', proofFileName: 'receipt-blurry.jpg', proofMimeType: 'image/jpeg' },
      ];

      for (let i = 0; i < paymentStates.length; i++) {
        const ps = paymentStates[i]!;
        const personId = memberPersonIds[i % memberPersonIds.length]!;
        const existing = await db.execute(sql`SELECT id FROM dues_payment WHERE receipt_number = ${ps.receiptNumber} LIMIT 1`);
        if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
          await db.insert(duesPayments).values({
            organizationId: orgId,
            personId,
            receiptNumber: ps.receiptNumber,
            amount: ps.amount,
            currency: 'PHP',
            paymentMethod: ps.method,
            status: ps.status,
            referenceNumber: ps.referenceNumber,
            paidAt: ps.paidAt,
            expiredAt: ps.expiredAt,
            rejectionReason: (ps as any).rejectionReason ?? null,
            proofStorageKey: (ps as any).proofStorageKey ?? null,
            proofFileName: (ps as any).proofFileName ?? null,
            proofMimeType: (ps as any).proofMimeType ?? null,
            metadata: ps.metadata ?? null,
            recordedBy: ps.method === 'cash' || ps.method === 'check' ? presidentPersonId : null,
          } as any);
        }
      }
      console.log('    ✓ 7 payment state-coverage records (failed, expired, refunded, partiallyRefunded, underReview, confirmed, rejected)');
    }
  } catch (e) {
    console.log(`    (payment state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Election States (3 missing: awaitingConfirmation, published, cancelled) ──
  try {
    const electionStates = [
      { title: 'Board Election 2024 (Results Published)', status: 'published', year: 2024 },
      { title: 'Special Election — VP Vacancy (Cancelled)', status: 'cancelled', year: 2025 },
      { title: 'Board Election 2025 (Awaiting Confirmation)', status: 'awaitingConfirmation', year: 2025 },
    ];

    for (const e of electionStates) {
      const existing = await db.execute(sql`SELECT id FROM election WHERE title = ${e.title} LIMIT 1`);
      if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
        await db.execute(sql`
          INSERT INTO election (organization_id, title, description, election_type, voting_mode, status,
            nominations_open_at, nominations_close_at, voting_open_at, voting_close_at)
          VALUES (${orgId}, ${e.title}, ${'State coverage seed — ' + e.status},
            'officer'::election_type, 'online'::voting_mode, ${e.status}::election_status,
            ${daysAgo(120)}, ${daysAgo(90)}, ${daysAgo(60)}, ${daysAgo(30)})
        `);
      }
    }
    console.log('    ✓ 3 election state-coverage records (published, cancelled, awaitingConfirmation)');
  } catch (e) {
    console.log(`    (election state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Event: 1 cancelled ──
  try {
    const existing = await db.select({ id: events.id }).from(events).where(eq(events.status, 'cancelled')).limit(1);
    if (existing.length === 0) {
      await db.insert(events).values({
        organizationId: orgId,
        title: 'Dental Health Day 2025 (Cancelled)',
        description: 'Community outreach event cancelled due to venue unavailability.',
        eventDate: daysAgo(30),
        endDate: daysAgo(30),
        location: 'Rizal Park, Manila',
        maxCapacity: 200,
        status: 'cancelled',
        visibility: 'internal',
        eventType: 'seminar',
        createdBy: presidentPersonId,
      } as any);
      console.log('    ✓ 1 cancelled event');
    }
  } catch (e) {
    console.log(`    (cancelled event failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Event: 1 capacity-limited (BR-27: waitlist scenario) ──
  try {
    const existing = await db.execute(sql`SELECT id FROM event WHERE title = 'Hands-On Composite Workshop (Full)' LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      const [fullEvent] = await db.insert(events).values({
        organizationId: orgId,
        title: 'Hands-On Composite Workshop (Full)',
        description: 'Limited capacity workshop — exercises BR-27 waitlist behavior.',
        eventDate: daysFromNow(14),
        endDate: daysFromNow(14),
        location: 'PDA Training Center, Makati',
        maxCapacity: 3,
        status: 'published',
        visibility: 'internal',
        eventType: 'workshop',
        createdBy: presidentPersonId,
      } as any).returning({ id: events.id });

      if (fullEvent) {
        // 3 confirmed (at capacity) + 2 waitlisted
        for (let i = 0; i < 5; i++) {
          const personId = memberPersonIds[i]!;
          await db.insert(eventRegistrations).values({
            organizationId: orgId,
            eventId: fullEvent.id,
            personId,
            status: i < 3 ? 'confirmed' : 'waitlisted',
            registeredAt: daysAgo(7 - i),
          } as any);
        }
        // 1 cancelled registration
        await db.insert(eventRegistrations).values({
          organizationId: orgId,
          eventId: fullEvent.id,
          personId: memberPersonIds[5]!,
          status: 'cancelled',
          registeredAt: daysAgo(6),
        } as any);
        console.log('    ✓ 1 capacity-limited event (3 confirmed, 2 waitlisted, 1 cancelled registration)');
      }
    }
  } catch (e) {
    console.log(`    (capacity event failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Training: 1 cancelled ──
  try {
    const existing = await db.select({ id: trainings.id }).from(trainings).where(eq(trainings.status, 'cancelled')).limit(1);
    if (existing.length === 0) {
      const [cancelledTraining] = await db.insert(trainings).values({
        organizationId: orgId,
        title: 'Advanced Prosthodontics Workshop (Cancelled)',
        description: 'Cancelled due to insufficient enrollment.',
        startDate: daysAgo(14),
        endDate: daysAgo(14),
        location: 'PDA Metro Manila Office',
        status: 'cancelled',
        maxParticipants: 20,
        creditAmount: 8,
        createdBy: presidentPersonId,
      } as any).returning({ id: trainings.id });

      // 1 cancelled enrollment (dropped)
      if (cancelledTraining) {
        await db.insert(trainingEnrollments).values({
          organizationId: orgId,
          trainingId: cancelledTraining.id,
          personId: memberPersonIds[0]!,
          status: 'cancelled',
          enrolledAt: daysAgo(21),
        } as any);
      }
      console.log('    ✓ 1 cancelled training + 1 cancelled enrollment');
    }
  } catch (e) {
    console.log(`    (cancelled training failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Notification: failed + expired states ──
  try {
    const notifStates = [
      { type: 'system.alert', status: 'failed', title: 'Failed delivery test', body: 'This notification failed to deliver via push.' },
      { type: 'system.alert', status: 'expired', title: 'Expired notification test', body: 'This notification expired before delivery.' },
    ];
    for (const n of notifStates) {
      const existing = await db.execute(sql`SELECT id FROM notification WHERE title = ${n.title} LIMIT 1`);
      if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
        await db.insert(notifications).values({
          organizationId: orgId,
          recipient: memberPersonIds[0]!,
          type: n.type,
          channel: 'push',
          status: n.status,
          title: n.title,
          body: n.body,
        } as any);
      }
    }
    console.log('    ✓ 2 notification state-coverage records (failed, expired)');
  } catch (e) {
    console.log(`    (notification state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Announcement: scheduledFailed state ──
  try {
    const existing = await db.execute(sql`SELECT id FROM announcement WHERE status = 'scheduledFailed' LIMIT 1`);
    if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
      await db.insert(announcements).values({
        organizationId: orgId,
        authorId: presidentPersonId,
        title: 'System Maintenance Notice (Failed to Send)',
        content: '<p>Scheduled announcement that failed to deliver.</p>',
        audienceType: 'all',
        visibility: 'internal',
        status: 'scheduledFailed',
      } as any);
      console.log('    ✓ 1 scheduledFailed announcement');
    }
  } catch (e) {
    console.log(`    (announcement state coverage failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  // ─── Dues Payment Status History (audit trail for state-coverage payments) ──
  try {
    const statePayments = await db.execute(sql`
      SELECT id, person_id, status FROM dues_payment
      WHERE receipt_number LIKE 'STATE-%'
      LIMIT 7
    `);
    const rows = (statePayments as any).rows ?? statePayments;
    if (rows.length > 0) {
      const existingHistory = await db.select().from(duesPaymentStatusHistory).limit(1);
      if (existingHistory.length === 0) {
        for (const p of rows) {
          await db.insert(duesPaymentStatusHistory).values({
            organizationId: orgId,
            paymentId: p.id,
            personId: p.person_id,
            fromStatus: 'pending',
            toStatus: p.status,
            reason: `State coverage seed — ${p.status}`,
            changedBy: presidentPersonId,
          } as any);
        }
        console.log(`    ✓ ${rows.length} payment status history records`);
      }
    }
  } catch (e) {
    console.log(`    (payment status history failed: ${(e as Error).message?.slice(0, 100)})`);
  }

  console.log('  State coverage complete.');
}
