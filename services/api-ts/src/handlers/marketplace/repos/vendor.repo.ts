/**
 * VendorRepository - Data access layer for marketplace vendors
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  vendors,
  type Vendor,
  type NewVendor,
  type VendorFilters,
} from './marketplace.schema';

export class VendorRepository extends DatabaseRepository<Vendor, NewVendor, VendorFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, vendors, logger);
  }

  protected buildWhereConditions(filters?: VendorFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(vendors.organizationId, filters.organizationId));
    }
    if (filters.category) {
      conditions.push(eq(vendors.category, filters.category as Vendor['category']));
    }
    if (filters.verificationStatus) {
      conditions.push(eq(vendors.verificationStatus, filters.verificationStatus as Vendor['verificationStatus']));
    }
    if (filters.contactEmail) {
      conditions.push(eq(vendors.contactEmail, filters.contactEmail));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find verified vendors for an organization
   */
  async findVerifiedVendors(organizationId: string): Promise<Vendor[]> {
    return this.findMany({
      organizationId,
      verificationStatus: 'verified',
    });
  }

  /**
   * Verify a vendor (admin action)
   */
  async verifyVendor(vendorId: string, verifiedBy: string): Promise<Vendor> {
    return this.updateOneById(vendorId, {
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy,
    });
  }

  /**
   * Suspend a vendor (admin action)
   */
  async suspendVendor(vendorId: string, updatedBy: string): Promise<Vendor> {
    return this.updateOneById(vendorId, {
      verificationStatus: 'suspended',
      updatedBy,
    });
  }
}
