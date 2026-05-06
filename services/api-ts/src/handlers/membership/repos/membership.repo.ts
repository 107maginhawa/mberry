import { eq, and, or, like, ilike, desc, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
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

    if (filters.status) conditions.push(eq(memberships.status, filters.status as any));
    if (filters.categoryId) conditions.push(eq(memberships.categoryId, filters.categoryId));
    if (filters.search) {
      conditions.push(or(
        ilike(persons.firstName, `%${filters.search}%`),
        ilike(persons.lastName, `%${filters.search}%`),
        ilike(memberships.memberNumber, `%${filters.search}%`),
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
      .where(eq(membershipCategories.organizationId, organizationId));
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
    if (status) conditions.push(eq(membershipApplications.status, status as any));

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
        status: status as any,
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
