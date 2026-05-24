/**
 * Cross-Module Communication Triggers — Phase 4
 *
 * Auto-generates communications from other module events:
 *   - Event → auto-announcement + channel post
 *   - Training → notification trigger
 *   - Dues → reminder automation
 *   - Membership → welcome DM flow
 *   - Chapter → default channel auto-creation
 *
 * All triggers are non-blocking (fire-and-forget with error logging).
 * Called from respective module handlers after successful operations.
 */

import type { NotificationService } from '@/core/notifs';
import type { Logger } from 'pino';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface EventCreatedContext {
  organizationId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  venue?: string;
  createdBy: string;
  chapterChannelId?: string;
}

export interface TrainingScheduledContext {
  organizationId: string;
  sessionId: string;
  sessionName: string;
  scheduledDate: string;
  credits: number;
  eligibleMemberIds: string[];
}

export interface CertificateIssuedContext {
  organizationId: string;
  recipient: string;
  certificateId: string;
  courseName: string;
  downloadUrl?: string;
}

export interface DuesReminderContext {
  organizationId: string;
  personId: string;
  invoiceId: string;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
}

export interface MembershipApprovedContext {
  organizationId: string;
  personId: string;
  personName: string;
  chapterId?: string;
  chapterName?: string;
}

export interface ChapterCreatedContext {
  organizationId: string;
  chapterId: string;
  chapterName: string;
  adminPersonIds: string[];
}

export interface PlatformBroadcastContext {
  title: string;
  content: string;
  targetOrgIds?: string[]; // empty = all orgs
  channels: ('push' | 'email' | 'in-app')[];
  sentBy: string;
}

// ---------------------------------------------------------------------------
// Trigger implementations
// ---------------------------------------------------------------------------

export class CrossModuleTriggers {
  constructor(
    private notifService: NotificationService,
    private logger: Logger,
  ) {}

  /**
   * Event created → auto-announcement + channel post
   */
  async onEventCreated(ctx: EventCreatedContext): Promise<void> {
    try {
      this.logger.info({ eventId: ctx.eventId }, 'Cross-module trigger: event created');

      // 1. Create in-app notification for org members
      await this.notifService.createNotification({
        organizationId: ctx.organizationId,
        recipient: '*', // broadcast to org
        type: 'event.created',
        title: `New Event: ${ctx.eventName}`,
        message: `${ctx.eventName} on ${ctx.eventDate}${ctx.venue ? ` at ${ctx.venue}` : ''}`,
        data: { eventId: ctx.eventId },
        channel: 'in-app',
      });

      // 2. Post to chapter channel if available
      if (ctx.chapterChannelId) {
        this.logger.info({ channelId: ctx.chapterChannelId }, 'Posting event to chapter channel');
        // Channel post handled by caller via comms API
      }
    } catch (err) {
      this.logger.error({ err, eventId: ctx.eventId }, 'Failed event→comms trigger');
    }
  }

  /**
   * Training session scheduled → notification to eligible members
   */
  async onTrainingScheduled(ctx: TrainingScheduledContext): Promise<void> {
    try {
      this.logger.info({ sessionId: ctx.sessionId }, 'Cross-module trigger: training scheduled');

      for (const memberId of ctx.eligibleMemberIds) {
        await this.notifService.createNotification({
          organizationId: ctx.organizationId,
          recipient: memberId,
          type: 'training.scheduled',
          title: `Training: ${ctx.sessionName}`,
          message: `${ctx.credits} CPD credits available. Scheduled for ${ctx.scheduledDate}.`,
          data: { sessionId: ctx.sessionId },
          channel: 'push',
        });
      }
    } catch (err) {
      this.logger.error({ err, sessionId: ctx.sessionId }, 'Failed training→comms trigger');
    }
  }

  /**
   * Certificate issued → DM to recipient
   */
  async onCertificateIssued(ctx: CertificateIssuedContext): Promise<void> {
    try {
      this.logger.info({ certificateId: ctx.certificateId }, 'Cross-module trigger: cert issued');

      await this.notifService.createNotification({
        organizationId: ctx.organizationId,
        recipient: ctx.recipient,
        type: 'certificate.issued',
        title: `Certificate Ready: ${ctx.courseName}`,
        message: `Your certificate for ${ctx.courseName} is ready for download.`,
        data: { certificateId: ctx.certificateId, downloadUrl: ctx.downloadUrl },
        channel: 'in-app',
      });
    } catch (err) {
      this.logger.error({ err, certificateId: ctx.certificateId }, 'Failed cert→comms trigger');
    }
  }

