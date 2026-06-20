/**
 * Repository for surveys module - database operations
 */

import { and, eq, sql, gt, lt, count, inArray, type SQL } from 'drizzle-orm';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import {
  surveys,
  surveyResponses,
  type Survey,
  type NewSurvey,
  type SurveyResponseRecord,
  type NewSurveyResponse,
  type SurveyAnalyticsSnapshot,
  type QuestionAnswer,
} from './survey.schema';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface SurveyFilters {
  organizationId?: string;
  status?: string;
  surveyType?: string;
  createdBy?: string;
}

export interface SurveyResponseFilters {
  organizationId?: string;
  surveyId?: string;
  responderId?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// SurveyRepository
// ---------------------------------------------------------------------------

export class SurveyRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  private buildWhereConditions(filters?: SurveyFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions: SQL<unknown>[] = [];

    if (filters.organizationId) {
      conditions.push(eq(surveys.organizationId, filters.organizationId));
    }
    if (filters.status) {
      conditions.push(eq(surveys.status, filters.status));
    }
    if (filters.surveyType) {
      conditions.push(eq(surveys.surveyType, filters.surveyType));
    }
    if (filters.createdBy) {
      conditions.push(eq(surveys.createdBy, filters.createdBy));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async findById(id: string): Promise<Survey | undefined> {
    const [row] = await this.db
      .select()
      .from(surveys)
      .where(eq(surveys.id, id))
      .limit(1);
    return row;
  }

  async findManyWithPagination(
    filters: SurveyFilters,
    opts: { pagination: { limit: number; offset: number } }
  ): Promise<{ data: Survey[]; totalCount: number }> {
    const where = this.buildWhereConditions(filters);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(surveys)
        .where(where)
        .limit(opts.pagination.limit)
        .offset(opts.pagination.offset)
        .orderBy(surveys.createdAt),
      this.db
        .select({ count: count() })
        .from(surveys)
        .where(where),
    ]);

    return { data, totalCount: Number(countResult[0]?.count ?? 0) };
  }

