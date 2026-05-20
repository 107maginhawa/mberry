/**
 * CreativeRepository - Data access layer for ad creatives
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  creatives,
  adReports,
  type Creative,
  type NewCreative,
  type CreativeFilters,
} from './advertising.schema';

export class CreativeRepository extends DatabaseRepository<Creative, NewCreative, CreativeFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, creatives, logger);
  }

  protected buildWhereConditions(filters?: CreativeFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.organizationId) {
      conditions.push(eq(creatives.organizationId, filters.organizationId));
    }
    if (filters.campaignId) {
      conditions.push(eq(creatives.campaignId, filters.campaignId));
    }
    if (filters.status) {
      conditions.push(eq(creatives.status, filters.status as any));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Approve a creative (admin action, AC-M16-001)
   */
  async approveCreative(creativeId: string, reviewedBy: string): Promise<Creative> {
    return this.updateOneById(creativeId, {
      status: 'approved',
      reviewedBy,
      reviewedAt: new Date(),
    });
  }

  /**
   * Reject a creative
   */
  async rejectCreative(creativeId: string, reviewedBy: string, reason: string): Promise<Creative> {
    return this.updateOneById(creativeId, {
      status: 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      rejectionReason: reason,
    });
  }

  /**
   * Count reports for a creative (M16-R5)
   */
  async countReports(creativeId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(adReports)
      .where(eq(adReports.creativeId, creativeId));
    return Number(result[0]?.count ?? 0);
  }
}
