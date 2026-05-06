/**
 * DirectoryProfileRepository - Data access layer for member directory profiles
 * Encapsulates all database operations for the directory_profile table
 */

import { eq, and, or, ilike, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  directoryProfiles,
  type DirectoryProfile,
  type NewDirectoryProfile,
} from './directory.schema';

export interface DirectoryProfileFilters {
  organizationId?: string;
  personId?: string;
  visibility?: 'public' | 'memberOnly' | 'hidden';
  q?: string; // General search query across headline/bio
}

export class DirectoryProfileRepository extends DatabaseRepository<
  DirectoryProfile,
  NewDirectoryProfile,
  DirectoryProfileFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, directoryProfiles, logger);
  }

  /**
   * Build where conditions for directory profile filtering
   */
  protected buildWhereConditions(filters?: DirectoryProfileFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(directoryProfiles.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(directoryProfiles.personId, filters.personId));
    }

    if (filters.visibility) {
      conditions.push(eq(directoryProfiles.visibility, filters.visibility));
    }

    // Text search across displayName, title, specialty, bio
    if (filters.q) {
      conditions.push(
        or(
          ilike(directoryProfiles.displayName, `%${filters.q}%`),
          ilike(directoryProfiles.title, `%${filters.q}%`),
          ilike(directoryProfiles.specialty, `%${filters.q}%`),
          ilike(directoryProfiles.bio, `%${filters.q}%`)
        )
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
