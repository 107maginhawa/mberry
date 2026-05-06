/**
 * ChapterAffiliationRepository - Data access layer for chapter affiliations
 * Encapsulates all database operations for the chapter_affiliation table
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  chapterAffiliations,
  affiliationTransfers,
  royaltySplits,
  type ChapterAffiliation,
  type NewChapterAffiliation,
  type AffiliationTransfer,
  type NewAffiliationTransfer,
  type RoyaltySplit,
  type NewRoyaltySplit,
} from './chapters.schema';

export interface ChapterAffiliationFilters {
  organizationId?: string;
  personId?: string;
  chapterId?: string;
  isPrimary?: boolean;
  status?: 'active' | 'transferred' | 'withdrawn';
}

export class ChapterAffiliationRepository extends DatabaseRepository<
  ChapterAffiliation,
  NewChapterAffiliation,
  ChapterAffiliationFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, chapterAffiliations, logger);
  }

  /**
   * Build where conditions for chapter affiliation filtering
   */
  protected buildWhereConditions(filters?: ChapterAffiliationFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(chapterAffiliations.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(chapterAffiliations.personId, filters.personId));
    }

    if (filters.chapterId) {
      conditions.push(eq(chapterAffiliations.chapterId, filters.chapterId));
    }

    if (filters.isPrimary !== undefined) {
      conditions.push(eq(chapterAffiliations.isPrimary, filters.isPrimary));
    }

    if (filters.status) {
      conditions.push(eq(chapterAffiliations.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Set the specified affiliation as primary and clear isPrimary on all other
   * affiliations for the same person within the same tenant.
   */
  async setPrimary(affiliationId: string, organizationId: string): Promise<ChapterAffiliation> {
    this.logger?.debug({ affiliationId, organizationId }, 'Setting primary chapter affiliation');

    // Fetch the target affiliation to get personId
    const target = await this.findOneById(affiliationId);
    if (!target) {
      throw new Error(`Chapter affiliation with id ${affiliationId} not found`);
    }

    // Clear isPrimary on all affiliations for this person in this tenant
    await this.db
      .update(chapterAffiliations)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(chapterAffiliations.organizationId, organizationId),
          eq(chapterAffiliations.personId, target.personId)
        )
      );

    // Set the target affiliation as primary
    const [updated] = await this.db
      .update(chapterAffiliations)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(chapterAffiliations.id, affiliationId))
      .returning();

    if (!updated) {
      throw new Error(`Failed to set primary affiliation ${affiliationId}`);
    }

    this.logger?.info({ affiliationId, personId: target.personId }, 'Primary chapter affiliation updated');

    return updated as ChapterAffiliation;
  }
}

// ---------------------------------------------------------------------------
// AffiliationTransferRepository
// ---------------------------------------------------------------------------

export interface AffiliationTransferFilters {
  organizationId?: string;
  personId?: string;
  fromChapterId?: string;
  toChapterId?: string;
  status?: string;
}

export class AffiliationTransferRepository extends DatabaseRepository<
  AffiliationTransfer,
  NewAffiliationTransfer,
  AffiliationTransferFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, affiliationTransfers, logger);
  }

  protected buildWhereConditions(filters?: AffiliationTransferFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(affiliationTransfers.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(affiliationTransfers.personId, filters.personId));
    }

    if (filters.fromChapterId) {
      conditions.push(eq(affiliationTransfers.fromChapterId, filters.fromChapterId));
    }

    if (filters.toChapterId) {
      conditions.push(eq(affiliationTransfers.toChapterId, filters.toChapterId));
    }

    if (filters.status) {
      conditions.push(eq(affiliationTransfers.status, filters.status as any)); // SAFE: Drizzle enum narrowing
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// RoyaltySplitRepository
// ---------------------------------------------------------------------------

export interface RoyaltySplitFilters {
  organizationId?: string;
  membershipId?: string;
  chapterId?: string;
  nationalOrgId?: string;
}

export class RoyaltySplitRepository extends DatabaseRepository<
  RoyaltySplit,
  NewRoyaltySplit,
  RoyaltySplitFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, royaltySplits, logger);
  }

  protected buildWhereConditions(filters?: RoyaltySplitFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(royaltySplits.organizationId, filters.organizationId));
    }

    if (filters.membershipId) {
      conditions.push(eq(royaltySplits.membershipId, filters.membershipId));
    }

    if (filters.chapterId) {
      conditions.push(eq(royaltySplits.chapterId, filters.chapterId));
    }

    if (filters.nationalOrgId) {
      conditions.push(eq(royaltySplits.nationalOrgId, filters.nationalOrgId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
