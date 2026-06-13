/**
 * MemberAdOptOutRepository - Data access for member ad opt-out preferences (M16-R4)
 *
 * Persists the member_ad_opt_out table so opt-out is durable and enforced
 * server-side at ad-serve time (AHA FIX-008 / G-02). One row per
 * (organizationId, personId) means "opted out"; absence means "opted in".
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  memberAdOptOuts,
  type MemberAdOptOut,
  type NewMemberAdOptOut,
} from './advertising.schema';

export interface MemberAdOptOutFilters {
  organizationId?: string;
  personId?: string;
}

export class MemberAdOptOutRepository extends DatabaseRepository<
  MemberAdOptOut,
  NewMemberAdOptOut,
  MemberAdOptOutFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, memberAdOptOuts, logger);
  }

  protected buildWhereConditions(filters?: MemberAdOptOutFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.organizationId) {
      conditions.push(eq(memberAdOptOuts.organizationId, filters.organizationId));
    }
    if (filters.personId) {
      conditions.push(eq(memberAdOptOuts.personId, filters.personId));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Server-side opt-out check (AC-M16-004). Source of truth for ad serving —
   * never trust a client-supplied flag.
   */
  async isOptedOut(organizationId: string, personId: string): Promise<boolean> {
    const row = await this.findOne({ organizationId, personId });
    return !!row;
  }

  /**
   * Idempotent opt-out: persist a row if the member is not already opted out.
   */
  async optOut(organizationId: string, personId: string, actorId?: string): Promise<void> {
    const existing = await this.findOne({ organizationId, personId });
    if (existing) return;
    await this.createOne({
      organizationId,
      personId,
      createdBy: actorId ?? personId,
      updatedBy: actorId ?? personId,
    } as NewMemberAdOptOut);
  }

  /**
   * Idempotent opt-in: remove the opt-out row if present (M16-R4: re-enabling
   * targeting deletes the opt-out record).
   */
  async optIn(organizationId: string, personId: string): Promise<void> {
    const existing = await this.findOne({ organizationId, personId });
    if (existing) {
      await this.deleteOneById((existing as MemberAdOptOut & { id: string }).id);
    }
  }
}
