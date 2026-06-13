/**
 * NotificationRepository - Data access and business logic for notifications
 * Handles all notification operations including creation, delivery, and status management
 */

import { eq, and, or, gte, lte, inArray, isNull, desc, count, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions, type PaginatedResult } from '@/core/database.repo';
import {
  notifications,
  type Notification,
  type NewNotification,
  type NotificationFilters,
  type CreateNotificationRequest,
  type InternalNotificationRequest
} from './notification.schema';
import type { PersonRepository } from '../../person/repos/person.repo';
import { ValidationError, NotFoundError, ForbiddenError, ExternalServiceError } from '@/core/errors';
import * as OneSignal from '@onesignal/node-onesignal';
import { SYSTEM_USER_ID } from '@/core/constants';
import { subDays } from 'date-fns';
import { resolveNotificationCategory } from './notification-category';
import type { NotificationPreferencePort } from '@/core/ports/notification-preference.port';

/**
 * Shape returned by createNotificationForModule when a notification is
 * suppressed by preference enforcement (FIX-004 / G4). It is a synthetic,
 * NON-persisted Notification-shaped object: no DB row is created, the send is
 * skipped. `suppressed: true` flags the skip; `id: ''` keeps the historically
 * non-null return contract so callers reading `.id` (e.g. dues reminder logs)
 * do not crash. In-app is never suppressed, so this only ever stands in for a
 * skipped email/push.
 */
type SuppressedNotification = Notification & { suppressed: true };

/** Typed shape of the global app singleton used by the email service bridge. */
interface AppGlobal {
  app?: {
    email?: {
      queueEmail: (opts: Record<string, unknown>) => Promise<void>;
    };
  };
}

export class NotificationRepository extends DatabaseRepository<Notification, NewNotification, NotificationFilters> {
  private personRepo: PersonRepository;
  private oneSignalClient?: OneSignal.DefaultApi;
  private oneSignalAppId?: string;
  /**
   * FIX-004 / G4 — preference store reader. Injected (defaults to the
   * production communication-owned adapter, resolved lazily) and overridable
   * in tests. The notifs module never imports communication repos directly;
   * the read crosses the boundary through this port.
   */
  private preferencePort?: NotificationPreferencePort;

  constructor(
    db: DatabaseInstance,
    personRepo: PersonRepository,
    logger?: any,
    oneSignalConfig?: { appId: string; apiKey: string },
    preferencePort?: NotificationPreferencePort,
  ) {
    super(db, notifications, logger);
    this.personRepo = personRepo;
    this.preferencePort = preferencePort;

    // Initialize OneSignal if config provided
    if (oneSignalConfig) {
      const configuration = OneSignal.createConfiguration({
        restApiKey: oneSignalConfig.apiKey
      });
      this.oneSignalClient = new OneSignal.DefaultApi(configuration);
      this.oneSignalAppId = oneSignalConfig.appId;
    }
  }

  /**
   * Resolve the preference port. Uses the injected port when present;
   * otherwise lazily constructs the production adapter against this repo's db.
   * Kept as a protected method so it is overridable/spyable in tests.
   */
  protected async getPreferencePort(): Promise<NotificationPreferencePort> {
    if (this.preferencePort) return this.preferencePort;
    const { getNotificationPreferencePort } = await import('@/core/ports');
    this.preferencePort = await getNotificationPreferencePort(this.db, this.logger);
    return this.preferencePort;
  }

