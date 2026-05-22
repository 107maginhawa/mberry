/**
 * Valid state transitions for booking events, email queue, and feed posts.
 */

// Booking event status (bookingEventStatusEnum: draft, active, paused, archived)
export const BOOKING_EVENT_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],  // terminal
};

// Email queue status (emailQueueStatusEnum: pending, processing, sent, failed, cancelled)
export const EMAIL_QUEUE_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['sent', 'failed'],
  sent: [],      // terminal
  failed: ['pending'],  // retry
  cancelled: [],  // terminal
};

// Feed post status (feedPostStatusEnum: published, draft, flagged, removed)
export const FEED_POST_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['flagged', 'removed'],
  flagged: ['published', 'removed'],  // officer can restore or remove
  removed: [],   // terminal
};

export function isValidTransition(
  transitions: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}
