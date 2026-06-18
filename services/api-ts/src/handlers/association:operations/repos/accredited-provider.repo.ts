/**
 * Repository for PRC-accredited training providers.
 * Extends TrainingRepository pattern for consistency.
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { InternalError } from '@/core/errors';
import { DEFAULT_PAGE_SIZE } from '@/core/pagination';
import {
  accreditedProviders,
  type AccreditedProvider,
  type NewAccreditedProvider,
} from './accredited-provider.schema';

export interface AccreditedProviderFilters {
  organizationId?: string;
  status?: string;
}

export type AccreditedProviderWithExpiry = AccreditedProvider & { expiringSoon: boolean };

export class AccreditedProviderRepository {
  constructor(
    private db: DatabaseInstance,
    private logger?: any,
  ) {}

  /**
   * List providers for an org with optional status filter.
   * Computes expiringSoon flag: non-null expiryDate that is in the future but <= 30 days away.
   */
  async listWithExpiry(
    orgId: string,
    statusFilter?: string | null,
    pagination?: { limit: number; offset: number },
  ): Promise<{ data: AccreditedProviderWithExpiry[]; total: number }> {
    const conditions: SQL<unknown>[] = [eq(accreditedProviders.organizationId, orgId)];
    if (statusFilter) {
      conditions.push(eq(accreditedProviders.status, statusFilter as AccreditedProvider['status']));
    }

    const where = and(...conditions);

    // Always bound the data query to prevent unbounded result sets.
    const limit = pagination?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = pagination?.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(accreditedProviders)
        .where(where)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(accreditedProviders)
        .where(where),
    ]);

    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const data: AccreditedProviderWithExpiry[] = rows.map((row) => {
      let expiringSoon = false;
      if (row.expiryDate) {
        const expiry = new Date(row.expiryDate);
        expiringSoon = expiry > now && expiry <= thirtyDaysOut;
      }
      return { ...row, expiringSoon };
    });

    return { data, total: countResult[0]?.count ?? 0 };
  }

  /**
   * Get a provider by ID scoped to an organization.
   * Returns undefined if not found or belongs to a different org.
   */
  async getByOrg(id: string, orgId: string): Promise<AccreditedProvider | undefined> {
    const [row] = await this.db
      .select()
      .from(accreditedProviders)
      .where(and(eq(accreditedProviders.id, id), eq(accreditedProviders.organizationId, orgId)))
      .limit(1);
    return row;
  }

  async createOne(data: NewAccreditedProvider): Promise<AccreditedProvider> {
    const [result] = await this.db
      .insert(accreditedProviders)
      .values(data)
      .returning();
    if (!result) throw new InternalError('Failed to create accredited provider');
    return result;
  }

  async update(id: string, data: Partial<NewAccreditedProvider>): Promise<AccreditedProvider> {
    const [result] = await this.db
      .update(accreditedProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accreditedProviders.id, id))
      .returning();
    if (!result) throw new InternalError('Failed to update accredited provider');
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(accreditedProviders)
      .where(eq(accreditedProviders.id, id));
  }
}
