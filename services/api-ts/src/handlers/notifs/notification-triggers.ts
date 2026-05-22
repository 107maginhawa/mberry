/**
 * Notification Trigger Functions — Slice 027
 *
 * Wires notification delivery to modules lacking notifications:
 *   GAP-003: Waitlist promotion
 *   GAP-006: Late cancellation
 *   GAP-012: Dunning escalation
 *   GAP-017: Committee task overdue
 *
 * All triggers are non-blocking (fire-and-forget with error swallowing).
 * All use in-app channel (always-on per M02-R8 notification preferences).
 */

import type { NotificationService } from '@/core/notifs';
import type { CreateNotificationRequest } from './repos/notification.schema';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface WaitlistPromotionContext {
  organizationId: string;
  personId: string;
  eventId: string;
  eventName: string;
  position: number;
}

export interface LateCancellationContext {
  organizationId: string;
  cancellerId: string;
  organizerIds: string[];
  eventId: string;
  eventName: string;
  cancelledAt: Date;
  eventStartsAt: Date;
}

export interface DunningEscalationContext {
  organizationId: string;
  personId: string;
  membershipId: string;
  stage: number;
  daysOverdue: number;
  templateName: string;
}

export interface TaskOverdueContext {
  organizationId: string;
  assigneeId: string;
  taskId: string;
  taskTitle: string;
  committeeName: string;
  daysOverdue: number;
}

// ---------------------------------------------------------------------------
// GAP-003: Waitlist promotion notification
// ---------------------------------------------------------------------------

/**
 * Notify a member that they have been promoted from the waitlist.
 * Non-blocking — swallows errors to avoid breaking the promotion flow.
 */
export async function notifyWaitlistPromotion(
  notifService: NotificationService,
  ctx: WaitlistPromotionContext,
): Promise<void> {
  try {
    await notifService.createNotification({
      organizationId: ctx.organizationId,
      recipient: ctx.personId,
      type: 'waitlist.promoted',
      channel: 'in-app',
      title: 'Waitlist Promotion',
      message: `You have been promoted from the waitlist for "${ctx.eventName}". Your registration is now confirmed.`,
      relatedEntityType: 'event',
      relatedEntity: ctx.eventId,
      consentValidated: true,
    });
  } catch {
    // Non-blocking: notification failure must not break waitlist promotion
  }
}

// ---------------------------------------------------------------------------
// GAP-006: Late cancellation notification
// ---------------------------------------------------------------------------

/**
 * Notify event organizers about a late cancellation.
 * Sends to all organizers. Non-blocking.
 */
export async function notifyLateCancellation(
  notifService: NotificationService,
  ctx: LateCancellationContext,
): Promise<void> {
  try {
    for (const organizerId of ctx.organizerIds) {
      await notifService.createNotification({
        organizationId: ctx.organizationId,
        recipient: organizerId,
        type: 'event.late-cancellation',
        channel: 'in-app',
        title: 'Late Cancellation',
        message: `A registration for "${ctx.eventName}" was cancelled close to the event start time.`,
        relatedEntityType: 'event',
        relatedEntity: ctx.eventId,
        consentValidated: true,
      });
    }
  } catch {
    // Non-blocking: notification failure must not break cancellation flow
  }
}

// ---------------------------------------------------------------------------
// GAP-012: Dunning escalation notification
// ---------------------------------------------------------------------------

/**
 * Notify a member about a dunning escalation.
 * Title reflects urgency based on stage. Non-blocking.
 */
export async function notifyDunningEscalation(
  notifService: NotificationService,
  ctx: DunningEscalationContext,
): Promise<void> {
  try {
    const title = ctx.stage >= 5
      ? `Final Notice — Dues Payment (Stage ${ctx.stage})`
      : `Dues Payment Reminder (Stage ${ctx.stage})`;

    await notifService.createNotification({
      organizationId: ctx.organizationId,
      recipient: ctx.personId,
      type: 'dunning.escalation',
      channel: 'in-app',
      title,
      message: `Your dues payment is ${ctx.daysOverdue} days overdue. ${ctx.templateName}: Please resolve your outstanding balance to maintain your membership.`,
      relatedEntityType: 'membership',
      relatedEntity: ctx.membershipId,
      consentValidated: true,
    });
  } catch {
    // Non-blocking: notification failure must not break dunning flow
  }
}

// ---------------------------------------------------------------------------
// GAP-017: Committee task overdue notification
// ---------------------------------------------------------------------------

/**
 * Notify a task assignee that their committee task is overdue.
 * Non-blocking.
 */
export async function notifyTaskOverdue(
  notifService: NotificationService,
  ctx: TaskOverdueContext,
): Promise<void> {
  try {
    await notifService.createNotification({
      organizationId: ctx.organizationId,
      recipient: ctx.assigneeId,
      type: 'task.overdue',
      channel: 'in-app',
      title: 'Task Overdue',
      message: `Your task "${ctx.taskTitle}" for ${ctx.committeeName} is ${ctx.daysOverdue} day(s) overdue. Please update or complete it.`,
      relatedEntityType: 'task',
      relatedEntity: ctx.taskId,
      consentValidated: true,
    });
  } catch {
    // Non-blocking: notification failure must not break task flow
  }
}
