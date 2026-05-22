/**
 * Database schema for Surveys & Polls module (M18).
 * Tables: survey, survey_response.
 *
 * BR-40: respondentId is nullable by design — for anonymous surveys,
 * NULL is stored at the architectural level (not masked after the fact).
 * This makes deanonymization technically impossible.
 */

import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  index,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const surveyTypeEnum = pgEnum('survey_type', ['anonymous', 'identified']);

export const surveyStatusEnum = pgEnum('survey_status', ['draft', 'active', 'closed']);

export const surveyDistributionEnum = pgEnum('survey_distribution', [
  'all_members',
  'active_members',
  'specific_categories',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const surveys = pgTable(
  'survey',
  {
    ...baseEntityFields,
    organizationId: uuid('organization_id').notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    type: surveyTypeEnum('type').notNull().default('anonymous'),
    status: surveyStatusEnum('status').notNull().default('draft'),
    isPoll: boolean('is_poll').notNull().default(false),
    questions: jsonb('questions').$type<SurveyQuestion[]>().notNull(),
    distribution: surveyDistributionEnum('distribution').notNull().default('active_members'),
    categoryFilter: jsonb('category_filter').$type<string[]>(),
    deadline: timestamp('deadline'),
    allowEditBeforeDeadline: boolean('allow_edit_before_deadline').notNull().default(true),
    showResultsImmediately: boolean('show_results_immediately').notNull().default(false),
    reminderSchedule: jsonb('reminder_schedule').$type<number[]>().notNull().default([]),
    responseCount: integer('response_count').notNull().default(0),
  },
  (table) => [
    index('idx_survey_org').on(table.organizationId),
    index('idx_survey_status').on(table.status),
  ],
);

export const surveyResponses = pgTable(
  'survey_response',
  {
    ...baseEntityFields,
    surveyId: uuid('survey_id').notNull(),
    // CRITICAL BR-40: nullable — NULL for anonymous surveys (architectural guarantee)
    respondentId: uuid('respondent_id'),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_survey_response_survey').on(table.surveyId),
    index('idx_survey_response_respondent').on(table.respondentId),
  ],
);

// ---------------------------------------------------------------------------
// Question type (stored in jsonb)
// ---------------------------------------------------------------------------

export interface SurveyQuestion {
  id: string;
  type: 'multiple_choice' | 'rating_scale' | 'free_text' | 'ranking';
  text: string;
  required: boolean;
  options?: string[];       // multiple_choice
  scaleMin?: number;        // rating_scale
  scaleMax?: number;        // rating_scale
  maxLength?: number;       // free_text
  items?: string[];         // ranking
  multiSelect?: boolean;    // multiple_choice
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type NewSurveyResponse = typeof surveyResponses.$inferInsert;
