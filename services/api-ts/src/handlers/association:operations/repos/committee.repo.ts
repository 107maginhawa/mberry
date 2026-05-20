import { eq, and, desc, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  committees,
  committeeMembers,
  type Committee,
  type NewCommittee,
  type CommitteeMember,
  type NewCommitteeMember,
} from './committee.schema';

export class CommitteeRepository {
  constructor(private db: DatabaseInstance) {}

  // ─── Committee CRUD ────────────────────────────────────

  async list(orgId: string): Promise<Committee[]> {
    return this.db
      .select()
      .from(committees)
      .where(eq(committees.organizationId, orgId))
      .orderBy(desc(committees.createdAt));
  }

  async get(id: string): Promise<Committee | undefined> {
    const [result] = await this.db
      .select()
      .from(committees)
      .where(eq(committees.id, id))
      .limit(1);
    return result;
  }

  async create(data: NewCommittee): Promise<Committee> {
    const [result] = await this.db.insert(committees).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<Committee>): Promise<Committee> {
    const [result] = await this.db
      .update(committees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(committees.id, id))
      .returning();
    return result!;
  }

  async dissolve(id: string, dissolvedBy: string, reason?: string): Promise<Committee> {
    const [result] = await this.db
      .update(committees)
      .set({
        status: 'completed',
        dissolvedAt: new Date(),
        dissolvedBy,
        dissolutionReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(committees.id, id))
      .returning();
    return result!;
  }

  // ─── Committee Members ─────────────────────────────────

  async listMembers(committeeId: string): Promise<CommitteeMember[]> {
    return this.db
      .select()
      .from(committeeMembers)
      .where(and(
        eq(committeeMembers.committeeId, committeeId),
        eq(committeeMembers.active, true),
      ))
      .orderBy(committeeMembers.assignedAt);
  }

  async addMember(data: NewCommitteeMember): Promise<CommitteeMember> {
    const [result] = await this.db.insert(committeeMembers).values(data).returning();
    return result!;
  }

  async removeMember(memberId: string): Promise<CommitteeMember> {
    const [result] = await this.db
      .update(committeeMembers)
      .set({ active: false, removedAt: new Date(), updatedAt: new Date() })
      .where(eq(committeeMembers.id, memberId))
      .returning();
    return result!;
  }

  async updateMemberRole(memberId: string, role: string): Promise<CommitteeMember> {
    const [result] = await this.db
      .update(committeeMembers)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(committeeMembers.id, memberId))
      .returning();
    return result!;
  }

  async findChairperson(committeeId: string): Promise<CommitteeMember | undefined> {
    const [result] = await this.db
      .select()
      .from(committeeMembers)
      .where(and(
        eq(committeeMembers.committeeId, committeeId),
        eq(committeeMembers.role, 'chairperson'),
        eq(committeeMembers.active, true),
      ))
      .limit(1);
    return result;
  }

  async getMember(committeeId: string, personId: string): Promise<CommitteeMember | undefined> {
    const [result] = await this.db
      .select()
      .from(committeeMembers)
      .where(and(
        eq(committeeMembers.committeeId, committeeId),
        eq(committeeMembers.personId, personId),
        eq(committeeMembers.active, true),
      ))
      .limit(1);
    return result;
  }
}