  async findMineWithPagination(
    organizationId: string | undefined,
    responderId: string,
    opts: { pagination: { limit: number; offset: number } }
  ): Promise<{ data: Array<Survey & { myResponseStatus: string; myCompletedAt: Date | null }>; totalCount: number }> {
    // responderId is the member-scoping boundary; org is an optional narrowing
    // filter (omitted when no org context is present on the request).
    const conditions: SQL<unknown>[] = [eq(surveyResponses.responderId, responderId)];
    if (organizationId) {
      conditions.push(eq(surveys.organizationId, organizationId));
    }
    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          survey: surveys,
          myResponseStatus: surveyResponses.status,
          myCompletedAt: surveyResponses.completedAt,
        })
        .from(surveys)
        .innerJoin(surveyResponses, eq(surveyResponses.surveyId, surveys.id))
        .where(where)
        .limit(opts.pagination.limit)
        .offset(opts.pagination.offset)
        .orderBy(surveys.createdAt),
      this.db
        .select({ count: count() })
        .from(surveys)
        .innerJoin(surveyResponses, eq(surveyResponses.surveyId, surveys.id))
        .where(where),
    ]);

    return {
      data: data.map((row) => ({
        ...row.survey,
        myResponseStatus: row.myResponseStatus,
        myCompletedAt: row.myCompletedAt,
      })),
      totalCount: Number(countResult[0]?.count ?? 0),
    };
  }

  async findAvailableForMember(
    organizationId: string | undefined,
    responderId: string,
    opts: { surveyType?: string; pagination: { limit: number; offset: number } }
  ): Promise<{ data: Array<Survey & { myResponseStatus: string | null; myCompletedAt: Date | null }>; totalCount: number }> {
    // Tenant-boundary: always scope to orgs the member actually belongs to.
    // This prevents leaking active surveys from orgs the member doesn't belong to
    // even when no x-org-id header is present (e.g. /my/surveys outside org route tree).
    const memberOrgsSubquery = this.db
      .select({ orgId: memberships.organizationId })
      .from(memberships)
      .where(eq(memberships.personId, responderId));

    const conditions: SQL<unknown>[] = [
      eq(surveys.status, 'active'),
      inArray(surveys.organizationId, memberOrgsSubquery),
    ];
    // Optional narrowing: further restrict to a specific org when caller has org context.
    if (organizationId) {
      conditions.push(eq(surveys.organizationId, organizationId));
    }
    if (opts.surveyType) {
      conditions.push(eq(surveys.surveyType, opts.surveyType));
    }
    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          survey: surveys,
          myResponseStatus: surveyResponses.status,
          myCompletedAt: surveyResponses.completedAt,
        })
        .from(surveys)
        // responderId is part of the ON so the join is per-member; unanswered → nulls
        .leftJoin(
          surveyResponses,
          and(
            eq(surveyResponses.surveyId, surveys.id),
            eq(surveyResponses.responderId, responderId),
          ),
        )
        .where(where)
        .limit(opts.pagination.limit)
        .offset(opts.pagination.offset)
        .orderBy(surveys.createdAt),
      this.db
        .select({ count: count() })
        .from(surveys)
        .where(where),
    ]);

    return {
      data: data.map((row) => ({
        ...row.survey,
        myResponseStatus: row.myResponseStatus ?? null,
        myCompletedAt: row.myCompletedAt ?? null,
      })),
      totalCount: Number(countResult[0]?.count ?? 0),
    };
  }

  async createSurvey(data: NewSurvey): Promise<Survey> {
    const [row] = await this.db.insert(surveys).values(data).returning();
    return row!;
  }

  async updateDraftSurvey(
    id: string,
    updates: Partial<Pick<NewSurvey, 'title' | 'description' | 'surveyType' | 'questions' | 'settings'>> & { updatedBy?: string }
  ): Promise<Survey | undefined> {
    const [row] = await this.db
      .update(surveys)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'draft')))
      .returning();
    return row;
  }

  async publish(id: string, updatedBy: string): Promise<Survey | undefined> {
    const [row] = await this.db
      .update(surveys)
      .set({ status: 'active', updatedBy, updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'draft')))
      .returning();
    return row;
  }

  async close(id: string, updatedBy: string): Promise<Survey | undefined> {
    const [row] = await this.db
      .update(surveys)
      .set({ status: 'closed', updatedBy, updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'active')))
      .returning();
    return row;
  }

  /**
   * System-initiated close at deadline (FIX-008). Unlike `close`, this leaves
   * `updatedBy` untouched (a cron has no person actor and the column FKs to
   * person). Only flips an active survey → closed.
   */
  async closeExpiredSurvey(id: string): Promise<Survey | undefined> {
    const [row] = await this.db
      .update(surveys)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'active')))
      .returning();
    return row;
  }

  async deleteDraft(id: string): Promise<boolean> {
    const result = await this.db
      .delete(surveys)
      .where(and(eq(surveys.id, id), eq(surveys.status, 'draft')))
      .returning({ id: surveys.id });
    return result.length > 0;
  }

  async updateAnalyticsSnapshot(id: string, snapshot: SurveyAnalyticsSnapshot): Promise<void> {
    await this.db
      .update(surveys)
      .set({ analyticsSnapshot: snapshot, updatedAt: new Date() })
      .where(eq(surveys.id, id));
  }

  async cloneSurvey(id: string, createdBy: string): Promise<Survey> {
    const original = await this.findById(id);
    if (!original) throw new Error('Survey not found');
    const [row] = await this.db.insert(surveys).values({
      organizationId: original.organizationId,
      title: `${original.title} (Copy)`,
      description: original.description,
      surveyType: original.surveyType,
      questions: original.questions,
      settings: original.settings,
      status: 'draft',
      createdBy,
      updatedBy: createdBy,
    }).returning();
    return row!;
  }

  async findActiveNpsSurvey(organizationId: string): Promise<Survey | undefined> {
    const [row] = await this.db
      .select()
      .from(surveys)
      .where(
        and(
          eq(surveys.organizationId, organizationId),
          eq(surveys.status, 'active'),
          eq(surveys.surveyType, 'nps')
        )
      )
      .limit(1);
    return row;
  }
}

// ---------------------------------------------------------------------------
// SurveyResponseRepository
// ---------------------------------------------------------------------------

