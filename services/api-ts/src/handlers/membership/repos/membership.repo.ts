import { eq, and, or, like, desc, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  memberships, membershipCategories, membershipApplications,
  type Membership, type NewMembership,
  type MembershipCategory, type NewMembershipCategory,
  type MembershipApplication,
} from './membership.schema';
import { persons } from '../../person/repos/person.schema';

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
    const conditions: SQL<unknown>[] = [eq(memberships.organizationId, filters.organizationId)];

    if (filters.status) conditions.push(eq(memberships.status, filters.status as any));
    if (filters.categoryId) conditions.push(eq(memberships.categoryId, filters.categoryId));
    if (filters.search) {
      conditions.push(or(
        like(persons.displayName, `%${filters.search}%`),
        like(persons.email, `%${filters.search}%`),
        like(memberships.licenseNumber, `%${filters.search}%`),
      )!);
    }

    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          membership: memberships,
          person: { id: persons.id, displayName: persons.displayName, email: persons.email, image: persons.image },
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
        person: { id: persons.id, displayName: persons.displayName, email: persons.email, image: persons.image },
        category: { id: membershipCategories.id, name: membershipCategories.name },
      })
      .from(memberships)
      .leftJoin(persons, eq(memberships.personId, persons.id))
      .leftJoin(membershipCategories, eq(memberships.categoryId, membershipCategories.id))
      .where(and(eq(memberships.organizationId, organizationId), eq(memberships.personId, personId)))
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
      .orderBy(membershipCategories.sortOrder);
  }

  async upsertCategory(data: NewMembershipCategory): Promise<MembershipCategory> {
    const [result] = await this.db
      .insert(membershipCategories)
      .values(data)
      .onConflictDoUpdate({
        target: [membershipCategories.organizationId, membershipCategories.name],
        set: {
          description: data.description,
          duesAmount: data.duesAmount,
          billingCycle: data.billingCycle,
          sortOrder: data.sortOrder,
          active: data.active,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result!;
  }

  async deactivateCategory(id: string): Promise<MembershipCategory> {
    const [result] = await this.db
      .update(membershipCategories)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(membershipCategories.id, id))
      .returning();
    return result!;
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
    const conditions: SQL<unknown>[] = [eq(membershipApplications.organizationId, organizationId)];
    if (status) conditions.push(eq(membershipApplications.status, status as any));

    return this.db
      .select({
        application: membershipApplications,
        person: { id: persons.id, displayName: persons.displayName, email: persons.email },
      })
      .from(membershipApplications)
      .leftJoin(persons, eq(membershipApplications.personId, persons.id))
      .where(and(...conditions))
      .orderBy(membershipApplications.createdAt);
  }

  async reviewApplication(id: string, status: string, reviewerId: string, reason?: string): Promise<MembershipApplication> {
    const [result] = await this.db
      .update(membershipApplications)
      .set({
        status: status as any,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: status === 'rejected' ? reason : undefined,
        infoRequestMessage: status === 'info_requested' ? reason : undefined,
        updatedAt: new Date(),
      })
      .where(eq(membershipApplications.id, id))
      .returning();
    return result!;
  }
}
