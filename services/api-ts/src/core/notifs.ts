/**
 * Notification Service Interface
 * Provides a thin abstraction layer for module integration.
 * Depends on an injected NotifRepo — no direct handler imports.
 */

import type { Logger } from '@/types/logger';
import type { WebSocketService } from '@/core/ws';

/**
 * OneSignal configuration
 */
export interface OneSignalConfig {
  appId: string;
  apiKey: string;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  provider: 'onesignal';
  onesignal?: OneSignalConfig;
}

/** Minimal shape for notifications flowing through the service. */
export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntity: string | null;
  createdAt: Date;
  [key: string]: unknown;
}

/** Request payload for creating a notification (public API). */
export interface CreateNotificationRequest {
  organizationId: string;
  recipient: string;
  type: 'billing' | 'security' | 'system' | 'booking.created' | 'booking.confirmed' | 'booking.rejected' | 'booking.cancelled' | 'booking.no-show-client' | 'booking.no-show-host' | 'comms.video-call-started' | 'comms.video-call-joined' | 'comms.video-call-left' | 'comms.video-call-ended' | 'comms.chat-message' | 'waitlist.promoted' | 'event.late-cancellation' | 'dunning.escalation' | 'task.overdue';
  channel: 'email' | 'push' | 'in-app';
  title: string;
  message: string;
  scheduledAt?: Date;
  relatedEntityType?: string;
  relatedEntity?: string;
  consentValidated?: boolean;
  targetApp?: string;
}

/** Extended request for internal module use. */
export interface InternalNotificationRequest {
  organizationId?: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  scheduledAt?: Date;
  relatedEntityType?: string;
  relatedEntity?: string;
  consentValidated?: boolean;
  targetApp?: string;
  data?: Record<string, unknown>;
  channels?: Array<'email' | 'push' | 'in-app' | 'sms'>;
  channel?: 'email' | 'push' | 'in-app';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Repo contract the notification service delegates to.
 * Implemented by NotificationRepository in handlers/notifs/repos/.
 */
export interface NotifRepo {
  createNotificationForModule(request: CreateNotificationRequest | InternalNotificationRequest): Promise<NotificationEntry>;
  processScheduledNotifications(): Promise<void>;
  getUnreadCount(recipientId: string): Promise<number>;
  cleanupExpiredNotifications(daysOld?: number): Promise<number>;
}

/**
 * Minimal notification service interface
 * Exposes only the essential features needed by other modules
 */
export interface NotificationService {
  createNotification(request: CreateNotificationRequest | InternalNotificationRequest): Promise<NotificationEntry>;
  processScheduledNotifications(): Promise<void>;
  getUnreadCount(recipientId: string): Promise<number>;
  cleanupExpiredNotifications(daysOld?: number): Promise<number>;
}

/**
 * NotificationService implementation — delegates to injected NotifRepo
 * Adds real-time WebSocket push on top of repo persistence.
 */
class NotificationServiceImpl implements NotificationService {
  constructor(
    private repo: NotifRepo,
    private ws: WebSocketService,
    private logger: Logger,
  ) {
    this.processScheduledNotifications = this.repo.processScheduledNotifications.bind(this.repo);
    this.getUnreadCount = this.repo.getUnreadCount.bind(this.repo);
    this.cleanupExpiredNotifications = this.repo.cleanupExpiredNotifications.bind(this.repo);
  }

  async createNotification(request: CreateNotificationRequest | InternalNotificationRequest): Promise<NotificationEntry> {
    const notification = await this.repo.createNotificationForModule(request);

    // Send real-time notification to user's WebSocket connection
    const sent = await this.ws.publishToUser(request.recipient, 'notification.new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedEntityType: notification.relatedEntityType,
      relatedEntity: notification.relatedEntity,
      createdAt: notification.createdAt,
    });

    if (sent) {
      this.logger.debug({ recipientId: request.recipient, notificationId: notification.id }, 'Real-time notification sent');
    }

    return notification;
  }

  processScheduledNotifications: NotificationService['processScheduledNotifications'];
  getUnreadCount: NotificationService['getUnreadCount'];
  cleanupExpiredNotifications: NotificationService['cleanupExpiredNotifications'];
}

/**
 * Create a notification service instance from an injected repo
 */
export function createNotificationService(
  repo: NotifRepo,
  ws: WebSocketService,
  logger: Logger,
): NotificationService {
  return new NotificationServiceImpl(repo, ws, logger);
}