export class SurveyResponseRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  private buildWhereConditions(filters?: SurveyResponseFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions: SQL<unknown>[] = [];

    if (filters.organizationId) {
      conditions.push(eq(surveyResponses.organizationId, filters.organizationId));
    }
    if (filters.surveyId) {
      conditions.push(eq(surveyResponses.surveyId, filters.surveyId));
    }
    if (filters.responderId) {
      conditions.push(eq(surveyResponses.responderId, filters.responderId));
    }
    if (filters.status) {
      conditions.push(eq(surveyResponses.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async findManyWithPagination(
    filters: SurveyResponseFilters,
    opts: { pagination: { limit: number; offset: number } }
  ): Promise<{ data: SurveyResponseRecord[]; totalCount: number }> {
    const where = this.buildWhereConditions(filters);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(surveyResponses)
        .where(where)
        .limit(opts.pagination.limit)
        .offset(opts.pagination.offset)
        .orderBy(surveyResponses.createdAt),
      this.db
        .select({ count: count() })
        .from(surveyResponses)
        .where(where),
    ]);

    return { data, totalCount: Number(countResult[0]?.count ?? 0) };
  }

  async findAllBySurveyId(surveyId: string): Promise<SurveyResponseRecord[]> {
    return this.db
      .select()
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.surveyId, surveyId),
          eq(surveyResponses.status, 'completed')
        )
      )
      .limit(500);
  }

  async submitResponse(data: NewSurveyResponse): Promise<SurveyResponseRecord> {
    const [row] = await this.db
      .insert(surveyResponses)
      .values({ ...data, status: 'completed', completedAt: new Date() })
      .returning();
    return row!;
  }

  async createPendingResponse(data: NewSurveyResponse): Promise<SurveyResponseRecord> {
    const [row] = await this.db
      .insert(surveyResponses)
      .values({ ...data, status: 'pending' })
      .returning();
    return row!;
  }

  /**
   * [AC-M18-004] M18-R3 — update an existing response's answers in place.
   * Caller (handler) must enforce: survey.settings.allowReedit && deadline not passed.
   * Anonymity preserved via the existing responderId column (null on anonymous responses).
   */
  async updateResponseAnswers(
    responseId: string,
    answers: QuestionAnswer[],
    updatedBy: string,
  ): Promise<SurveyResponseRecord | undefined> {
    const [row] = await this.db
      .update(surveyResponses)
      .set({
        answers,
        status: 'completed',
        completedAt: new Date(),
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(surveyResponses.id, responseId))
      .returning();
    return row;
  }

  async findByResponderAndSurvey(responderId: string, surveyId: string): Promise<SurveyResponseRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.responderId, responderId),
          eq(surveyResponses.surveyId, surveyId)
        )
      )
      .limit(1);
    return row;
  }

  async countRecentForMember(responderId: string, sinceHours: number = 24): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const [result] = await this.db
      .select({ count: count() })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.responderId, responderId),
          gt(surveyResponses.createdAt, since)
        )
      );
    return Number(result?.count ?? 0);
  }

  async countRecentForMemberInWindow(responderId: string, windowDays: number = 7): Promise<number> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const [result] = await this.db
      .select({ count: count() })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.responderId, responderId),
          gt(surveyResponses.createdAt, since),
          // Count completed + pending (not dismissed/skipped)
          sql`${surveyResponses.status} IN ('completed', 'pending')`
        )
      );
    return Number(result?.count ?? 0);
  }

  async markAsSkipped(id: string): Promise<void> {
    await this.db
      .update(surveyResponses)
      .set({ status: 'skipped', updatedAt: new Date() })
      .where(eq(surveyResponses.id, id));
  }

  async markAsDismissed(id: string): Promise<void> {
    await this.db
      .update(surveyResponses)
      .set({ status: 'dismissed', updatedAt: new Date() })
      .where(eq(surveyResponses.id, id));
  }

  async createDismissedResponse(data: NewSurveyResponse): Promise<SurveyResponseRecord> {
    const [row] = await this.db
      .insert(surveyResponses)
      .values({ ...data, status: 'dismissed' })
      .returning();
    return row!;
  }

  async markPendingAsSkippedBefore(cutoff: Date): Promise<number> {
    const result = await this.db
      .update(surveyResponses)
      .set({ status: 'skipped', updatedAt: new Date() })
      .where(
        and(
          eq(surveyResponses.status, 'pending'),
          lt(surveyResponses.createdAt, cutoff)
        )
      )
      .returning({ id: surveyResponses.id });
    return result.length;
  }

  /**
   * Right-to-deletion, scoped to a single organization (FIX-009). Deletes the
   * caller's responses only within the given org — never a cross-org wipe.
   * Anonymized rows (responderId nulled by the person.deleted cascade) are
   * naturally excluded since they no longer match the caller's id.
   */
  async deleteByResponderAndOrg(responderId: string, organizationId: string): Promise<number> {
    const result = await this.db
      .delete(surveyResponses)
      .where(
        and(
          eq(surveyResponses.responderId, responderId),
          eq(surveyResponses.organizationId, organizationId)
        )
      )
      .returning({ id: surveyResponses.id });
    return result.length;
  }
}
