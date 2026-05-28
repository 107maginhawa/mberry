/**
 * Schema Registry — centralizes table references used by core/ modules.
 *
 * Domain event consumers, cron jobs, and other core infrastructure need
 * access to handler-owned schema tables for cross-module queries. Rather
 * than scattering handler imports throughout core/, this registry provides
 * a single import point.
 *
 * Add tables here when core/ code needs to query them directly.
 */

// Notifications
export { notifications } from '@/handlers/notifs/repos/notification.schema';

// Booking
export { bookings } from '@/handlers/booking/repos/booking.schema';

// Platform admin
export { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';

// Training
export { trainingEnrollments, trainings } from '@/handlers/association:operations/repos/training.schema';

// Membership
export { memberships } from '@/handlers/association:member/repos/membership.schema';

// Governance
export { positions } from '@/handlers/association:member/repos/governance.schema';

// Events
export { events, eventRegistrations } from '@/handlers/association:operations/repos/events.schema';

// Invitations
export { invitationTokens } from '@/handlers/invite/repos/invite.schema';
