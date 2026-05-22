/**
 * CampaignRepository - Data access layer for ad campaigns
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  campaigns,
  type Campaign,
  type NewCampaign,
  type CampaignFilters,
} from './advertising.schema';

export class CampaignRepository extends DatabaseRepository<Campaign, NewCampaign, CampaignFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, campaigns, logger);
  }

  protected buildWhereConditions(filters?: CampaignFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.organizationId) {
      conditions.push(eq(campaigns.organizationId, filters.organizationId));
    }
    if (filters.advertiserId) {
      conditions.push(eq(campaigns.advertiserId, filters.advertiserId));
    }
    if (filters.status) {
      conditions.push(eq(campaigns.status, filters.status as Campaign['status']));
    }
    if (filters.adSlot) {
      conditions.push(eq(campaigns.adSlot, filters.adSlot as Campaign['adSlot']));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Pause a campaign (e.g., budget exhausted M16-R6)
   */
  async pauseCampaign(campaignId: string, updatedBy: string): Promise<Campaign> {
    return this.updateOneById(campaignId, {
      status: 'paused',
      updatedBy,
    });
  }
}
