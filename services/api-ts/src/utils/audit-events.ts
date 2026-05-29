/**
 * Typed audit event categories and sub-types.
 * Maps handler actions to specific, searchable event classifications.
 */

export const AUDIT_EVENT_CATEGORIES = {
  financial: [
    'payment-recorded',
    'payment-reversed',
    'invoice-created',
    'invoice-voided',
    'dues-collected',
    'fund-transfer',
  ],
  governance: [
    'vote-cast',
    'election-created',
    'election-closed',
    'nomination-submitted',
    'officer-appointed',
    'officer-resigned',
  ],
  membership: [
    'member-approved',
    'member-denied',
    'member-renewed',
    'member-suspended',
    'member-reinstated',
    'member-terminated',
    'member-deceased',
    'application-submitted',
  ],
  content: [
    'certificate-generated',
    'document-uploaded',
    'document-deleted',
    'announcement-published',
    'announcement-archived',
  ],
  authentication: [
    'session-created',
    'session-terminated',
    'impersonation-started',
    'impersonation-ended',
    'password-changed',
    'mfa-enabled',
    'mfa-disabled',
  ],
  training: [
    'training-created',
    'training-completed',
    'credit-awarded',
    'enrollment-created',
    'enrollment-cancelled',
  ],
  communication: [
    'email-sent',
    'notification-sent',
    'template-updated',
  ],
  association: [
    'committee-created',
    'committee-dissolved',
    'booking-created',
    'booking-cancelled',
    'event-created',
    'event-cancelled',
    'event-completed',
  ],
  data: [
    'pii-accessed',
    'bulk-export',
    'document-accessed',
    'credential-verified',
  ],
} as const;

export type AuditCategory = keyof typeof AUDIT_EVENT_CATEGORIES;
export type AuditSubType<C extends AuditCategory> = (typeof AUDIT_EVENT_CATEGORIES)[C][number];
export type AuditEventSubType = AuditSubType<AuditCategory>;

/** Helper to construct a typed event sub-type string */
export function typedEventSubType<C extends AuditCategory>(
  category: C,
  subType: AuditSubType<C>,
): string {
  return `${category}.${subType}`;
}
