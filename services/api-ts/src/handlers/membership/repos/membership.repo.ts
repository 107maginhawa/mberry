import { eq, and, or, ilike, desc, sql, notInArray, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { escapeLikePattern } from '@/utils/sanitize';
import {
  memberships,
  membershipCategories,
  membershipApplications,
  membershipTiers,
  type Membership,
  type NewMembership,
  type MembershipCategory,
  type NewMembershipCategory,
  type MembershipApplication,
  type NewMembershipApplication,
} from '../../association:member/repos/membership.schema';
import { persons } from '../../person/repos/person.schema';
// S-C4-015: cross-module references must resolve through canonical Drizzle
// schemas (no hardcoded table-name strings). Both schemas are co-located in
// existing module homes and used here only as references inside correlated
// subqueries — handler→handler imports are clean per audit IC-07.
import { duesInvoices } from '../../dues/repos/dues.schema';
import { creditEntries } from '../../association:member/repos/credits.schema';

// ── Module Boundary ─────────────────────────────────────────────────────
// Schema canonical home: association:member/repos/membership.schema.ts
// TypeSpec-generated repo: association:member/repos/membership.repo.ts
//   → Atomic CRUD via DatabaseRepository base class (used by TypeSpec handlers)
// This repo (hand-wired): rich JOIN queries (person data, categories),
//   search, pagination, officer/dues/compliance enrichment.
//   → Used by 9+ modules: invite, events, communication, association:member
// Both repos share the same schema — no data divergence.
// Preferred import: @/handlers/membership/repos/membership.repo
// ─────────────────────────────────────────────────────────────────────────

// organizationId is the canonical ID used for all org-scoped queries.
export class MembershipRepository {
  constructor(private db: DatabaseInstance) {}

  // ─── Members ──────────────────────────────────────────

  async listMembers(filters: {
    organizationId: string;
    status?: string;
    categoryId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: SQL<unknown>[] = [
      eq(memberships.organizationId, filters.organizationId),
    ];

    if (filters.status) conditions.push(eq(memberships.status, filters.status as Membership['status']));
    if (filters.categoryId) conditions.push(eq(memberships.categoryId, filters.categoryId));
    if (filters.search) {
      const escaped = escapeLikePattern(filters.search);
      conditions.push(or(
        ilike(persons.firstName, `%${escaped}%`),
        ilike(persons.lastName, `%${escaped}%`),
        ilike(memberships.memberNumber, `%${escaped}%`),
      )!);
    }

    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          membership: memberships,
          person: {
            id: persons.id,
            firstName: persons.firstName,
            lastName: persons.lastName,
            avatar: persons.avatar,
          },
          category: { id: membershipCategories.id, name: membershipCategories.name },
        })
        .from(memberships)
        .leftJoin(persons, eq(memberships.personId, persons.id))
        .leftJoin(membershipCategories, eq(memberships.categoryId, membershipCategories.id))
        .where(where)
        .orderBy(desc(memberships.joinedAt))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberships)
        .leftJoin(persons, eq(memberships.personId, persons.id))
        .where(where),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  /**
   * listMembersWithOfficerStatus (OPS-01, OPS-04)
   *
   * Returns the chapter roster enriched with per-member dues status and training
   * compliance in a single query — no N+1.
   *
   * - duesInvoiceStatus: latest invoice status from duesInvoices (correlated subquery)
   * - creditsEarned: SUM(creditAmount) for the active training cycle (correlated subquery)
   * - trainingCompliant: creditsEarned >= 40 (threshold per A1 assumption)
   *
   * Filters duesStatus and trainingCompliant are applied as WHERE clauses at DB level.
   */
  async listMembersWithOfficerStatus(filters: {
    organizationId: string;
    status?: string;
    categoryId?: string;
    search?: string;
    duesStatus?: string;
    trainingCompliant?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const TRAINING_THRESHOLD = 40;

    const conditions: SQL<unknown>[] = [
      eq(memberships.organizationId, filters.organizationId),
    ];

    if (filters.status) conditions.push(eq(memberships.status, filters.status as Membership['status']));
    if (filters.categoryId) conditions.push(eq(memberships.categoryId, filters.categoryId));
    if (filters.search) {
      const escaped = escapeLikePattern(filters.search);
      conditions.push(or(
        ilike(persons.firstName, `%${escaped}%`),
        ilike(persons.lastName, `%${escaped}%`),
        ilike(memberships.memberNumber, `%${escaped}%`),
      )!);
    }

    // OPS-04: DB-level filter by latest dues invoice status.
    // S-C4-015: schema references go through the duesInvoices Drizzle table,
    // not a hardcoded 'dues_invoice' string.
    const latestInvoiceStatusSql = sql<string | null>`(SELECT ${duesInvoices.status} FROM ${duesInvoices} WHERE ${duesInvoices.membershipId} = ${memberships.id}::text ORDER BY ${duesInvoices.createdAt} DESC LIMIT 1)`;
    if (filters.duesStatus !== undefined) {
      conditions.push(sql`${latestInvoiceStatusSql} = ${filters.duesStatus}`);
    }

    // OPS-04: DB-level filter by training compliance.
    // S-C4-015: schema references go through the creditEntries Drizzle table,
    // not a hardcoded 'credit_entry' string.
    const cycleCreditSumSql = sql<number>`COALESCE((SELECT SUM(${creditEntries.creditAmount}) FROM ${creditEntries} WHERE ${creditEntries.personId} = ${memberships.personId} AND ${creditEntries.organizationId} = ${memberships.organizationId} AND ${creditEntries.cycleStart} <= NOW() AND ${creditEntries.cycleEnd} >= NOW()), 0)`;
    if (filters.trainingCompliant === true) {
      conditions.push(sql`${cycleCreditSumSql} >= ${TRAINING_THRESHOLD}`);
    } else if (filters.trainingCompliant === false) {
      conditions.push(sql`${cycleCreditSumSql} < ${TRAINING_THRESHOLD}`);
    }

    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          membership: memberships,
          person: {
            id: persons.id,
            firstName: persons.firstName,
            lastName: persons.lastName,
            email: sql<string | null>`${persons.contactInfo}->>'email'`,
            avatar: persons.avatar,
          },
          category: { id: membershipCategories.id, name: membershipCategories.name },
          // OPS-01: correlated subquery for latest invoice status (no N+1).
          // S-C4-015: reuses the typed SQL fragment built above.
          duesInvoiceStatus: latestInvoiceStatusSql,
          // OPS-01: correlated subquery for total training credits in active cycle (no N+1).
          creditsEarned: cycleCreditSumSql,
          // Computed compliance flag.
          trainingCompliant: sql<boolean>`${cycleCreditSumSql} >= ${TRAINING_THRESHOLD}`,
        })
        .from(memberships)
        .leftJoin(persons, eq(memberships.personId, persons.id))
        .leftJoin(membershipCategories, eq(memberships.categoryId, membershipCategories.id))
        .where(where)
        .orderBy(desc(memberships.joinedAt))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberships)
        .leftJoin(persons, eq(memberships.personId, persons.id))
        .where(where),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async getMember(organizationId: string, personId: string) {
    const [result] = await this.db
      .select({
        membership: memberships,
        person: {
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          avatar: persons.avatar,
        },
        category: { id: membershipCategories.id, name: membershipCategories.name },
      })
      .from(memberships)
      .leftJoin(persons, eq(memberships.personId, persons.id))
      .leftJoin(membershipCategories, eq(memberships.categoryId, membershipCategories.id))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.personId, personId),
        ),
      )
      .limit(1);
    return result;
  }

  async addMember(data: NewMembership): Promise<Membership> {
    const [result] = await this.db.insert(memberships).values(data).returning();
    return result!;
  }

  async updateMember(id: string, data: Partial<Membership>): Promise<Membership> {
    const [result] = await this.db
      .update(memberships)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(memberships.id, id))
      .returning();
    return result!;
  }

  async bulkImportMembers(members: NewMembership[]): Promise<Membership[]> {
    if (members.length === 0) return [];
    return this.db.insert(memberships).values(members).returning();
  }

  // ─── Categories ───────────────────────────────────────

  async listCategories(organizationId: string): Promise<MembershipCategory[]> {
    return this.db
      .select()
      .from(membershipCategories)
      .where(eq(membershipCategories.organizationId, organizationId))
      .limit(100);
  }

  async upsertCategory(data: NewMembershipCategory): Promise<MembershipCategory> {
    // No unique constraint exists on (organizationId, name), so we use check-then-update
    // instead of onConflictDoUpdate to avoid a runtime constraint error.
    const [existing] = await this.db
      .select()
      .from(membershipCategories)
      .where(
        and(
          eq(membershipCategories.organizationId, data.organizationId),
          eq(membershipCategories.name, data.name),
        ),
      )
      .limit(1);

    if (existing) {
      const [result] = await this.db
        .update(membershipCategories)
        .set({
          description: data.description,
          applicableTiers: data.applicableTiers,
          updatedAt: new Date(),
        })
        .where(eq(membershipCategories.id, existing.id))
        .returning();
      return result!;
    }

    const [result] = await this.db
      .insert(membershipCategories)
      .values(data)
      .returning();
    return result!;
  }

  async getMemberById(membershipId: string) {
    const [result] = await this.db
      .select({
        membership: memberships,
        person: {
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
          avatar: persons.avatar,
        },
        category: { id: membershipCategories.id, name: membershipCategories.name },
      })
      .from(memberships)
      .leftJoin(persons, eq(memberships.personId, persons.id))
      .leftJoin(membershipCategories, eq(memberships.categoryId, membershipCategories.id))
      .where(eq(memberships.id, membershipId))
      .limit(1);
    return result;
  }

  async getMemberCountByCategory(categoryId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(memberships)
      .where(eq(memberships.categoryId, categoryId));
    return result?.count ?? 0;
  }

  // ─── Applications ─────────────────────────────────────

  async listApplications(organizationId: string, status?: string) {
    const conditions: SQL<unknown>[] = [
      eq(membershipApplications.organizationId, organizationId),
    ];
    if (status) conditions.push(eq(membershipApplications.status, status as MembershipApplication['status']));

    return this.db
      .select({
        application: membershipApplications,
        person: {
          id: persons.id,
          firstName: persons.firstName,
          lastName: persons.lastName,
        },
      })
      .from(membershipApplications)
      .leftJoin(persons, eq(membershipApplications.personId, persons.id))
      .where(and(...conditions))
      .orderBy(membershipApplications.createdAt);
  }

  async reviewApplication(
    id: string,
    status: string,
    reviewerId: string,
    reason?: string,
  ): Promise<MembershipApplication> {
    const [result] = await this.db
      .update(membershipApplications)
      .set({
        status: status as MembershipApplication['status'],
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        denialReason: status === 'denied' ? reason : undefined,
        updatedAt: new Date(),
      })
      .where(eq(membershipApplications.id, id))
      .returning();
    return result!;
  }
}

// ── Port adapter (S-C4-014) ─────────────────────────────────────────────
// org-context middleware previously issued raw `db.select().from(memberships)`
// queries. This adapter keeps the SQL co-located with the membership module
// and exposes only the narrow lookup middleware needs.

import type {
  MembershipPort,
  ActiveMembership,
} from '@/core/ports/membership.port';

export function membershipRepoPort(db: DatabaseInstance): MembershipPort {
  return {
    async findActiveMembershipByPersonAndOrg(
      personId: string,
      orgId: string,
    ): Promise<ActiveMembership | undefined> {
      const [row] = await db
        .select({
          id: memberships.id,
          personId: memberships.personId,
          organizationId: memberships.organizationId,
          status: memberships.status,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.personId, personId),
            eq(memberships.organizationId, orgId),
            // BR-01: status is computed at query time from duesExpiryDate.
            // Allow all statuses except permanently removed members.
            notInArray(memberships.status, ['removed', 'expelled', 'deceased']),
          ),
        )
        .limit(1);
      if (!row) return undefined;
      return {
        membershipId: row.id,
        personId: row.personId,
        organizationId: row.organizationId,
        status: row.status,
      };
    },
  };
}
