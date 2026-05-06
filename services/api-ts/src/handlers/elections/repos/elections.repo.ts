import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { elections, electionNominees, electionVotes, type Election, type NewElection, type ElectionNominee } from './elections.schema';

export class ElectionsRepository {
  constructor(private db: DatabaseInstance) {}

  async list(orgId: string, filters?: { status?: string; type?: string }) {
    const conditions: SQL<unknown>[] = [eq(elections.organizationId, orgId)];
    if (filters?.status) conditions.push(eq(elections.status, filters.status as any));
    if (filters?.type) conditions.push(eq(elections.type, filters.type as any));
    return this.db.select().from(elections).where(and(...conditions)).orderBy(desc(elections.createdAt));
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
    return this.db.select().from(electionNominees).where(eq(electionNominees.electionId, electionId));
  }

  async addNominee(data: { electionId: string; positionId: string; personId: string; nominatedBy: string }) {
    const [result] = await this.db.insert(electionNominees).values({ ...data, status: 'nominated' }).returning();
    return result!;
  }

  async updateNomineeStatus(id: string, status: string) {
    const [result] = await this.db.update(electionNominees).set({ status: status as any, updatedAt: new Date() }).where(eq(electionNominees.id, id)).returning();
    return result!;
  }

  async castVote(data: { electionId: string; positionId: string; nomineeId: string; voterId: string }) {
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
}
