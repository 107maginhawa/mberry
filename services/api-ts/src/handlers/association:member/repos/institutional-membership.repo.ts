/**
 * Institutional membership repositories — data access layer
 * Encapsulates all database operations for institutional memberships and seat allocations
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginatedResult, type PaginationOptions } from '@/core/database.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import {
  institutionalMemberships,
  seatAllocations,
  type InstitutionalMembership,
  type NewInstitutionalMembership,
  type SeatAllocation,
  type NewSeatAllocation,
} from './institutional-membership.schema';

// ---------------------------------------------------------------------------
// Filter interfaces
// ---------------------------------------------------------------------------

export interface InstitutionalMembershipFilters {
  organizationId?: string;
  parentOrganizationId?: string;
  status?: string;
  tierId?: string;
}

export interface SeatAllocationFilters {
  institutionalMembershipId?: string;
  personId?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// InstitutionalMembershipRepository
// ---------------------------------------------------------------------------

export class InstitutionalMembershipRepository extends DatabaseRepository<
  InstitutionalMembership,
  NewInstitutionalMembership,
  InstitutionalMembershipFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, institutionalMemberships, logger);
  }

  protected buildWhereConditions(
    filters?: InstitutionalMembershipFilters,
  ): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.organizationId) {
      conditions.push(eq(institutionalMemberships.organizationId, filters.organizationId));
    }

    if (filters.parentOrganizationId) {
      conditions.push(eq(institutionalMemberships.parentOrganizationId, filters.parentOrganizationId));
    }

    if (filters.status) {
      conditions.push(eq(institutionalMemberships.status, filters.status as InstitutionalMembership['status']));
    }

    if (filters.tierId) {
      conditions.push(eq(institutionalMemberships.tierId, filters.tierId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Increment usedSeats by 1. Returns updated record.
   * Throws BusinessLogicError if usedSeats >= totalSeats.
   */
  async incrementUsedSeats(id: string): Promise<InstitutionalMembership> {
    this.logger?.debug({ id }, 'Incrementing used seats');

    const [updated] = await this.db
      .update(institutionalMemberships)
      .set({
        usedSeats: sql`${institutionalMemberships.usedSeats} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(institutionalMemberships.id, id),
          sql`${institutionalMemberships.usedSeats} < ${institutionalMemberships.totalSeats}`,
        ),
      )
      .returning();

    if (!updated) {
      // Check if record exists to differentiate not-found vs seats-full
      const existing = await this.findOneById(id);
      if (!existing) throw new NotFoundError('Institutional membership');
      throw new BusinessLogicError('No available seats', 'SEATS_FULL');
    }

    return updated as InstitutionalMembership;
  }

  /**
   * Decrement usedSeats by 1. Returns updated record.
   * Guards against going below 0.
   */
  async decrementUsedSeats(id: string): Promise<InstitutionalMembership> {
    this.logger?.debug({ id }, 'Decrementing used seats');

    const [updated] = await this.db
      .update(institutionalMemberships)
      .set({
        usedSeats: sql`GREATEST(${institutionalMemberships.usedSeats} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(institutionalMemberships.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError('Institutional membership');
    }

    return updated as InstitutionalMembership;
  }
}

// ---------------------------------------------------------------------------
// SeatAllocationRepository
// ---------------------------------------------------------------------------

export class SeatAllocationRepository extends DatabaseRepository<
  SeatAllocation,
  NewSeatAllocation,
  SeatAllocationFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, seatAllocations, logger);
  }

  protected buildWhereConditions(
    filters?: SeatAllocationFilters,
  ): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.institutionalMembershipId) {
      conditions.push(eq(seatAllocations.institutionalMembershipId, filters.institutionalMembershipId));
    }

    if (filters.personId) {
      conditions.push(eq(seatAllocations.personId, filters.personId));
    }

    if (filters.status) {
      conditions.push(eq(seatAllocations.status, filters.status as SeatAllocation['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find an active seat allocation for a specific person within an institutional membership.
   * Used to prevent double-allocation.
   */
  async findActiveByMembershipAndPerson(
    institutionalMembershipId: string,
    personId: string,
  ): Promise<SeatAllocation | null> {
    const [record] = await this.db
      .select()
      .from(seatAllocations)
      .where(
        and(
          eq(seatAllocations.institutionalMembershipId, institutionalMembershipId),
          eq(seatAllocations.personId, personId),
          eq(seatAllocations.status, 'active'),
        ),
      )
      .limit(1);

    return (record as SeatAllocation) || null;
  }

  /**
   * Revoke all active seat allocations for a given institutional membership.
   * Used during soft-delete of institutional membership.
   * Returns count of revoked allocations.
   */
  async revokeAllActive(institutionalMembershipId: string): Promise<number> {
    this.logger?.debug({ institutionalMembershipId }, 'Revoking all active seat allocations');

    const now = new Date();
    const result = await this.db
      .update(seatAllocations)
      .set({
        status: 'revoked',
        revokedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(seatAllocations.institutionalMembershipId, institutionalMembershipId),
          eq(seatAllocations.status, 'active'),
        ),
      )
      .returning();

    return result.length;
  }
}
