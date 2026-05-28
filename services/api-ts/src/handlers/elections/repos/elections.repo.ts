import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { elections, electionNominees, electionVotes, type Election, type NewElection, type ElectionNominee } from './elections.schema';

export class ElectionsRepository {
  constructor(private db: DatabaseInstance) {}

  async list(orgId: string, filters?: { status?: string; type?: string; limit?: number; offset?: number }) {
    const conditions: SQL<unknown>[] = [eq(elections.organizationId, orgId)];
    if (filters?.status) conditions.push(eq(elections.status, filters.status as Election['status']));
    if (filters?.type) conditions.push(eq(elections.type, filters.type as Election['type']));
    const limit = filters?.limit ?? 25;
    const offset = filters?.offset ?? 0;
    return this.db.select().from(elections)
      .where(and(...conditions))
      .orderBy(desc(elections.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async get(id: string): Promise<Election | undefined> {
    const [election] = await this.db.select().from(elections).where(eq(elections.id, id)).limit(1);
    return election;
  }

  async create(data: NewElection): Promise<Election> {
    const [result] = await this.db.insert(elections).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<Election>): Promise<Election> {
    const [result] = await this.db.update(elections).set({ ...data, updatedAt: new Date() }).where(eq(elections.id, id)).returning();
    return result!;
  }

  async listNominees(electionId: string): Promise<ElectionNominee[]> {
    return this.db.select().from(electionNominees).where(eq(electionNominees.electionId, electionId)).limit(100);
  }

  async addNominee(data: { electionId: string; positionId: string; personId: string; nominatedBy: string; organizationId: string }) {
    const [result] = await this.db.insert(electionNominees).values({ ...data, status: 'nominated' }).returning();
    return result!;
  }

  async updateNomineeStatus(id: string, status: string) {
    const [result] = await this.db.update(electionNominees).set({ status: status as ElectionNominee['status'], updatedAt: new Date() }).where(eq(electionNominees.id, id)).returning();
    return result!;
  }

  async getNominee(id: string): Promise<ElectionNominee | undefined> {
    const [nominee] = await this.db.select().from(electionNominees).where(eq(electionNominees.id, id)).limit(1);
    return nominee;
  }

  async castVote(data: { electionId: string; positionId: string; nomineeId: string; voterId: string; organizationId: string }) {
    const [result] = await this.db.insert(electionVotes).values(data).returning();
    return result!;
  }

  async hasVoted(electionId: string, voterId: string, positionId: string): Promise<boolean> {
    const [existing] = await this.db.select().from(electionVotes).where(and(eq(electionVotes.electionId, electionId), eq(electionVotes.voterId, voterId), eq(electionVotes.positionId, positionId))).limit(1);
    return !!existing;
  }

  async getVoteTallies(electionId: string) {
    return this.db.select({
      positionId: electionVotes.positionId,
      nomineeId: electionVotes.nomineeId,
      count: sql<number>`count(*)::int`,
    }).from(electionVotes).where(eq(electionVotes.electionId, electionId)).groupBy(electionVotes.positionId, electionVotes.nomineeId);
  }

  async getVoterCount(electionId: string): Promise<number> {
    const [result] = await this.db.select({ count: sql<number>`count(DISTINCT ${electionVotes.voterId})::int` }).from(electionVotes).where(eq(electionVotes.electionId, electionId));
    return result?.count ?? 0;
  }

  /** Count nominees per position for an election (for min-candidate validation) */
  async countNomineesByPosition(electionId: string): Promise<Array<{ positionId: string; count: number }>> {
    return this.db
      .select({
        positionId: electionNominees.positionId,
        count: sql<number>`count(*)::int`,
      })
      .from(electionNominees)
      .where(and(
        eq(electionNominees.electionId, electionId),
        eq(electionNominees.status, 'nominated'),
      ))
      .groupBy(electionNominees.positionId);
  }

  /** Withdraw all non-terminal nominees when election is cancelled */
  async withdrawAllNominees(electionId: string): Promise<number> {
    const terminalStatuses = ['declined', 'elected'];
    const result = await this.db
      .update(electionNominees)
      .set({ status: 'declined' as ElectionNominee['status'], updatedAt: new Date() })
      .where(and(
        eq(electionNominees.electionId, electionId),
        sql`${electionNominees.status} NOT IN (${sql.join(terminalStatuses.map(s => sql`${s}`), sql`, `)})`,
      ))
      .returning();
    return result.length;
  }

  /** Void all votes cast for a specific nominee (BR-33: removed candidate vote voiding) */
  async voidVotesForNominee(electionId: string, nomineeId: string): Promise<number> {
    const result = await this.db
      .delete(electionVotes)
      .where(and(
        eq(electionVotes.electionId, electionId),
        eq(electionVotes.nomineeId, nomineeId),
      ))
      .returning();
    return result.length;
  }
}
