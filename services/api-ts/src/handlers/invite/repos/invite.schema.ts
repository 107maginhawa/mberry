/**
 * Database schema for invitation tokens — supports officer invites and bulk import claims.
 * Business rules: M1-R2 (7-day expiry), single-use, HMAC-signed.
 */

import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

export const inviteTypeEnum = pgEnum('invite_type', [
  'claim',   // Bulk-imported member claiming their account
  'invite',  // Officer-sent individual invitation
]);

export const inviteStatusEnum = pgEnum('invite_status', [
  'pending',
  'claimed',
  'expired',
  'revoked',
]);

export const invitationTokens = pgTable('invitation_token', {
  ...baseEntityFields,

  /** Person this invite is for (null for open invites) */
  personId: uuid('person_id'),

  /** Organization the invite belongs to (legacy column) */
  orgId: uuid('org_id').notNull(),

  /** Organization FK with referential integrity */
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  /** HMAC hash of the token (never store raw token) */
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),

  /** Type: claim (bulk import) or invite (individual) */
  type: inviteTypeEnum('type').notNull(),

  /** Current status */
  status: inviteStatusEnum('status').notNull().default('pending'),

  /** When the token expires (default: 7 days from creation) */
  expiresAt: timestamp('expires_at').notNull(),

  /** When the token was claimed */
  claimedAt: timestamp('claimed_at'),

  /** Officer who created this invite */
  createdByOfficer: uuid('created_by_officer').notNull(),

  /** Pre-populated data for claim flow (name, email, license from import) */
  metadata: jsonb('metadata').$type<InviteMetadata>(),

  /** Email address the invite was sent to */
  email: varchar('email', { length: 255 }).notNull(),

  /** Personalized message from the officer (optional) */
  message: varchar('message', { length: 1000 }),
}, (table) => [
  index('idx_invite_token_hash').on(table.tokenHash),
  index('idx_invite_org').on(table.orgId),
  index('idx_invite_organization_id').on(table.organizationId),
  index('idx_invite_email').on(table.email),
  index('idx_invite_status').on(table.status),
]);

export interface InviteMetadata {
  /** Pre-populated name from import */
  name?: string;
  /** Pre-populated license number from import */
  licenseNumber?: string;
  /** Membership category to assign on claim */
  membershipCategoryId?: string;
  /** Membership tier to assign on claim */
  membershipTierId?: string;
  /** Resend count */
  resendCount?: number;
  /** Last resent at */
  lastResentAt?: string;
}

export type InvitationToken = typeof invitationTokens.$inferSelect;
export type NewInvitationToken = typeof invitationTokens.$inferInsert;
