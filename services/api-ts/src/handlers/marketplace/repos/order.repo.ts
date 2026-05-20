/**
 * OrderRepository - Data access layer for marketplace orders
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  marketplaceOrders,
  type MarketplaceOrder,
  type NewMarketplaceOrder,
  type OrderFilters,
} from './marketplace.schema';

export class OrderRepository extends DatabaseRepository<
  MarketplaceOrder,
  NewMarketplaceOrder,
  OrderFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, marketplaceOrders, logger);
  }

  protected buildWhereConditions(filters?: OrderFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(marketplaceOrders.organizationId, filters.organizationId));
    }
    if (filters.buyerPersonId) {
      conditions.push(eq(marketplaceOrders.buyerPersonId, filters.buyerPersonId));
    }
    if (filters.vendorId) {
      conditions.push(eq(marketplaceOrders.vendorId, filters.vendorId));
    }
    if (filters.listingId) {
      conditions.push(eq(marketplaceOrders.listingId, filters.listingId));
    }
    if (filters.status) {
      conditions.push(eq(marketplaceOrders.status, filters.status as any));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Fulfill an order
   */
  async fulfillOrder(orderId: string, updatedBy: string): Promise<MarketplaceOrder> {
    return this.updateOneById(orderId, {
      status: 'fulfilled',
      fulfilledAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, updatedBy: string): Promise<MarketplaceOrder> {
    return this.updateOneById(orderId, {
      status: 'cancelled',
      updatedBy,
    });
  }
}
