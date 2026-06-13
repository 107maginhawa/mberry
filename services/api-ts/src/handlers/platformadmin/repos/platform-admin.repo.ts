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

// ── Port adapters (S-C4-014) ────────────────────────────────────────────
// Hexagonal adapters that expose only the slice of these repos consumed
// by core/middleware. Interfaces live at core/ports/platform-admin.port.ts;
// middleware reaches them through core/ports/index.ts.

import type {
  PlatformAdminPort,
  PlatformAdminRecord,
  ImpersonationPort,
  ImpersonationSessionRecord,
} from '@/core/ports/platform-admin.port';
import type { FeatureFlagPort, FeatureFlagRow } from '@/core/ports/feature-flag.port';
import { inArray } from 'drizzle-orm';

export function platformAdminRepoPort(db: NodePgDatabase): PlatformAdminPort {
  const repo = new PlatformAdminRepository(db);
  return {
    async findByUserId(userId: string): Promise<PlatformAdminRecord | undefined> {
      const row = await repo.findByUserId(userId);
      if (!row) return undefined;
      // Pass through the full record (see port doc). The cast is safe:
      // PlatformAdmin is a plain JSON-like object with known id/userId/role.
      return row as unknown as PlatformAdminRecord;
    },
  };
}

export function impersonationRepoPort(
  db: NodePgDatabase,
  logger?: Logger,
): ImpersonationPort {
  const repo = new ImpersonationSessionRepository(db, logger);
  return {
    async findByToken(token: string): Promise<ImpersonationSessionRecord | undefined> {
      const row = await repo.findByToken(token);
      if (!row) return undefined;
      return {
        id: row.id,
        adminId: row.adminId,
        targetUserId: row.targetUserId,
        targetOrgId: row.targetOrgId,
        sessionToken: row.sessionToken,
        endedAt: row.endedAt,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      };
    },
  };
}

/**
 * Feature-flag enforcement adapter (AHA FIX-009 / G2).
 *
 * Resolves every flag row that could decide enforcement of `moduleName` for
 * an org: the org's own rows, plus the org's association rows, plus the org's
 * subscription-tier rows. The gate (middleware/feature-flag-gate.ts) applies
 * precedence over the returned set; this adapter only fetches.
 *
 * Resolution is best-effort: association/tier lookups are wrapped so a missing
 * org or subscription simply narrows the candidate set rather than throwing —
 * the gate then decides from whatever rows resolve (fail-open when none).
 */
export function featureFlagRepoPort(db: NodePgDatabase): FeatureFlagPort {
  return {
    async findEnforcementFlags(orgId: string, moduleName: string): Promise<FeatureFlagRow[]> {
      // Candidate (targetType, targetId) pairs. Org is always a candidate.
      const targetIds: string[] = [orgId];

      // Resolve the org's association so association-scoped flags apply.
      const [org] = await db
        .select({ associationId: organizations.associationId })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      if (org?.associationId) targetIds.push(org.associationId);

      // Resolve the org's active subscription tier slug so tier flags apply.
      try {
        const { subscriptions, pricingTiers } = await import('./platform-admin.schema');
        const [sub] = await db
          .select({ tierId: subscriptions.pricingTierId })
          .from(subscriptions)
          .where(eq(subscriptions.organizationId, orgId))
          .limit(1);
        if (sub?.tierId) {
          const [tier] = await db
            .select({ slug: pricingTiers.slug })
            .from(pricingTiers)
            .where(eq(pricingTiers.id, sub.tierId))
            .limit(1);
          if (tier?.slug) targetIds.push(tier.slug);
        }
      } catch {
        // Tier resolution is best-effort; absence just narrows candidates.
      }

      const rows = await db
        .select()
        .from(featureFlags)
        .where(and(eq(featureFlags.moduleName, moduleName), inArray(featureFlags.targetId, targetIds)));

      return rows.map((r) => ({
        targetType: r.targetType,
        targetId: r.targetId,
        moduleName: r.moduleName,
        enabled: r.enabled,
        isOverride: r.isOverride,
      }));
    },
  };
}
