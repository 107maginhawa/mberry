/**
 * Database schema for institutional memberships — group/org-sponsored memberships with seat allocation
 * Uses Drizzle ORM with PostgreSQL
 *
 * Covers: InstitutionalMembership, SeatAllocation
 */

import {
  pgTable,
  integer,
  timestamp,
  date,
  pgEnum,
  index,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { membershipStatusEnum } from './membership.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** Status of a seat allocation within an institutional membership */
export const seatAllocationStatusEnum = pgEnum('seat_allocation_status', [
  'active',
  'revoked',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Institutional membership — a group membership purchased by a parent org (hospital, clinic, university) for an association chapter */
export const institutionalMemberships = pgTable(
  'institutional_membership',
  {
    ...baseEntityFields,

    organizationId: uuid('organization_id').notNull(),
    parentOrganizationId: uuid('parent_organization_id').notNull(),
    tierId: uuid('tier_id').notNull(),
    totalSeats: integer('total_seats').notNull(),
    usedSeats: integer('used_seats').notNull().default(0),
    primaryContactId: uuid('primary_contact_id').notNull(),
    billingContactId: uuid('billing_contact_id'),
    startDate: date('start_date').notNull(),
    duesExpiryDate: date('dues_expiry_date'),
    status: membershipStatusEnum('status').notNull().default('pendingPayment'),
  },
  (table) => ({
    orgIdx: index('institutional_membership_org_idx').on(table.organizationId),
    parentOrgIdx: index('institutional_membership_parent_org_idx').on(table.parentOrganizationId),
    statusIdx: index('institutional_membership_status_idx').on(table.status),
  }),
);

/** Seat allocation — assigns an individual person to an institutional membership seat */
export const seatAllocations = pgTable(
  'seat_allocation',
  {
    ...baseEntityFields,

    institutionalMembershipId: uuid('institutional_membership_id')
      .notNull()
      .references(() => institutionalMemberships.id),
    personId: uuid('person_id').notNull(),
    allocatedBy: uuid('allocated_by').notNull(),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    status: seatAllocationStatusEnum('status').notNull().default('active'),
  },
  (table) => ({
    membershipIdx: index('seat_allocation_membership_idx').on(table.institutionalMembershipId),
    personIdx: index('seat_allocation_person_idx').on(table.personId),
    // Unique constraint on (membership, person) — double-allocation prevention enforced at app layer
    // via findActiveByMembershipAndPerson check before insert
    activeUniq: uniqueIndex('seat_allocation_active_unique').on(
      table.institutionalMembershipId,
      table.personId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type InstitutionalMembership = typeof institutionalMemberships.$inferSelect;
export type NewInstitutionalMembership = typeof institutionalMemberships.$inferInsert;

export type SeatAllocation = typeof seatAllocations.$inferSelect;
export type NewSeatAllocation = typeof seatAllocations.$inferInsert;
