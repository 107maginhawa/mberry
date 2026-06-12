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
  /**
   * FIX-005 (G3): optional lifecycle-status filter. When set to 'active',
   * voided/disputed entries are excluded. Left optional so non-record reads
   * (e.g. DPA data export) can still retrieve every entry; record-facing
   * reads like the transcript opt in to 'active'.
   */
  status?: 'active' | 'voided' | 'disputed';
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

    if (filters.type) {
      conditions.push(eq(creditEntries.type, filters.type));
    }

    if (filters.cycleStart && filters.cycleEnd) {
      conditions.push(
        between(creditEntries.activityDate, filters.cycleStart, filters.cycleEnd),
      );
    }

    // FIX-005 (G3): exclude non-active (voided/disputed) entries when requested.
    if (filters.status) {
      conditions.push(eq(creditEntries.status, filters.status));
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
   * FIX-008 (M9-R2): count AUTO credit entries awarded for a training (any
   * member). Used by updateTraining to lock `creditAmount` once the first
   * attendance-based credit has been awarded, preventing credit-value drift
   * from corrupting already-issued history.
   */
  async countAutoByTraining(trainingId: string): Promise<number> {
    this.logger?.debug({ trainingId }, 'Counting auto credits for training');

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(creditEntries)
      .where(
        and(
          eq(creditEntries.trainingId, trainingId),
          eq(creditEntries.type, 'auto'),
        ),
      );

    return row?.count ?? 0;
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
      // FIX-005 (G3): exclude voided entries so an officer void reduces totals.
      eq(creditEntries.status, 'active'),
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
          // FIX-005 (G3): exclude voided entries from category breakdown.
          eq(creditEntries.status, 'active'),
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
   * List credit entries for a person within a cycle window.
   * Used for transcript PDF generation (Slice 043).
   */
  async listForPerson(
    personId: string,
    filters: { cycleStart?: Date; cycleEnd?: Date } = {},
  ): Promise<CreditEntry[]> {
    return this.findMany({
      personId,
      cycleStart: filters.cycleStart,
      cycleEnd: filters.cycleEnd,
      // FIX-005 (G3): the transcript is a record-facing read — voided entries
      // must not appear among the listed activities.
      status: 'active',
    });
  }

  /**
   * Cross-org aggregation: get total credits grouped by organization for a person in a cycle.
   */
  async sumCreditsByOrg(
    personId: string,
    cycleStart: Date,
    cycleEnd: Date,
  ): Promise<Array<{ organizationId: string; organizationName?: string; total: number }>> {
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
          // FIX-005 (G3): exclude voided entries so the cross-org transcript
          // total and per-org breakdown drop when an officer voids credits.
          eq(creditEntries.status, 'active'),
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
      conditions.push(eq(professionalLicenses.status, filters.status as ProfessionalLicense['status']));
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
      conditions.push(eq(licenseRenewalAlerts.status, filters.status as LicenseRenewalAlert['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
