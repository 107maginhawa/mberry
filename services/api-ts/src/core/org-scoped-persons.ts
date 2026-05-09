/**
 * Query-layer org-scoping for the Person table.
 *
 * The `person` table is intentionally global (a person can belong to
 * multiple orgs via the `membership` table). Instead of adding an
 * `organizationId` column, we enforce org-scoping at the query layer
 * by JOINing through memberships.
 *
 * Usage in repos:
 *   const scopedIds = orgScopedPersonIds(this.db, organizationId);
 *   const results = await this.db
 *     .select().from(persons)
 *     .where(inArray(persons.id, scopedIds));
 */

import { eq, and, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { memberships } from '@/handlers/association:member/repos/membership.schema';

/** Membership statuses that grant active org membership */
const ACTIVE_MEMBERSHIP_STATUSES = ['active', 'gracePeriod', 'pendingPayment'] as const;

/**
 * Returns a subquery of person IDs that belong to the given org
 * via an active membership.
 */
export function orgScopedPersonIds(db: DatabaseInstance, organizationId: string) {
  return db
    .select({ personId: memberships.personId })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        inArray(memberships.status, [...ACTIVE_MEMBERSHIP_STATUSES]),
      ),
    );
}
