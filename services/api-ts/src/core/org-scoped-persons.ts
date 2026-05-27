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
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';

/** Membership statuses that grant active org membership */
const ACTIVE_MEMBERSHIP_STATUSES = ['active', 'gracePeriod', 'pendingPayment'] as const;

/**
 * Minimal contract for the memberships table columns used by org-scoping.
 * Avoids importing the handler schema directly into core.
 */
export interface MembershipsTableRef {
  personId: any;
  organizationId: any;
  status: any;
}

/** Lazily-bound memberships table ref — set once at app startup. */
let _membershipsTable: (PgTableWithColumns<any> & MembershipsTableRef) | null = null;

/**
 * Bind the memberships table reference. Call once at app startup (app.ts).
 */
export function bindMembershipsTable(table: PgTableWithColumns<any> & MembershipsTableRef): void {
  _membershipsTable = table;
}

/**
 * Returns a subquery of person IDs that belong to the given org
 * via an active membership.
 */
export function orgScopedPersonIds(db: DatabaseInstance, organizationId: string) {
  if (!_membershipsTable) {
    throw new Error('orgScopedPersonIds: memberships table not bound — call bindMembershipsTable() at startup');
  }
  return db
    .select({ personId: _membershipsTable.personId })
    .from(_membershipsTable)
    .where(
      and(
        eq(_membershipsTable.organizationId, organizationId),
        inArray(_membershipsTable.status, [...ACTIVE_MEMBERSHIP_STATUSES]),
      ),
    );
}
