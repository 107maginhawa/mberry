/**
 * Schema Registry — centralizes table references used by core/ modules.
 *
 * [INTENTIONAL] This is a ratified architectural inversion.
 * See ARCHITECTURE.md → "Schema Registry Pattern" (ADR-001).
 *
 * Domain event consumers, cron jobs, and other core infrastructure need
 * access to handler-owned schema tables for cross-module queries. Rather
 * than scattering handler imports throughout core/, this registry provides
 * a single, audited import point.
 *
 * Adding a table requires:
 *   1. Adding the re-export below.
 *   2. Adding an entry to the ADR's enumerated module list in ARCHITECTURE.md.
 *   3. Updating `schema-registry.test.ts` (locks the surface set).
 *
 * Sole consumer: `core/domain-event-consumers.ts`. New consumers must be
 * justified by a documented cross-module event or scheduled job — not by
 * convenience.
 */

// Notifications — written by core domain-event consumers (membership lapse, etc.)
export { notifications } from '@/handlers/notifs/repos/notification.schema';

// Booking — queried by audit/event consumers for cross-org rollups.
export { bookings } from '@/handlers/booking/repos/booking.schema';

// Platform admin — required by impersonation + admin-bypass logic in core middleware.
export { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';

// Training — consumed by training-credit domain events.
export { trainingEnrollments, trainings } from '@/handlers/association:operations/repos/training.schema';

// Membership — central to org-context middleware + domain events on lifecycle changes.
export { memberships } from '@/handlers/association:member/repos/membership.schema';

// Governance — election-completed events provision officer terms.
export { positions } from '@/handlers/association:member/repos/governance.schema';

// Events — registration confirmation flow.
export { events, eventRegistrations } from '@/handlers/association:operations/repos/events.schema';

// Invitations — invite-claimed events tie back to person/membership.
export { invitationTokens } from '@/handlers/invite/repos/invite.schema';
