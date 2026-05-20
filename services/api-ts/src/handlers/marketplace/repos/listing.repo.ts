/**
 * ListingRepository - Data access layer for marketplace listings
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  marketplaceListings,
  type MarketplaceListing,
  type NewMarketplaceListing,
  type ListingFilters,
} from './marketplace.schema';

export class ListingRepository extends DatabaseRepository<
  MarketplaceListing,
  NewMarketplaceListing,
  ListingFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, marketplaceListings, logger);
  }

  protected buildWhereConditions(filters?: ListingFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(marketplaceListings.organizationId, filters.organizationId));
    }
    if (filters.vendorId) {
      conditions.push(eq(marketplaceListings.vendorId, filters.vendorId));
    }
    if (filters.status) {
      conditions.push(eq(marketplaceListings.status, filters.status as any));
    }
    if (filters.categoryTag) {
      conditions.push(
        sql`${marketplaceListings.categoryTags} @> ${JSON.stringify([filters.categoryTag])}`
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find active listings for a verified vendor
   */
  async findActiveListingsByVendor(vendorId: string): Promise<MarketplaceListing[]> {
    return this.findMany({ vendorId, status: 'active' });
  }
}
