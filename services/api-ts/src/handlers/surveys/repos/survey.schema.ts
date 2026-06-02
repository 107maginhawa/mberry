/**
 * Database schema for surveys module - matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

// ---------------------------------------------------------------------------
// TypeScript interfaces for JSONB columns
// ---------------------------------------------------------------------------

export interface SkipLogic {
  condition: string; // e.g. "value === 'yes'" or "value >= 8"
  targetQuestionId: string;
}

export interface SurveyQuestion {
  id: string;
  type: 'nps' | 'rating' | 'single_choice' | 'multi_choice' | 'text' | 'yes_no';
  text: string;
  required: boolean;
  order: number;
  options?: string[];
  scale?: { min: number; max: number };
  maxLength?: number;
  skipLogic?: SkipLogic; // Phase 4: schema prep for conditional logic
}

export interface TargetAudience {
  tiers?: string[];
  chapters?: string[];
  committees?: string[];
}

export interface SurveySettings {
  anonymous?: boolean;
  deadline?: string; // ISO 8601 date
  targetAudience?: string | TargetAudience; // backwards-compatible: string for old data, object for new
  fatigueThreshold?: number; // max surveys per member per week, default 2
  retentionDays?: number; // data retention period, default 1095 (3 years)
  allowReedit?: boolean; // [AC-M18-004] M18-R3: members may update their response before deadline
}

export interface QuestionBreakdown {
  questionId: string;
  questionType: string;
  // NPS fields
  promoters?: number;
  passives?: number;
  detractors?: number;
  npsScore?: number;
  distribution?: Record<string, number>;
  // Rating fields
  average?: number;
  // Choice fields
  counts?: Record<string, number>;
  // Text / yes_no fields
  count?: number;
  yesCount?: number;
  noCount?: number;
}

export interface SurveyAnalyticsSnapshot {
  totalResponses: number;
  completionRate: number;
  npsScore?: number;
  questionBreakdown: QuestionBreakdown[];
}

export interface QuestionAnswer {
  questionId: string;
  value: string | string[] | number | boolean;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const surveys = pgTable('survey', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),

  title: varchar('title', { length: 200 }).notNull(),

  description: text('description'),

  status: varchar('status', { length: 20 }).notNull().default('draft'),

  surveyType: varchar('survey_type', { length: 20 }).notNull(),

  questions: jsonb('questions').$type<SurveyQuestion[]>().notNull().default([]),

  settings: jsonb('settings').$type<SurveySettings>().notNull().default({}),

  analyticsSnapshot: jsonb('analytics_snapshot').$type<SurveyAnalyticsSnapshot>(),

  createdBy: uuid('created_by')
    .references(() => persons.id, { onDelete: 'restrict' }),
}, (table) => ({
  orgIdx: index('surveys_org_idx').on(table.organizationId),
  statusIdx: index('surveys_status_idx').on(table.status),
  typeIdx: index('surveys_type_idx').on(table.surveyType),
  createdByIdx: index('surveys_created_by_idx').on(table.createdBy),
}));

export const surveyResponses = pgTable('survey_response', {
  ...baseEntityFields,

  organizationId: uuid('organization_id').notNull(),

  surveyId: uuid('survey_id')
    .notNull()
    .references(() => surveys.id, { onDelete: 'cascade' }),

  responderId: uuid('responder_id')
    .references(() => persons.id, { onDelete: 'restrict' }),

  answers: jsonb('answers').$type<QuestionAnswer[]>().notNull().default([]),

  status: varchar('status', { length: 20 }).notNull().default('pending'),

  completedAt: timestamp('completed_at', { withTimezone: true }),

  contextId: uuid('context_id'),
}, (table) => ({
  orgIdx: index('survey_responses_org_idx').on(table.organizationId),
  surveyIdx: index('survey_responses_survey_idx').on(table.surveyId),
  responderIdx: index('survey_responses_responder_idx').on(table.responderId),
  statusIdx: index('survey_responses_status_idx').on(table.status),
  uniqueResponse: unique('survey_responses_survey_responder_unique')
    .on(table.surveyId, table.responderId),
}));

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;
export type SurveyResponseRecord = typeof surveyResponses.$inferSelect;
export type NewSurveyResponse = typeof surveyResponses.$inferInsert;
