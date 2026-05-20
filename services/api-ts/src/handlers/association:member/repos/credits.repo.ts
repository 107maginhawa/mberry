/**
 * Credits Repositories — Data access layer for credit entries and professional licenses
 * Encapsulates all database operations for the M10 credit tracking module
 */

import { eq, and, between, inArray, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  creditEntries,
  type CreditEntry,
  type NewCreditEntry,
} from './credits.schema';
import {
  professionalLicenses,
  licenseRenewalAlerts,
  type ProfessionalLicense,
  type NewProfessionalLicense,
  type LicenseRenewalAlert,
  type NewLicenseRenewalAlert,
} from './credentials.schema';

// ---------------------------------------------------------------------------
// CreditEntryRepository
// ---------------------------------------------------------------------------

export interface CreditEntryFilters {
  organizationId?: string;
  personId?: string;
  type?: 'auto' | 'manual';
  cycleStart?: Date;
  cycleEnd?: Date;
}

export class CreditEntryRepository extends DatabaseRepository<CreditEntry, NewCreditEntry, CreditEntryFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, creditEntries, logger);
  }

  protected buildWhereConditions(filters?: CreditEntryFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(creditEntries.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(creditEntries.personId, filters.personId));
    }

    if (filters.organizationId) {
      conditions.push(eq(creditEntries.organizationId, filters.organizationId));
    }

    if (filters.type) {
      conditions.push(eq(creditEntries.type, filters.type));
    }

    if (filters.cycleStart && filters.cycleEnd) {
      conditions.push(
        between(creditEntries.activityDate, filters.cycleStart, filters.cycleEnd),
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }


  /**
   * Find an existing auto credit entry for a specific training+person combination.
   * Used to prevent duplicate AUTO credits (AC-M10-002).
   */
  async findByTrainingAndPerson(
    trainingId: string,
    personId: string,
  ): Promise<CreditEntry | null> {
    this.logger?.debug({ trainingId, personId }, 'Checking for existing auto credit');

    const [existing] = await this.db
      .select()
      .from(creditEntries)
      .where(
        and(
          eq(creditEntries.trainingId, trainingId),
          eq(creditEntries.personId, personId),
          eq(creditEntries.type, 'auto'),
        ),
      )
      .limit(1);

    return existing ?? null;
  }

  /**
   * Sum credit amounts for a person within a cycle, optionally filtered by org.
   */
  async sumCreditsForCycle(
    personId: string,
    cycleStart: Date,
    cycleEnd: Date,
    organizationId?: string,
  ): Promise<number> {
    this.logger?.debug({ personId, cycleStart, cycleEnd, organizationId }, 'Summing credits for cycle');

    const conditions = [
      eq(creditEntries.personId, personId),
      between(creditEntries.activityDate, cycleStart, cycleEnd),
    ];

    if (organizationId) {
      conditions.push(eq(creditEntries.organizationId, organizationId));
    }

    const result = await this.db
      .select({ total: sql<number>`coalesce(sum(${creditEntries.creditAmount}), 0)` })
      .from(creditEntries)
      .where(and(...conditions));

    return Number(result[0]?.total ?? 0);
  }

  /**
   * Batch category aggregation: get credit totals grouped by CPD category for multiple persons.
   * Returns a Map<personId, Record<category, total>> for efficient compliance reporting (PRC-03).
   */
  async sumCreditsByCategoryBatch(
    personIds: string[],
    cycleStart: Date,
    cycleEnd: Date,
    organizationId: string,
  ): Promise<Map<string, Record<string, number>>> {
    if (personIds.length === 0) return new Map();

    const result = await this.db
      .select({
        personId: creditEntries.personId,
        category: creditEntries.category,
        total: sql<number>`coalesce(sum(${creditEntries.creditAmount}), 0)`,
      })
      .from(creditEntries)
      .where(
        and(
          inArray(creditEntries.personId, personIds),
          between(creditEntries.activityDate, cycleStart, cycleEnd),
          eq(creditEntries.organizationId, organizationId),
        ),
      )
      .groupBy(creditEntries.personId, creditEntries.category);

    const map = new Map<string, Record<string, number>>();
    for (const row of result) {
      const key = row.category ?? 'uncategorized';
      if (!map.has(row.personId)) map.set(row.personId, {});
      map.get(row.personId)![key] = Number(row.total);
    }
    return map;
  }

  /**
   * Cross-org aggregation: get total credits grouped by organization for a person in a cycle.
   */
  async sumCreditsByOrg(
    personId: string,
    cycleStart: Date,
    cycleEnd: Date,
  ): Promise<Array<{ organizationId: string; total: number }>> {
    this.logger?.debug({ personId, cycleStart, cycleEnd }, 'Summing credits by org');

    const result = await this.db
      .select({
        organizationId: creditEntries.organizationId,
        total: sql<number>`coalesce(sum(${creditEntries.creditAmount}), 0)`,
      })
      .from(creditEntries)
      .where(
        and(
          eq(creditEntries.personId, personId),
          between(creditEntries.activityDate, cycleStart, cycleEnd),
        ),
      )
      .groupBy(creditEntries.organizationId);

    return result.map(r => ({
      organizationId: r.organizationId,
      total: Number(r.total),
    }));
  }
}

// ---------------------------------------------------------------------------
// ProfessionalLicenseRepository
// ---------------------------------------------------------------------------

export interface ProfessionalLicenseFilters {
  organizationId?: string;
  personId?: string;
  licenseType?: string;
  status?: string;
  jurisdiction?: string;
}

export class ProfessionalLicenseRepository extends DatabaseRepository<
  ProfessionalLicense,
  NewProfessionalLicense,
  ProfessionalLicenseFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, professionalLicenses, logger);
  }

  protected buildWhereConditions(filters?: ProfessionalLicenseFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(professionalLicenses.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(professionalLicenses.personId, filters.personId));
    }

    if (filters.licenseType) {
      conditions.push(eq(professionalLicenses.licenseType, filters.licenseType));
    }

    if (filters.status) {
      conditions.push(eq(professionalLicenses.status, filters.status as any));
    }

    if (filters.jurisdiction) {
      conditions.push(eq(professionalLicenses.jurisdiction, filters.jurisdiction));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// LicenseRenewalAlertRepository
// ---------------------------------------------------------------------------

export interface LicenseRenewalAlertFilters {
  organizationId?: string;
  personId?: string;
  licenseId?: string;
  status?: string;
}

export class LicenseRenewalAlertRepository extends DatabaseRepository<
  LicenseRenewalAlert,
  NewLicenseRenewalAlert,
  LicenseRenewalAlertFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, licenseRenewalAlerts, logger);
  }

  protected buildWhereConditions(filters?: LicenseRenewalAlertFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(licenseRenewalAlerts.organizationId, filters.organizationId));
    }

    if (filters.personId) {
      conditions.push(eq(licenseRenewalAlerts.personId, filters.personId));
    }

    if (filters.licenseId) {
      conditions.push(eq(licenseRenewalAlerts.licenseId, filters.licenseId));
    }

    if (filters.status) {
      conditions.push(eq(licenseRenewalAlerts.status, filters.status as any));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
