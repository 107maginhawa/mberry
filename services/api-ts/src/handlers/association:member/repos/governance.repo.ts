/**
 * Repositories for governance module — positions and officer terms.
 */

import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import { positions, officerTerms, type NewPosition, type Position, type NewOfficerTerm, type OfficerTerm } from './governance.schema';

export class PositionRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewPosition): Promise<Position> {
    const [row] = await this.db.insert(positions).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<Position | undefined> {
    const [row] = await this.db.select().from(positions).where(eq(positions.id, id)).limit(1);
    return row;
  }

  async findByOrg(organizationId: string): Promise<Position[]> {
    return this.db.select().from(positions).where(eq(positions.organizationId, organizationId));
  }

  async update(id: string, data: Partial<Position>): Promise<Position | undefined> {
    const [row] = await this.db.update(positions).set({ ...data, updatedAt: new Date() }).where(eq(positions.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(positions).where(eq(positions.id, id));
  }
}

export class OfficerTermRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewOfficerTerm): Promise<OfficerTerm> {
    const [row] = await this.db.insert(officerTerms).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<OfficerTerm | undefined> {
    const [row] = await this.db.select().from(officerTerms).where(eq(officerTerms.id, id)).limit(1);
    return row;
  }

  async findByOrg(organizationId: string): Promise<OfficerTerm[]> {
    return this.db.select().from(officerTerms).where(eq(officerTerms.organizationId, organizationId));
  }

  async findActiveByPosition(positionId: string): Promise<OfficerTerm | undefined> {
    const [row] = await this.db.select().from(officerTerms)
      .where(and(eq(officerTerms.positionId, positionId), eq(officerTerms.status, 'active')))
      .limit(1);
    return row;
  }

  async findActiveByPersonAndOrg(personId: string, orgId: string): Promise<any[]> {
    const rows = await this.db
      .select({
        id: officerTerms.id,
        positionId: officerTerms.positionId,
        personId: officerTerms.personId,
        organizationId: officerTerms.organizationId,
        status: officerTerms.status,
        startDate: officerTerms.startDate,
        endDate: officerTerms.endDate,
        notes: officerTerms.notes,
        createdAt: officerTerms.createdAt,
        updatedAt: officerTerms.updatedAt,
        positionTitle: positions.title,
      })
      .from(officerTerms)
      .innerJoin(positions, eq(officerTerms.positionId, positions.id))
      .where(and(
        eq(officerTerms.personId, personId),
        eq(officerTerms.organizationId, orgId),
        eq(officerTerms.status, 'active'),
      ));
    return rows;
  }

  async update(id: string, data: Partial<OfficerTerm>): Promise<OfficerTerm | undefined> {
    const [row] = await this.db.update(officerTerms).set({ ...data, updatedAt: new Date() }).where(eq(officerTerms.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(officerTerms).where(eq(officerTerms.id, id));
  }
}
