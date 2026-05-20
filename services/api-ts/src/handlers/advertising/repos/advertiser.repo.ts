/**
 * AdvertiserRepository - Data access layer for advertisers
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  advertisers,
  type Advertiser,
  type NewAdvertiser,
  type AdvertiserFilters,
} from './advertising.schema';

export class AdvertiserRepository extends DatabaseRepository<Advertiser, NewAdvertiser, AdvertiserFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, advertisers, logger);
  }

  protected buildWhereConditions(filters?: AdvertiserFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.organizationId) {
      conditions.push(eq(advertisers.organizationId, filters.organizationId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(advertisers.isActive, filters.isActive));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
