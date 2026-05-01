/**
 * Membership repositories — data access layer for membership module
 * Encapsulates all database operations for membership-related tables
 */

import { eq, and, or, ilike, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  membershipTiers,
  memberships,
  membershipApplications,
  membershipCategories,
  type MembershipTier,
  type NewMembershipTier,
  type Membership,
  type NewMembership,
  type MembershipApplication,
  type NewMembershipApplication,
  type MembershipCategory,
  type NewMembershipCategory,
} from './membership.schema';

// ---------------------------------------------------------------------------
// Filter interfaces
// ---------------------------------------------------------------------------

export interface MembershipTierFilters {
  tenantId?: string;
  status?: string;
  name?: string;
  q?: string;
}

export interface MembershipFilters {
  tenantId?: string;
  orgId?: string;
  personId?: string;
  status?: string;
  tierId?: string;
  q?: string;
}

export interface MembershipApplicationFilters {
  tenantId?: string;
  orgId?: string;
  personId?: string;
  status?: string;
}

export interface MembershipCategoryFilters {
  tenantId?: string;
  orgId?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// MembershipTierRepository
// ---------------------------------------------------------------------------

export class MembershipTierRepository extends DatabaseRepository<
  MembershipTier,
  NewMembershipTier,
  MembershipTierFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, membershipTiers, logger);
  }

  protected buildWhereConditions(
    filters?: MembershipTierFilters,
  ): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.tenantId) {
      conditions.push(eq(membershipTiers.tenantId, filters.tenantId));
    }

    if (filters.status) {
      conditions.push(eq(membershipTiers.status, filters.status as any)); // SAFE: Drizzle enum narrowing
    }

    if (filters.name) {
      conditions.push(ilike(membershipTiers.name, `%${filters.name}%`));
    }

    if (filters.q) {
      conditions.push(
        or(
          ilike(membershipTiers.name, `%${filters.q}%`),
          ilike(membershipTiers.code, `%${filters.q}%`),
        )!,
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find a tier by its unique code within a tenant
   */
  async findByCode(
    tenantId: string,
    code: string,
  ): Promise<MembershipTier | null> {
    this.logger?.debug({ tenantId, code }, 'Finding membership tier by code');

    const [record] = await this.db
      .select()
      .from(membershipTiers)
      .where(
        and(
          eq(membershipTiers.tenantId, tenantId),
          eq(membershipTiers.code, code),
        ),
      )
      .limit(1);

    return (record as MembershipTier) || null;
  }
}

// ---------------------------------------------------------------------------
// MembershipRepository
// ---------------------------------------------------------------------------

export class MembershipRepository extends DatabaseRepository<
  Membership,
  NewMembership,
  MembershipFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, memberships, logger);
  }

  protected buildWhereConditions(
    filters?: MembershipFilters,
  ): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.tenantId) {
      conditions.push(eq(memberships.tenantId, filters.tenantId));
    }

    if (filters.orgId) {
      conditions.push(eq(memberships.orgId, filters.orgId));
    }

    if (filters.personId) {
      conditions.push(eq(memberships.personId, filters.personId));
    }

    if (filters.status) {
      conditions.push(eq(memberships.status, filters.status as any)); // SAFE: Drizzle enum narrowing
    }

    if (filters.tierId) {
      conditions.push(eq(memberships.tierId, filters.tierId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find a membership for a specific person in a specific organization
   */
  async findByPersonAndOrg(
    personId: string,
    orgId: string,
  ): Promise<Membership | null> {
    this.logger?.debug(
      { personId, orgId },
      'Finding membership by person and org',
    );

    const [record] = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.personId, personId),
          eq(memberships.orgId, orgId),
        ),
      )
      .limit(1);

    return (record as Membership) || null;
  }

  /**
   * Find all memberships for a person across all organizations
   */
  async findAllByPerson(personId: string): Promise<Membership[]> {
    this.logger?.debug({ personId }, 'Finding all memberships for person');

    const records = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.personId, personId));

    return records as Membership[];
  }
}

// ---------------------------------------------------------------------------
// MembershipApplicationRepository
// ---------------------------------------------------------------------------

export class MembershipApplicationRepository extends DatabaseRepository<
  MembershipApplication,
  NewMembershipApplication,
  MembershipApplicationFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, membershipApplications, logger);
  }

  protected buildWhereConditions(
    filters?: MembershipApplicationFilters,
  ): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.tenantId) {
      conditions.push(
        eq(membershipApplications.tenantId, filters.tenantId),
      );
    }

    if (filters.orgId) {
      conditions.push(eq(membershipApplications.orgId, filters.orgId));
    }

    if (filters.personId) {
      conditions.push(
        eq(membershipApplications.personId, filters.personId),
      );
    }

    if (filters.status) {
      conditions.push(
        eq(membershipApplications.status, filters.status as any), // SAFE: Drizzle enum narrowing
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// MembershipCategoryRepository
// ---------------------------------------------------------------------------

export class MembershipCategoryRepository extends DatabaseRepository<
  MembershipCategory,
  NewMembershipCategory,
  MembershipCategoryFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, membershipCategories, logger);
  }

  protected buildWhereConditions(
    filters?: MembershipCategoryFilters,
  ): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.tenantId) {
      conditions.push(
        eq(membershipCategories.tenantId, filters.tenantId),
      );
    }

    if (filters.orgId) {
      conditions.push(eq(membershipCategories.orgId, filters.orgId));
    }

    if (filters.name) {
      conditions.push(
        ilike(membershipCategories.name, `%${filters.name}%`),
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
