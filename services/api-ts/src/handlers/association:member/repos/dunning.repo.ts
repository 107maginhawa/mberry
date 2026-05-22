/**
 * Dunning Repositories — Data access layer for dunning templates and events
 * Encapsulates all database operations for dues reminder escalation workflows
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  dunningTemplates,
  dunningEvents,
  type DunningTemplate,
  type NewDunningTemplate,
  type DunningEvent,
  type NewDunningEvent,
} from './dunning.schema';

// ---------------------------------------------------------------------------
// DunningTemplateRepository
// ---------------------------------------------------------------------------

export interface DunningTemplateFilters {
  organizationId?: string;
  stage?: number;
  channel?: 'email' | 'sms' | 'letter';
  status?: 'active' | 'inactive';
}

export class DunningTemplateRepository extends DatabaseRepository<DunningTemplate, NewDunningTemplate, DunningTemplateFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dunningTemplates, logger);
  }

  protected buildWhereConditions(filters?: DunningTemplateFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(dunningTemplates.organizationId, filters.organizationId));
    }

    if (filters.stage !== undefined) {
      conditions.push(eq(dunningTemplates.stage, filters.stage));
    }

    if (filters.channel) {
      conditions.push(eq(dunningTemplates.channel, filters.channel));
    }

    if (filters.status) {
      conditions.push(eq(dunningTemplates.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find active templates by stage for an organization (used by runDunning)
   */
  async findByStage(organizationId: string, stage: number): Promise<DunningTemplate[]> {
    return this.findMany({
      organizationId,
      stage,
      status: 'active',
    });
  }
}

// ---------------------------------------------------------------------------
// DunningEventRepository
// ---------------------------------------------------------------------------

export interface DunningEventFilters {
  membershipId?: string;
  personId?: string;
  templateId?: string;
  stage?: number;
  organizationId?: string;
}

export class DunningEventRepository extends DatabaseRepository<DunningEvent, NewDunningEvent, DunningEventFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dunningEvents, logger);
  }

  protected buildWhereConditions(filters?: DunningEventFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.membershipId) {
      conditions.push(eq(dunningEvents.membershipId, filters.membershipId));
    }

    if (filters.personId) {
      conditions.push(eq(dunningEvents.personId, filters.personId));
    }

    if (filters.templateId) {
      conditions.push(eq(dunningEvents.templateId, filters.templateId));
    }

    if (filters.stage !== undefined) {
      conditions.push(eq(dunningEvents.stage, filters.stage));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Log a dunning event (convenience wrapper for createOne)
   */
  async logDunningEvent(event: NewDunningEvent): Promise<DunningEvent> {
    return this.createOne(event);
  }
}
