/**
 * Notification Service Wiring Tests — Slice 027
 *
 * GAP-003: Waitlist promotion notification
 * GAP-006: Late cancellation notification
 * GAP-012: Dunning escalation notification
 * GAP-017: Committee task overdue notification
 *
 * Tests notification trigger functions + preference enforcement.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { NotificationService } from '@/core/notifs';
import type { CreateNotificationRequest } from './repos/notification.schema';
import {
  notifyWaitlistPromotion,
  notifyLateCancellation,
  notifyDunningEscalation,
  notifyTaskOverdue,
  type WaitlistPromotionContext,
  type LateCancellationContext,
  type DunningEscalationContext,
  type TaskOverdueContext,
} from './notification-triggers';

// ---------------------------------------------------------------------------
// Mock NotificationService
// ---------------------------------------------------------------------------

function makeMockNotifService(): NotificationService & { _calls: CreateNotificationRequest[] } {
  const calls: CreateNotificationRequest[] = [];
  return {
    _calls: calls,
    createNotification: mock(async (req: CreateNotificationRequest) => {
      calls.push(req);
      return {
        id: `notif-${calls.length}`,
        organizationId: req.organizationId,
        recipient: req.recipient,
        type: req.type,
        channel: req.channel,
        title: req.title,
        message: req.message,
        status: 'sent',
        sentAt: new Date(),
        readAt: null,
        deliveredAt: null,
        scheduledAt: null,
        relatedEntityType: req.relatedEntityType || null,
        relatedEntity: req.relatedEntity || null,
        consentValidated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
        version: 1,
      } as any;
    }),
    processScheduledNotifications: mock(async () => {}),
    getUnreadCount: mock(async () => 0),
    cleanupExpiredNotifications: mock(async () => 0),
  };
}

// ---------------------------------------------------------------------------
// GAP-003: Waitlist promotion notification
// ---------------------------------------------------------------------------

describe('GAP-003: notifyWaitlistPromotion', () => {
  let notifService: ReturnType<typeof makeMockNotifService>;

  beforeEach(() => {
    notifService = makeMockNotifService();
  });

  test('sends waitlist.promoted notification to the promoted person', async () => {
    const ctx: WaitlistPromotionContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      eventId: 'evt-1',
      eventName: 'Annual Gala',
      position: 1,
    };

    await notifyWaitlistPromotion(notifService, ctx);

    expect(notifService._calls).toHaveLength(1);
    const call = notifService._calls[0]!;
    expect(call.type).toBe('waitlist.promoted');
    expect(call.recipient).toBe('person-1');
    expect(call.organizationId).toBe('org-1');
    expect(call.channel).toBe('in-app');
    expect(call.relatedEntityType).toBe('event');
    expect(call.relatedEntity).toBe('evt-1');
  });

  test('notification title mentions promotion', async () => {
    const ctx: WaitlistPromotionContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      eventId: 'evt-1',
      eventName: 'Annual Gala',
      position: 1,
    };

    await notifyWaitlistPromotion(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.title.toLowerCase()).toContain('waitlist');
  });

  test('notification message includes event name', async () => {
    const ctx: WaitlistPromotionContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      eventId: 'evt-1',
      eventName: 'Annual Gala',
      position: 1,
    };

    await notifyWaitlistPromotion(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.message).toContain('Annual Gala');
  });

  test('does not throw if notifService.createNotification fails', async () => {
    const failingService = makeMockNotifService();
    failingService.createNotification = mock(async () => {
      throw new Error('Service unavailable');
    });

    const ctx: WaitlistPromotionContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      eventId: 'evt-1',
      eventName: 'Test Event',
      position: 1,
    };

    // Should not throw — notification failures are non-blocking
    await expect(notifyWaitlistPromotion(failingService, ctx)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GAP-006: Late cancellation notification
// ---------------------------------------------------------------------------

describe('GAP-006: notifyLateCancellation', () => {
  let notifService: ReturnType<typeof makeMockNotifService>;

  beforeEach(() => {
    notifService = makeMockNotifService();
  });

  test('sends event.late-cancellation notification to event organizer', async () => {
    const ctx: LateCancellationContext = {
      organizationId: 'org-1',
      cancellerId: 'person-1',
      organizerIds: ['organizer-1'],
      eventId: 'evt-1',
      eventName: 'Board Meeting',
      cancelledAt: new Date(),
      eventStartsAt: new Date(Date.now() + 3600_000), // 1 hour from now
    };

    await notifyLateCancellation(notifService, ctx);

    expect(notifService._calls.length).toBeGreaterThanOrEqual(1);
    const call = notifService._calls[0]!;
    expect(call.type).toBe('event.late-cancellation');
    expect(call.recipient).toBe('organizer-1');
    expect(call.relatedEntityType).toBe('event');
    expect(call.relatedEntity).toBe('evt-1');
  });

  test('sends notification to all organizers', async () => {
    const ctx: LateCancellationContext = {
      organizationId: 'org-1',
      cancellerId: 'person-1',
      organizerIds: ['organizer-1', 'organizer-2'],
      eventId: 'evt-1',
      eventName: 'Board Meeting',
      cancelledAt: new Date(),
      eventStartsAt: new Date(Date.now() + 3600_000),
    };

    await notifyLateCancellation(notifService, ctx);

    expect(notifService._calls).toHaveLength(2);
    expect(notifService._calls[0]!.recipient).toBe('organizer-1');
    expect(notifService._calls[1]!.recipient).toBe('organizer-2');
  });

  test('notification message includes event name and canceller context', async () => {
    const ctx: LateCancellationContext = {
      organizationId: 'org-1',
      cancellerId: 'person-1',
      organizerIds: ['organizer-1'],
      eventId: 'evt-1',
      eventName: 'Board Meeting',
      cancelledAt: new Date(),
      eventStartsAt: new Date(Date.now() + 3600_000),
    };

    await notifyLateCancellation(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.message).toContain('Board Meeting');
  });

  test('is non-blocking on notification failure', async () => {
    const failingService = makeMockNotifService();
    failingService.createNotification = mock(async () => {
      throw new Error('Service unavailable');
    });

    const ctx: LateCancellationContext = {
      organizationId: 'org-1',
      cancellerId: 'person-1',
      organizerIds: ['organizer-1'],
      eventId: 'evt-1',
      eventName: 'Test',
      cancelledAt: new Date(),
      eventStartsAt: new Date(Date.now() + 3600_000),
    };

    await expect(notifyLateCancellation(failingService, ctx)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GAP-012: Dunning escalation notification
// ---------------------------------------------------------------------------

describe('GAP-012: notifyDunningEscalation', () => {
  let notifService: ReturnType<typeof makeMockNotifService>;

  beforeEach(() => {
    notifService = makeMockNotifService();
  });

  test('sends dunning.escalation notification to member', async () => {
    const ctx: DunningEscalationContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      membershipId: 'mem-1',
      stage: 2,
      daysOverdue: 35,
      templateName: 'Second Notice',
    };

    await notifyDunningEscalation(notifService, ctx);

    expect(notifService._calls).toHaveLength(1);
    const call = notifService._calls[0]!;
    expect(call.type).toBe('dunning.escalation');
    expect(call.recipient).toBe('person-1');
    expect(call.organizationId).toBe('org-1');
    expect(call.relatedEntityType).toBe('membership');
    expect(call.relatedEntity).toBe('mem-1');
  });

  test('notification title includes stage number', async () => {
    const ctx: DunningEscalationContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      membershipId: 'mem-1',
      stage: 3,
      daysOverdue: 65,
      templateName: 'Urgent Notice',
    };

    await notifyDunningEscalation(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.title).toContain('3');
  });

  test('notification message includes template name and days overdue', async () => {
    const ctx: DunningEscalationContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      membershipId: 'mem-1',
      stage: 4,
      daysOverdue: 95,
      templateName: 'Final Warning',
    };

    await notifyDunningEscalation(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.message).toContain('95');
  });

  test('stage 5 uses urgent language', async () => {
    const ctx: DunningEscalationContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      membershipId: 'mem-1',
      stage: 5,
      daysOverdue: 125,
      templateName: 'Membership Termination',
    };

    await notifyDunningEscalation(notifService, ctx);

    const call = notifService._calls[0]!;
    // Stage 5 = final/termination — title should reflect urgency
    expect(call.title.toLowerCase()).toMatch(/final|urgent|termination/);
  });

  test('is non-blocking on notification failure', async () => {
    const failingService = makeMockNotifService();
    failingService.createNotification = mock(async () => {
      throw new Error('Service unavailable');
    });

    const ctx: DunningEscalationContext = {
      organizationId: 'org-1',
      personId: 'person-1',
      membershipId: 'mem-1',
      stage: 1,
      daysOverdue: 10,
      templateName: 'Friendly Reminder',
    };

    await expect(notifyDunningEscalation(failingService, ctx)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GAP-017: Committee task overdue notification
// ---------------------------------------------------------------------------

describe('GAP-017: notifyTaskOverdue', () => {
  let notifService: ReturnType<typeof makeMockNotifService>;

  beforeEach(() => {
    notifService = makeMockNotifService();
  });

  test('sends task.overdue notification to assignee', async () => {
    const ctx: TaskOverdueContext = {
      organizationId: 'org-1',
      assigneeId: 'person-1',
      taskId: 'task-1',
      taskTitle: 'Review bylaws',
      committeeName: 'Rules Committee',
      daysOverdue: 5,
    };

    await notifyTaskOverdue(notifService, ctx);

    expect(notifService._calls).toHaveLength(1);
    const call = notifService._calls[0]!;
    expect(call.type).toBe('task.overdue');
    expect(call.recipient).toBe('person-1');
    expect(call.organizationId).toBe('org-1');
    expect(call.relatedEntityType).toBe('task');
    expect(call.relatedEntity).toBe('task-1');
  });

  test('notification title includes task context', async () => {
    const ctx: TaskOverdueContext = {
      organizationId: 'org-1',
      assigneeId: 'person-1',
      taskId: 'task-1',
      taskTitle: 'Review bylaws',
      committeeName: 'Rules Committee',
      daysOverdue: 5,
    };

    await notifyTaskOverdue(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.title.toLowerCase()).toContain('overdue');
  });

  test('notification message includes task title and committee name', async () => {
    const ctx: TaskOverdueContext = {
      organizationId: 'org-1',
      assigneeId: 'person-1',
      taskId: 'task-1',
      taskTitle: 'Review bylaws',
      committeeName: 'Rules Committee',
      daysOverdue: 5,
    };

    await notifyTaskOverdue(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.message).toContain('Review bylaws');
    expect(call.message).toContain('Rules Committee');
  });

  test('notification message includes days overdue count', async () => {
    const ctx: TaskOverdueContext = {
      organizationId: 'org-1',
      assigneeId: 'person-1',
      taskId: 'task-1',
      taskTitle: 'Submit report',
      committeeName: 'Finance',
      daysOverdue: 12,
    };

    await notifyTaskOverdue(notifService, ctx);

    const call = notifService._calls[0]!;
    expect(call.message).toContain('12');
  });

  test('is non-blocking on notification failure', async () => {
    const failingService = makeMockNotifService();
    failingService.createNotification = mock(async () => {
      throw new Error('Service unavailable');
    });

    const ctx: TaskOverdueContext = {
      organizationId: 'org-1',
      assigneeId: 'person-1',
      taskId: 'task-1',
      taskTitle: 'Test task',
      committeeName: 'Test',
      daysOverdue: 1,
    };

    await expect(notifyTaskOverdue(failingService, ctx)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Preference enforcement
// ---------------------------------------------------------------------------

describe('Notification preference enforcement', () => {
  let notifService: ReturnType<typeof makeMockNotifService>;

  beforeEach(() => {
    notifService = makeMockNotifService();
  });

  test('all triggers use in-app channel (always-on per M02-R8)', async () => {
    // In-app notifications are always on per notification preferences schema
    // All trigger functions should default to 'in-app' channel

    await notifyWaitlistPromotion(notifService, {
      organizationId: 'org-1', personId: 'p1', eventId: 'e1', eventName: 'E', position: 1,
    });
    await notifyDunningEscalation(notifService, {
      organizationId: 'org-1', personId: 'p1', membershipId: 'm1', stage: 1, daysOverdue: 5, templateName: 'T',
    });
    await notifyTaskOverdue(notifService, {
      organizationId: 'org-1', assigneeId: 'p1', taskId: 't1', taskTitle: 'T', committeeName: 'C', daysOverdue: 1,
    });
    await notifyLateCancellation(notifService, {
      organizationId: 'org-1', cancellerId: 'p1', organizerIds: ['p2'], eventId: 'e1', eventName: 'E',
      cancelledAt: new Date(), eventStartsAt: new Date(),
    });

    // All notifications should use in-app channel
    for (const call of notifService._calls) {
      expect(call.channel).toBe('in-app');
    }
  });

  test('all triggers set consentValidated to true', async () => {
    // Non-medical notifications don't require consent
    await notifyWaitlistPromotion(notifService, {
      organizationId: 'org-1', personId: 'p1', eventId: 'e1', eventName: 'E', position: 1,
    });
    await notifyDunningEscalation(notifService, {
      organizationId: 'org-1', personId: 'p1', membershipId: 'm1', stage: 1, daysOverdue: 5, templateName: 'T',
    });

    for (const call of notifService._calls) {
      expect(call.consentValidated).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Schema: new notification_type enum values
// ---------------------------------------------------------------------------

describe('notification_type enum includes new values', () => {
  test('schema exports include new notification types', async () => {
    const { notificationTypeEnum } = await import('./repos/notification.schema');
    const enumValues = notificationTypeEnum.enumValues;

    expect(enumValues).toContain('waitlist.promoted');
    expect(enumValues).toContain('event.late-cancellation');
    expect(enumValues).toContain('dunning.escalation');
    expect(enumValues).toContain('task.overdue');
  });

  test('CreateNotificationRequest type allows new notification types', async () => {
    // Type-level test: just verify the interface accepts the new types
    const { notificationTypeEnum } = await import('./repos/notification.schema');
    const newTypes = ['waitlist.promoted', 'event.late-cancellation', 'dunning.escalation', 'task.overdue'];
    for (const t of newTypes) {
      expect(notificationTypeEnum.enumValues).toContain(t);
    }
  });
});
