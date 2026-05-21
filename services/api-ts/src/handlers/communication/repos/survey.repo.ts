/**
 * Repository for Surveys & Polls module (M18).
 *
 * BR-40: respondentId is stored as NULL for anonymous surveys.
 * This is enforced in submitResponse — the handler sets it to null
 * before calling this repo.
 */

import { eq, and, sql, desc, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  surveys,
  surveyResponses,
  type Survey,
  type NewSurvey,
  type SurveyResponse,
  type NewSurveyResponse,
} from './survey.schema';

export class SurveyRepository {
  constructor(private db: DatabaseInstance) {}

  // -------------------------------------------------------------------------
  // Surveys
  // -------------------------------------------------------------------------

  async list(
    orgId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: Survey[]; total: number }> {
    const conditions: SQL<unknown>[] = [eq(surveys.organizationId, orgId)];

    if (filters?.status) {
      conditions.push(eq(surveys.status, filters.status as Survey['status']));
    }

    const where = conditions.length === 1 ? conditions[0]! : and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(surveys)
        .where(where)
        .orderBy(desc(surveys.createdAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(surveys)
        .where(where),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<Survey | undefined> {
    const [row] = await this.db
      .select()
      .from(surveys)
      .where(eq(surveys.id, id))
      .limit(1);
    return row;
  }

  async create(data: NewSurvey): Promise<Survey> {
    const [row] = await this.db.insert(surveys).values(data).returning();
    return row!;
  }

  async update(id: string, data: Partial<NewSurvey>): Promise<Survey> {
    const [row] = await this.db
      .update(surveys)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'draft')))
      .returning();
    return row!;
  }

  async publish(id: string): Promise<Survey> {
    const [row] = await this.db
      .update(surveys)
      .set({ status: 'active', updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'draft')))
      .returning();
    return row!;
  }

  async close(id: string): Promise<Survey> {
    const [row] = await this.db
      .update(surveys)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(and(eq(surveys.id, id), eq(surveys.status, 'active')))
      .returning();
    return row!;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(surveys)
      .where(
        and(
          eq(surveys.id, id),
          // Only draft or closed surveys can be deleted
          sql`${surveys.status} IN ('draft', 'closed')`,
        ),
      );
  }

  // -------------------------------------------------------------------------
  // Responses
  // -------------------------------------------------------------------------

  async submitResponse(data: NewSurveyResponse): Promise<SurveyResponse> {
    const [row] = await this.db.insert(surveyResponses).values(data).returning();

    // Increment responseCount on the survey
    await this.db
      .update(surveys)
      .set({
        responseCount: sql`${surveys.responseCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(surveys.id, data.surveyId));

    return row!;
  }

  async getResponseBySurveyAndRespondent(
    surveyId: string,
    respondentId: string,
  ): Promise<SurveyResponse | undefined> {
    const [row] = await this.db
      .select()
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.surveyId, surveyId),
          eq(surveyResponses.respondentId, respondentId),
        ),
      )
      .limit(1);
    return row;
  }

  async listResponses(surveyId: string): Promise<SurveyResponse[]> {
    return this.db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.surveyId, surveyId))
      .orderBy(surveyResponses.submittedAt);
  }

  async getResponseCount(surveyId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(surveyResponses)
      .where(eq(surveyResponses.surveyId, surveyId));
    return result?.count ?? 0;
  }
}
