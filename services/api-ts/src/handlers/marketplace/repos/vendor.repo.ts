/**
 * VendorRepository - Data access layer for marketplace vendors
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { NotFoundError } from '@/core/errors';
import {
  assertValidTransition,
  MARKETPLACE_VENDOR_VALID_TRANSITIONS,
} from '@/utils/status-transitions';
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
   * Verify a vendor (admin action). Defensive FSM guard — handler also guards;
   * this chokehold catches any future caller that bypasses the handler.
   */
  async verifyVendor(vendorId: string, verifiedBy: string): Promise<Vendor> {
    const current = await this.findOneById(vendorId);
    if (!current) throw new NotFoundError('Vendor not found');
    assertValidTransition(
      MARKETPLACE_VENDOR_VALID_TRANSITIONS,
      current.verificationStatus,
      'verified',
      'vendor',
    );
    return this.updateOneById(vendorId, {
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy,
    });
  }

  /**
   * Suspend a vendor (admin action). FSM-guarded: only verified → suspended is allowed.
   */
  async suspendVendor(vendorId: string, updatedBy: string): Promise<Vendor> {
    const current = await this.findOneById(vendorId);
    if (!current) throw new NotFoundError('Vendor not found');
    assertValidTransition(
      MARKETPLACE_VENDOR_VALID_TRANSITIONS,
      current.verificationStatus,
      'suspended',
      'vendor',
    );
    return this.updateOneById(vendorId, {
      verificationStatus: 'suspended',
      updatedBy,
    });
  }
}
