/**
 * DirectoryProfileRepository - Data access layer for member directory profiles
 * Encapsulates all database operations for the directory_profile table
 */

import { eq, and, or, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  directoryProfiles,
  type DirectoryProfile,
  type NewDirectoryProfile,
} from './directory.schema';
import { memberships } from './membership.schema';
import { chapterAffiliations } from './chapters.schema';

export interface DirectoryProfileFilters {
  organizationId?: string;
  personId?: string;
  visibility?: 'public' | 'memberOnly' | 'hidden';
  q?: string; // General search query across headline/bio
}

export interface DirectorySearchFilters extends DirectoryProfileFilters {
  chapter?: string;
  duesStatus?: 'current';
  tier?: string;
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

  /**
   * Search with cross-table filters (chapter, duesStatus, tier).
   */
  async searchWithFilters(
    filters: DirectorySearchFilters,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: DirectoryProfile[]; totalCount: number }> {
    const db = this.db;
    const baseConditions: SQL[] = [];

    if (filters.organizationId) {
      baseConditions.push(eq(directoryProfiles.organizationId, filters.organizationId));
    }
    baseConditions.push(inArray(directoryProfiles.visibility, ['public', 'memberOnly']));

    if (filters.q) {
      baseConditions.push(
        or(
          ilike(directoryProfiles.displayName, `%${filters.q}%`),
          ilike(directoryProfiles.title, `%${filters.q}%`),
          ilike(directoryProfiles.specialty, `%${filters.q}%`),
          ilike(directoryProfiles.bio, `%${filters.q}%`)
        )!,
      );
    }

    const personIdFilters: SQL[] = [];

    if (filters.duesStatus === 'current') {
      personIdFilters.push(
        sql`${directoryProfiles.personId} IN (SELECT ${memberships.personId} FROM ${memberships} WHERE ${memberships.organizationId} = ${filters.organizationId} AND ${memberships.status} IN ('active', 'gracePeriod'))`,
      );
    }
    if (filters.tier) {
      personIdFilters.push(
        sql`${directoryProfiles.personId} IN (SELECT ${memberships.personId} FROM ${memberships} WHERE ${memberships.organizationId} = ${filters.organizationId} AND ${memberships.tierId} = ${filters.tier})`,
      );
    }
    if (filters.chapter) {
      personIdFilters.push(
        sql`${directoryProfiles.personId} IN (SELECT ${chapterAffiliations.personId} FROM ${chapterAffiliations} WHERE ${chapterAffiliations.organizationId} = ${filters.organizationId} AND ${chapterAffiliations.chapterId} = ${filters.chapter})`,
      );
    }

    const allConditions = [...baseConditions, ...personIdFilters];
    const whereClause = and(...allConditions);

    const [countResult, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(directoryProfiles).where(whereClause),
      db.select().from(directoryProfiles).where(whereClause).orderBy(directoryProfiles.displayName).limit(pagination.limit).offset(pagination.offset),
    ]);

    return { data, totalCount: countResult[0]?.count ?? 0 };
  }
}
