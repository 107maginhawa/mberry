/**
 * Shared database schema definitions and helpers
 * Provides base entity fields and interfaces for consistency across all tables
 */

import { uuid, timestamp, integer } from 'drizzle-orm/pg-core';

/**
 * Base entity fields that all tables should include
 * Provides standard audit and tracking fields
 */
export const baseEntityFields = {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Timestamps
  // TODO: Migrate to timestamp('...', { withTimezone: true }) — tracked as GitHub issue
  // Current: TIMESTAMP WITHOUT TIME ZONE. Safe if server runs UTC.
  // Migration touches all tables — requires dedicated phase with testing.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Optimistic locking
  version: integer('version').default(1).notNull(),
  
  // Audit fields - who performed the action
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * BaseEntity interface for TypeScript type consistency
 * All entity types should extend this interface
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
}