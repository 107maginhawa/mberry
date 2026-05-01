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

  async findByOrg(tenantId: string, orgId?: string): Promise<Position[]> {
    const conditions = [eq(positions.tenantId, tenantId)];
    if (orgId) conditions.push(eq(positions.organizationId, orgId));
    return this.db.select().from(positions).where(and(...conditions));
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

  async findByOrg(tenantId: string, orgId?: string): Promise<OfficerTerm[]> {
    const conditions = [eq(officerTerms.tenantId, tenantId)];
    if (orgId) conditions.push(eq(officerTerms.organizationId, orgId));
    return this.db.select().from(officerTerms).where(and(...conditions));
  }

  async findActiveByPosition(positionId: string): Promise<OfficerTerm | undefined> {
    const [row] = await this.db.select().from(officerTerms)
      .where(and(eq(officerTerms.positionId, positionId), eq(officerTerms.status, 'active')))
      .limit(1);
    return row;
  }

  async update(id: string, data: Partial<OfficerTerm>): Promise<OfficerTerm | undefined> {
    const [row] = await this.db.update(officerTerms).set({ ...data, updatedAt: new Date() }).where(eq(officerTerms.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(officerTerms).where(eq(officerTerms.id, id));
  }
}
