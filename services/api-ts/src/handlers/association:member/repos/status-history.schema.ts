import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { memberships, membershipStatusEnum } from './membership.schema';

/**
 * Membership status change history.
 * Tracks every status transition for audit and compliance.
 * Additive — does not modify the memberships table.
 */
export const membershipStatusHistory = pgTable('membership_status_history', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  membershipId: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'restrict' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),
  fromStatus: membershipStatusEnum('from_status'),
  toStatus: membershipStatusEnum('to_status').notNull(),
  reason: text('reason'),
  changedBy: uuid('changed_by').references(() => persons.id, { onDelete: 'restrict' }),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('membership_status_history_org_idx').on(table.organizationId),
  membershipIdx: index('membership_status_history_membership_idx').on(table.membershipId),
  personIdx: index('membership_status_history_person_idx').on(table.personId),
  changedAtIdx: index('membership_status_history_changed_at_idx').on(table.changedAt),
}));

export type MembershipStatusHistory = typeof membershipStatusHistory.$inferSelect;
export type NewMembershipStatusHistory = typeof membershipStatusHistory.$inferInsert;
