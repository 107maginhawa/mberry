/**
 * Repositories for platform administration module.
 */

import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import {
  associations, organizations, featureFlags, platformAdmins, impersonationSessions,
  type NewAssociation, type Association,
  type NewOrganization, type Organization,
  type NewFeatureFlag, type FeatureFlag,
  type NewPlatformAdmin, type PlatformAdmin,
  type NewImpersonationSession, type ImpersonationSession,
} from './platform-admin.schema';

export class AssociationRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewAssociation): Promise<Association> {
    const [row] = await this.db.insert(associations).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<Association | undefined> {
    const [row] = await this.db.select().from(associations).where(eq(associations.id, id)).limit(1);
    return row;
  }

  async findByName(name: string): Promise<Association | undefined> {
    const [row] = await this.db.select().from(associations).where(eq(associations.name, name)).limit(1);
    return row;
  }

  async findAll(): Promise<Association[]> {
    return this.db.select().from(associations).limit(100);
  }

  async update(id: string, data: Partial<Association>): Promise<Association | undefined> {
    const [row] = await this.db.update(associations).set({ ...data, updatedAt: new Date() }).where(eq(associations.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(associations).where(eq(associations.id, id));
  }
}

export class OrganizationRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewOrganization): Promise<Organization> {
    const [row] = await this.db.insert(organizations).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<Organization | undefined> {
    const [row] = await this.db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return row;
  }

  async findByAssociation(associationId: string): Promise<Organization[]> {
    return this.db.select().from(organizations).where(eq(organizations.associationId, associationId)).limit(100);
  }

  async findByNameInAssociation(name: string, associationId: string): Promise<Organization | undefined> {
    const [row] = await this.db.select().from(organizations)
      .where(and(eq(organizations.name, name), eq(organizations.associationId, associationId)))
      .limit(1);
    return row;
  }

  async findAll(status?: string): Promise<Organization[]> {
    if (status) {
      return this.db.select().from(organizations).where(eq(organizations.status, status as Organization['status'])).limit(100);
    }
    return this.db.select().from(organizations).limit(100);
  }

  async findBySlug(slug: string): Promise<Organization | undefined> {
    const [row] = await this.db.select().from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return row;
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization | undefined> {
    const [row] = await this.db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
    return row;
  }
}

export class FeatureFlagRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async upsert(data: NewFeatureFlag): Promise<FeatureFlag> {
    // Try to find existing
    const existing = await this.db.select().from(featureFlags)
      .where(and(
        eq(featureFlags.targetType, data.targetType),
        eq(featureFlags.targetId, data.targetId),
        eq(featureFlags.moduleName, data.moduleName),
      ))
      .limit(1);

    if (existing[0]) {
      const [row] = await this.db.update(featureFlags)
        .set({ enabled: data.enabled, updatedAt: new Date() })
        .where(eq(featureFlags.id, existing[0].id))
        .returning();
      return row!;
    }

    const [row] = await this.db.insert(featureFlags).values(data).returning();
    return row!;
  }

  async findByTarget(targetType?: string, targetId?: string): Promise<FeatureFlag[]> {
    const conditions = [];
    if (targetType) conditions.push(eq(featureFlags.targetType, targetType));
    if (targetId) conditions.push(eq(featureFlags.targetId, targetId));
    if (conditions.length === 0) return this.db.select().from(featureFlags).limit(100);
    return this.db.select().from(featureFlags).where(and(...conditions)).limit(100);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(featureFlags).where(eq(featureFlags.id, id));
  }

  async findById(id: string): Promise<FeatureFlag | undefined> {
    const [row] = await this.db.select().from(featureFlags).where(eq(featureFlags.id, id)).limit(1);
    return row;
  }
}

export class PlatformAdminRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewPlatformAdmin): Promise<PlatformAdmin> {
    const [row] = await this.db.insert(platformAdmins).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<PlatformAdmin | undefined> {
    const [row] = await this.db.select().from(platformAdmins).where(eq(platformAdmins.id, id)).limit(1);
    return row;
  }

  async findByEmail(email: string): Promise<PlatformAdmin | undefined> {
    const [row] = await this.db.select().from(platformAdmins).where(eq(platformAdmins.email, email.toLowerCase())).limit(1);
    return row;
  }

  async findByUserId(userId: string): Promise<PlatformAdmin | undefined> {
    const [row] = await this.db.select().from(platformAdmins).where(eq(platformAdmins.userId, userId)).limit(1);
    return row;
  }

  async findAll(): Promise<PlatformAdmin[]> {
    return this.db.select().from(platformAdmins).limit(100);
  }

  async update(id: string, data: Partial<PlatformAdmin>): Promise<PlatformAdmin | undefined> {
    const [row] = await this.db.update(platformAdmins).set({ ...data, updatedAt: new Date() }).where(eq(platformAdmins.id, id)).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(platformAdmins).where(eq(platformAdmins.id, id));
  }

  async countByRole(role: string): Promise<number> {
    const rows = await this.db.select().from(platformAdmins).where(eq(platformAdmins.role, role as PlatformAdmin['role'])).limit(1000);
    return rows.length;
  }
}

export class ImpersonationSessionRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  async create(data: NewImpersonationSession): Promise<ImpersonationSession> {
    const [row] = await this.db.insert(impersonationSessions).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<ImpersonationSession | undefined> {
    const [row] = await this.db.select().from(impersonationSessions).where(eq(impersonationSessions.id, id)).limit(1);
    return row;
  }

  async findByToken(token: string): Promise<ImpersonationSession | undefined> {
    const [row] = await this.db.select().from(impersonationSessions)
      .where(eq(impersonationSessions.sessionToken, token))
      .limit(1);
    return row;
  }

  async end(id: string): Promise<ImpersonationSession | undefined> {
    const [row] = await this.db.update(impersonationSessions)
      .set({ endedAt: new Date(), updatedAt: new Date() })
      .where(eq(impersonationSessions.id, id))
      .returning();
    return row;
  }
}