  /**
   * Build where conditions for notification-specific filtering
   */
  protected buildWhereConditions(filters?: NotificationFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(notifications.organizationId, filters.organizationId));
    }

    if (filters.recipient) {
      conditions.push(eq(notifications.recipient, filters.recipient));
    }

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type as Notification['type']));
    }

    // Auto-filter to in-app notifications if no channel specified
    if (!filters.channel) {
      conditions.push(eq(notifications.channel, 'in-app'));
    } else {
      conditions.push(eq(notifications.channel, filters.channel as Notification['channel']));
    }

    // Handle special 'unread' status value
    if (filters.status === 'unread') {
      // 'unread' maps to sent or delivered (not yet read)
      conditions.push(
        inArray(notifications.status, ['sent', 'delivered'])
      );
    } else if (filters.status) {
      conditions.push(eq(notifications.status, filters.status as Notification['status']));
    }
    
    if (filters.startDate) {
      conditions.push(gte(notifications.createdAt, filters.startDate));
    }
    
    if (filters.endDate) {
      conditions.push(lte(notifications.createdAt, filters.endDate));
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Create a notification for module integration
   * This is the primary method other modules will use to create notifications
   */
  async createNotificationForModule(request: CreateNotificationRequest | InternalNotificationRequest): Promise<Notification> {
    this.logger?.debug({ request }, 'Creating notification from module');

    // FIX-012: organizationId is a notNull uuid column. Reject a missing/empty
    // value here with a caller-visible ValidationError instead of letting the
    // old `|| ''` fallback hit a Postgres uuid cast error at insert time.
    const organizationId = request.organizationId;
    if (!organizationId || organizationId.trim() === '') {
      throw new ValidationError('organizationId is required to create a notification');
    }

    // Validate recipient exists (optional - Person records may not exist for all User IDs)
    const recipient = await this.personRepo.findOneById(request.recipient);

    if (!recipient) {
      // Log warning but allow notification creation
      // In production, Person records should be created via Better-Auth hooks
      this.logger?.warn({
        recipient: request.recipient,
        type: request.type
      }, 'Creating notification for recipient without Person record');
    }

    // Validate consent for medical notifications
    if (this.isMedicalNotification(request.type) && !request.consentValidated) {
      // In a real implementation, we would check Person consent fields here
      // For now, we'll log a warning
      this.logger?.warn({
        type: request.type,
        recipient: request.recipient
      }, 'Medical notification created without explicit consent validation');
    }

    // Resolve the effective delivery channel up-front (single `channel`, then
    // first of `channels[]`, then default 'in-app'). Needed both for the
    // preference gate below and for the persisted row.
    const resolvedChannel = (request.channel
      || ('channels' in request ? (request as InternalNotificationRequest).channels?.[0] : undefined)
      || 'in-app') as Notification['channel'];

    // FIX-004 / G4 — per-category preference enforcement at delivery.
    //  • in-app is NEVER suppressed (it is the in-app inbox).
    //  • email / push are skipped when the recipient EXPLICITLY disabled the
    //    category this notification belongs to (opt-out / fail-open: only an
    //    explicit `enabled = false` person_subscription suppresses).
    if (resolvedChannel === 'email' || resolvedChannel === 'push') {
      const category = resolveNotificationCategory(request.type);
      if (category) {
        const port = await this.getPreferencePort();
        const enabled = await port.isCategoryEnabledForPerson(
          request.recipient,
          organizationId,
          category,
        );
        if (!enabled) {
          this.logger?.info({
            recipient: request.recipient,
            type: request.type,
            channel: resolvedChannel,
            category,
          }, 'Notification suppressed: recipient disabled this category (FIX-004)');
          // Skip: do NOT create any row, do NOT send. Return a synthetic,
          // non-persisted marker so callers reading `.id` stay safe.
          return {
            id: '',
            organizationId,
            recipient: request.recipient,
            type: request.type as Notification['type'],
            channel: resolvedChannel,
            title: request.title,
            message: request.message,
            status: 'failed',
            suppressed: true,
          } as unknown as SuppressedNotification;
        }
      }
    }

    // Determine final status and sentAt based on scheduling and channel
    // This allows us to create the notification with its final state in a single operation
    const isImmediate = !request.scheduledAt || request.scheduledAt <= new Date();
    const isInApp = resolvedChannel === 'in-app';

    // For immediate in-app notifications, create with 'sent' status directly
    // For scheduled or non-in-app notifications, create with 'queued' status
    const finalStatus = (isImmediate && isInApp) ? 'sent' : 'queued';
    const sentAt = (isImmediate && isInApp) ? new Date() : null;

    // Create notification record with final status in single operation
    const notification = await this.createOne({
      organizationId,
      recipient: request.recipient,
      type: request.type as Notification['type'],
      channel: resolvedChannel,
      title: request.title,
      message: request.message,
      scheduledAt: request.scheduledAt || null,
      relatedEntityType: request.relatedEntityType || null,
      relatedEntity: request.relatedEntity || null,
      status: finalStatus,
      sentAt: sentAt,
      consentValidated: request.consentValidated || false,
      createdBy: SYSTEM_USER_ID, // Module-created notifications are system-generated
      updatedBy: SYSTEM_USER_ID,
      // Store targetApp for later use when sending push notifications
      ...(request.targetApp && {
        data: { targetApp: request.targetApp }
      } as Record<string, unknown>),
    });

    this.logger?.info({
      notificationId: notification.id,
      type: notification.type,
      channel: notification.channel,
      status: notification.status,
      scheduled: !!notification.scheduledAt
    }, 'Notification created successfully');

    return notification;
  }

  /**
   * Find notifications for a specific recipient with pagination
   */
  async findManyByRecipient(
    recipientId: string,
    filters?: Omit<NotificationFilters, 'recipient'>,
    options?: { pagination?: PaginationOptions }
  ): Promise<PaginatedResult<Notification>> {
    this.logger?.debug({ recipientId, filters, options }, 'Finding notifications for recipient');
    
    // Merge recipient filter with other filters
    const mergedFilters = {
      ...filters,
      recipient: recipientId
    };
    
    return this.findManyWithPagination(mergedFilters, options);
  }

  /**
   * Find a single notification by ID with ownership check
   */
  async findOneByIdAndRecipient(notificationId: string, recipientId: string): Promise<Notification | null> {
    this.logger?.debug({ notificationId, recipientId }, 'Finding notification with ownership check');

    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipient, recipientId)
        )
      )
      .limit(1);

    return notification || null;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, recipientId: string): Promise<Notification> {
    this.logger?.debug({ notificationId, recipientId }, 'Marking notification as read');

    // Verify ownership
    const notification = await this.findOneByIdAndRecipient(notificationId, recipientId);

    if (!notification) {
      throw new NotFoundError('Notification not found', {
        resourceType: 'notification',
        resource: notificationId,
        suggestions: ['Check notification ID format', 'Verify notification exists']
      });
    }

    // Idempotent: only update if not already read
    if (notification.status === 'read') {
      this.logger?.debug({ notificationId }, 'Notification already marked as read');
      return notification;
    }

    // Update read status
    const updated = await this.updateOneById(notificationId, {
      status: 'read',
      readAt: new Date(),
      updatedBy: recipientId
    });

    this.logger?.info({ notificationId }, 'Notification marked as read');

    return updated;
  }

  /**
   * Mark all notifications as read for a recipient
   */
  async markAllAsRead(recipientId: string, type?: string): Promise<number> {
    this.logger?.debug({ recipientId, type }, 'Marking all notifications as read');

    const conditions = [
      eq(notifications.recipient, recipientId),
      // Only mark sent/delivered notifications (exclude queued/scheduled ones)
      inArray(notifications.status, ['sent', 'delivered'])
    ];

    if (type) {
      conditions.push(eq(notifications.type, type as Notification['type']));
    }
    
    const result = await this.db
      .update(notifications)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
        updatedBy: recipientId
      })
      .where(and(...conditions));
    
    const count = result.rowCount || 0;
    
    this.logger?.info({ recipientId, type, count }, 'Notifications marked as read');
    
    return count;
  }

  /**
   * Get count of unread notifications for a recipient
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    this.logger?.debug({ recipientId }, 'Getting unread notification count');
    
    const [result] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipient, recipientId),
          inArray(notifications.status, ['sent', 'delivered'])
        )
      );

    return result?.count ?? 0;
  }

  /**
   * Process scheduled notifications (called by background job)
   */
  async processScheduledNotifications(): Promise<void> {
    this.logger?.debug('Processing scheduled notifications');
    
    const now = new Date();
    
    // Find due notifications
    const dueNotifications = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.status, 'queued'),
          lte(notifications.scheduledAt, now)
        )
      )
      .limit(100); // Process in batches
    
    this.logger?.info({ count: dueNotifications.length }, 'Found due notifications');
    
    // Process each notification
    for (const notification of dueNotifications) {
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        this.logger?.error({ 
          error, 
          notificationId: notification.id 
        }, 'Failed to deliver notification');
        
        // Update status to failed
        await this.updateOneById(notification.id, {
          status: 'failed',
          updatedAt: new Date()
        });
      }
    }
  }

  /**
   * Deliver a notification based on its channel
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    this.logger?.debug({ 
      notificationId: notification.id,
      channel: notification.channel 
    }, 'Delivering notification');
    
    // Update status to sent
    await this.updateOneById(notification.id, {
      status: 'sent',
      sentAt: new Date(),
      updatedAt: new Date()
    });
    
    switch (notification.channel) {
      case 'email': {
        // Use email service to queue the email
        const emailService = (globalThis as unknown as AppGlobal).app?.email;
        if (emailService) {
          // Map notification type to email template tag
          const templateTag = this.mapNotificationToEmailTemplate(notification.type);
          
          if (templateTag) {
            // Get recipient email from person repository
            const person = await this.personRepo.findOneById(notification.recipient);
            
            if (person && (person as Record<string, unknown>)['email']) {
              await emailService.queueEmail({
                templateTags: [templateTag],
                recipient: (person as Record<string, unknown>)['email'],
                variables: {
                  title: notification.title,
                  message: notification.message,
                  // Additional context could be added based on notification type
                },
                metadata: {
                  notificationId: notification.id,
                  relatedEntity: notification.relatedEntity
                }
              });
              
              this.logger?.info({ notificationId: notification.id }, 'Email queued for delivery');
            } else {
              this.logger?.warn({ notificationId: notification.id }, 'No email address found for recipient');
            }
          }
        } else {
          this.logger?.warn({ notificationId: notification.id }, 'Email service not available');
        }
        
        // Mark as delivered (email is queued separately)
        await this.updateOneById(notification.id, { status: 'delivered' });
        break;
      }

      case 'push':
        // Send push notification via OneSignal
        if (this.oneSignalClient && this.oneSignalAppId) {
          try {
            // Create OneSignal notification
            const oneSignalNotification = new OneSignal.Notification();
            oneSignalNotification.app_id = this.oneSignalAppId;

            // Set content
            oneSignalNotification.headings = { en: notification.title };
            oneSignalNotification.contents = { en: notification.message };

            // Set targeting - use external_id for user targeting
            oneSignalNotification.include_aliases = {
              external_id: [notification.recipient]
            };

            // Optional: Filter by app tag if targetApp is specified
            const targetApp = (notification as Record<string, unknown>)['data'] ? ((notification as Record<string, unknown>)['data'] as Record<string, unknown>)['targetApp'] as string | undefined : undefined;
            if (targetApp) {
              oneSignalNotification.filters = [
                { field: 'tag', key: 'app', relation: '=', value: targetApp }
              ];
              this.logger?.debug({
                notificationId: notification.id,
                targetApp
              }, 'Filtering push notification by app tag');
            }

            // Set data payload
            oneSignalNotification.data = {
              notificationId: notification.id,
              type: notification.type,
              relatedEntity: notification.relatedEntity || ''
            };

            // Set priority based on notification type
            if (this.isMedicalNotification(notification.type)) {
              oneSignalNotification.priority = 10; // High priority
            }

            // Send the notification
            const result = await this.oneSignalClient.createNotification(oneSignalNotification);

            if (result && result.id) {
              this.logger?.info({
                notificationId: notification.id,
                oneSignalId: result.id,
                recipients: (result as Record<string, unknown>)['recipients']
              }, 'Push notification sent via OneSignal');

              // CR-03 fix: notifications schema has no metadata/deliveredAt columns.
              // Log the OneSignal ID via the logger; only update columns that exist in the schema.
              this.logger?.info({ notificationId: notification.id, oneSignalId: result.id }, 'OneSignal ID recorded');
              await this.updateOneById(notification.id, {
                status: 'delivered',
                sentAt: new Date(),
              });
            } else {
              this.logger?.warn({
                notificationId: notification.id,
                result
              }, 'OneSignal notification created but no ID returned');

              await this.updateOneById(notification.id, { status: 'failed' });
            }
          } catch (error) {
            this.logger?.error({
              error,
              notificationId: notification.id
            }, 'Failed to send push notification via OneSignal');

            await this.updateOneById(notification.id, { status: 'failed' });
          }
        } else {
          // No OneSignal configured
          throw new ExternalServiceError('OneSignal not configured, marking notification as failed', 'OneSignal');
        }
        break;
        
      case 'in-app':
        // In-app notifications are already available in database
        // Just update status to indicate they're ready
        await this.updateOneById(notification.id, { status: 'delivered' });
        this.logger?.info({ notificationId: notification.id }, 'In-app notification delivered');
        break;
        
      default:
        this.logger?.error({ 
          notificationId: notification.id,
          channel: notification.channel 
        }, 'Unknown notification channel');
        throw new ValidationError(`Unknown notification channel: ${notification.channel}`);
    }
  }

  /**
   * Check if a notification type requires medical consent
   */
  private isMedicalNotification(type: string): boolean {
    return false; // No medical notifications in current system
  }
  
  /**
   * Map notification type to email template tag
   */
  private mapNotificationToEmailTemplate(type: string): string | null {
    const mapping: Record<string, string> = {
      'security': 'auth.password-reset',
      'system': 'auth.welcome',
      'waitlist.promoted': 'events.waitlist-promoted',
      'event.late-cancellation': 'events.late-cancellation',
      'dunning.escalation': 'dues.dunning-escalation',
      'task.overdue': 'governance.task-overdue',
    };
    
    return mapping[type] || null;
  }

  /**
   * Clean up expired notifications (maintenance task)
   */
  async cleanupExpiredNotifications(daysOld: number = 90): Promise<number> {
    this.logger?.debug({ daysOld }, 'Cleaning up expired notifications');

    const cutoffDate = subDays(new Date(), daysOld);
    
    const result = await this.db
      .delete(notifications)
      .where(
        lte(notifications.createdAt, cutoffDate)
      );
    
    const count = result.rowCount || 0;
    
    this.logger?.info({ count, daysOld }, 'Expired notifications cleaned up');
    
    return count;
  }
}