  /**
   * Dues overdue → multi-channel reminder
   */
  async onDuesReminder(ctx: DuesReminderContext): Promise<void> {
    try {
      this.logger.info({ invoiceId: ctx.invoiceId, daysOverdue: ctx.daysOverdue }, 'Cross-module trigger: dues reminder');

      const channels: ('push' | 'email' | 'in-app')[] =
        ctx.daysOverdue >= 30 ? ['email', 'push', 'in-app'] :
        ctx.daysOverdue >= 7 ? ['email', 'in-app'] :
        ['in-app'];

      for (const channel of channels) {
        await this.notifService.createNotification({
          organizationId: ctx.organizationId,
          recipient: ctx.personId,
          type: 'dues.reminder',
          title: 'Dues Payment Reminder',
          message: `Your dues of ₱${ctx.amountDue.toLocaleString()} were due on ${ctx.dueDate}. Please settle to maintain good standing.`,
          data: { invoiceId: ctx.invoiceId, daysOverdue: ctx.daysOverdue },
          channel,
        });
      }
    } catch (err) {
      this.logger.error({ err, invoiceId: ctx.invoiceId }, 'Failed dues→comms trigger');
    }
  }

  /**
   * Membership approved → welcome DM + chapter announcement
   */
  async onMembershipApproved(ctx: MembershipApprovedContext): Promise<void> {
    try {
      this.logger.info({ personId: ctx.personId }, 'Cross-module trigger: membership approved');

      // Welcome notification
      await this.notifService.createNotification({
        organizationId: ctx.organizationId,
        recipient: ctx.personId,
        type: 'membership.welcome',
        title: 'Welcome to the Association!',
        message: `Congratulations ${ctx.personName}! Your membership has been approved.${ctx.chapterName ? ` You've been added to ${ctx.chapterName}.` : ''}`,
        data: { chapterId: ctx.chapterId },
        channel: 'in-app',
      });

      // Email welcome
      await this.notifService.createNotification({
        organizationId: ctx.organizationId,
        recipient: ctx.personId,
        type: 'membership.welcome',
        title: 'Welcome to the Association!',
        message: `Welcome ${ctx.personName}! Your membership is now active.`,
        data: {},
        channel: 'email',
      });
    } catch (err) {
      this.logger.error({ err, personId: ctx.personId }, 'Failed membership→comms trigger');
    }
  }

  /**
   * Chapter created → auto-create default channels (#general, #announcements)
   */
  async onChapterCreated(ctx: ChapterCreatedContext): Promise<void> {
    try {
      this.logger.info({ chapterId: ctx.chapterId }, 'Cross-module trigger: chapter created');

      // Default channels are created by the caller via comms repo.
      // This trigger notifies admins that setup is needed.
      for (const adminId of ctx.adminPersonIds) {
        await this.notifService.createNotification({
          organizationId: ctx.organizationId,
          recipient: adminId,
          type: 'chapter.created',
          title: `Chapter Created: ${ctx.chapterName}`,
          message: `Default channels (#general, #announcements) have been created for ${ctx.chapterName}.`,
          data: { chapterId: ctx.chapterId },
          channel: 'in-app',
        });
      }
    } catch (err) {
      this.logger.error({ err, chapterId: ctx.chapterId }, 'Failed chapter→comms trigger');
    }
  }

  /**
   * Platform broadcast → all orgs (admin-initiated)
   */
  async onPlatformBroadcast(ctx: PlatformBroadcastContext): Promise<void> {
    try {
      this.logger.info({ title: ctx.title, targetOrgs: ctx.targetOrgIds?.length ?? 'all' }, 'Cross-module trigger: platform broadcast');

      // Platform broadcasts are handled by the communication module's
      // announcement system — this trigger logs the audit trail.
      // Actual delivery goes through communication/createAnnouncement with
      // platform scope.
    } catch (err) {
      this.logger.error({ err, title: ctx.title }, 'Failed platform broadcast trigger');
    }
  }
}
