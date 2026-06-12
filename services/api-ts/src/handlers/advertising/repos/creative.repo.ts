/**
 * CreativeRepository - Data access layer for ad creatives
 */

import { eq, and, gte, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  creatives,
  adReports,
  type Creative,
  type NewCreative,
  type CreativeFilters,
  type AdReport,
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
      conditions.push(eq(creatives.status, filters.status as Creative['status']));
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

  /**
   * Persist a member abuse report against a creative (M16-R5, AHA FIX-009).
   * Each report is a durable row in ad_report — no longer simulated.
   */
  async createReport(data: {
    organizationId: string;
    creativeId: string;
    reporterPersonId: string;
    reason: string;
    actorId?: string;
  }): Promise<AdReport> {
    const [row] = await this.db
      .insert(adReports)
      .values({
        organizationId: data.organizationId,
        creativeId: data.creativeId,
        reporterPersonId: data.reporterPersonId,
        reason: data.reason,
        createdBy: data.actorId ?? data.reporterPersonId,
        updatedBy: data.actorId ?? data.reporterPersonId,
      })
      .returning();
    return row as AdReport;
  }

  /**
   * Count reports for a creative within a rolling window of `days` (M16-R5,
   * AHA FIX-009). Used for the 3-in-7-days auto-pause threshold.
   */
  async countReportsWithinDays(creativeId: string, days: number): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(adReports)
      .where(and(eq(adReports.creativeId, creativeId), gte(adReports.createdAt, since)));
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Auto-pause a creative after the report threshold (M16-R5, AHA FIX-009).
   *
   * The creative_status enum has no `paused` value, so "auto-pause for review"
   * (per m16 §4 / M16-R5) reverts the creative to `pending`: it stops serving
   * immediately (getAdForPlacement only serves `approved`) and re-enters the
   * admin review queue, where it can be re-approved or rejected. This is a
   * creative-level action — it does NOT pause the parent campaign.
   */
  async pauseCreative(creativeId: string): Promise<Creative> {
    return this.updateOneById(creativeId, {
      status: 'pending',
    } as Partial<Creative>);
  }
}
