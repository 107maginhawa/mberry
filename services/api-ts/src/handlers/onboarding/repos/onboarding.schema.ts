/**
 * Database schema for the resumable onboarding wizard state (m01 auth-onboarding).
 *
 * Org-scoped: one OnboardingState per organization (organizationId unique).
 * Tracks wizard progress so an officer can resume mid-flow.
 *
 * Wizard steps (1-5): profile, import, dues, gateway, invite.
 */

import {
  pgTable,
  integer,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';

export const onboardingStates = pgTable('onboarding_state', {
  ...baseEntityFields,

  /** Organization this onboarding belongs to — one state per org */
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  /** Current wizard step (1-5) */
  currentStep: integer('current_step').notNull().default(1),

  /** Completed step numbers (e.g. [1, 2, 3]) */
  stepsCompleted: jsonb('steps_completed').$type<number[]>().notNull().default([]),

  /** When the wizard reached the final step (null while in progress) */
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_onboarding_organization_id').on(table.organizationId),
]);

export type OnboardingState = typeof onboardingStates.$inferSelect;
export type NewOnboardingState = typeof onboardingStates.$inferInsert;
