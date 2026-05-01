/**
 * Dues Repositories — Data access layer for dues config, invoices, and aging buckets
 * Encapsulates all database operations for the dues module tables
 */

import { eq, and, lt, notInArray, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  duesConfigs,
  duesInvoices,
  agingBuckets,
  type DuesConfig,
  type NewDuesConfig,
  type DuesInvoice,
  type NewDuesInvoice,
  type AgingBucket,
  type NewAgingBucket,
} from './dues.schema';

// ---------------------------------------------------------------------------
// DuesConfigRepository
// ---------------------------------------------------------------------------

export interface DuesConfigFilters {
  tenantId?: string;
  organizationId?: string;
  tierId?: string;
  status?: 'active' | 'retired';
}

export class DuesConfigRepository extends DatabaseRepository<DuesConfig, NewDuesConfig, DuesConfigFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, duesConfigs, logger);
  }

  /**
   * Build where conditions for dues-config-specific filtering
   */
  protected buildWhereConditions(filters?: DuesConfigFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.tenantId) {
      conditions.push(eq(duesConfigs.tenantId, filters.tenantId));
    }

    if (filters.organizationId) {
      conditions.push(eq(duesConfigs.organizationId, filters.organizationId));
    }

    if (filters.tierId) {
      conditions.push(eq(duesConfigs.tierId, filters.tierId));
    }

    if (filters.status) {
      conditions.push(eq(duesConfigs.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// DuesInvoiceRepository
// ---------------------------------------------------------------------------

export interface DuesInvoiceFilters {
  tenantId?: string;
  organizationId?: string;
  membershipId?: string;
  status?: 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'writtenOff';
}

export class DuesInvoiceRepository extends DatabaseRepository<DuesInvoice, NewDuesInvoice, DuesInvoiceFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, duesInvoices, logger);
  }

  /**
   * Build where conditions for dues-invoice-specific filtering
   */
  protected buildWhereConditions(filters?: DuesInvoiceFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.tenantId) {
      conditions.push(eq(duesInvoices.tenantId, filters.tenantId));
    }

    if (filters.organizationId) {
      conditions.push(eq(duesInvoices.organizationId, filters.organizationId));
    }

    if (filters.membershipId) {
      conditions.push(eq(duesInvoices.membershipId, filters.membershipId));
    }

    if (filters.status) {
      conditions.push(eq(duesInvoices.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find all overdue invoices for an organization —
   * invoices whose due date (periodEnd) has passed and status is not paid/cancelled/writtenOff
   */
  async findOverdue(tenantId: string, organizationId: string): Promise<DuesInvoice[]> {
    this.logger?.debug({ tenantId, organizationId }, 'Finding overdue invoices');

    const now = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD

    const records = await this.db
      .select()
      .from(duesInvoices)
      .where(
        and(
          eq(duesInvoices.tenantId, tenantId),
          eq(duesInvoices.organizationId, organizationId),
          notInArray(duesInvoices.status, ['paid', 'cancelled', 'writtenOff']),
          lt(duesInvoices.periodEnd, now)
        )
      );

    this.logger?.debug(
      { tenantId, organizationId, count: records.length },
      'Overdue invoices retrieved'
    );

    return records as DuesInvoice[];
  }

  /**
   * Mark an invoice as paid with payment details
   */
  async markPaid(
    invoiceId: string,
    paymentId: string,
    paidAt?: Date
  ): Promise<DuesInvoice> {
    this.logger?.debug({ invoiceId, paymentId }, 'Marking invoice as paid');

    const [updated] = await this.db
      .update(duesInvoices)
      .set({
        status: 'paid',
        paidAt: paidAt ?? new Date(),
        paymentId,
        updatedAt: new Date(),
      })
      .where(eq(duesInvoices.id, invoiceId))
      .returning();

    if (!updated) {
      throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    this.logger?.info({ invoiceId, paymentId }, 'Invoice marked as paid');

    return updated as DuesInvoice;
  }
}

// ---------------------------------------------------------------------------
// AgingBucketRepository
// ---------------------------------------------------------------------------

export interface AgingBucketFilters {
  tenantId?: string;
  organizationId?: string;
}

export class AgingBucketRepository extends DatabaseRepository<AgingBucket, NewAgingBucket, AgingBucketFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, agingBuckets, logger);
  }

  /**
   * Build where conditions for aging-bucket-specific filtering
   */
  protected buildWhereConditions(filters?: AgingBucketFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.tenantId) {
      conditions.push(eq(agingBuckets.tenantId, filters.tenantId));
    }

    if (filters.organizationId) {
      conditions.push(eq(agingBuckets.organizationId, filters.organizationId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
