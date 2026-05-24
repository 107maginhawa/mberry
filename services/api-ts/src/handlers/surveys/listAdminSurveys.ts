import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { surveys } from './repos/survey.schema';
import { eq, count, sql, type SQL, and } from 'drizzle-orm';

/**
 * listAdminSurveys
 *
 * Path: GET /admin/surveys
 * Hand-wired route (platform admin)
 *
 * Returns cross-org survey list with stats. Platform admin only.
 */
export async function listAdminSurveys(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  if (session.user.role !== 'admin') {
    throw new ForbiddenError('Platform admin access required');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const url = new URL(ctx.req.url);

  const limit = Math.min(Number(url.searchParams.get('limit') ?? 25), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const statusFilter = url.searchParams.get('status');
  const typeFilter = url.searchParams.get('surveyType');

  // Build where conditions
  const conditions: SQL<unknown>[] = [];
  if (statusFilter) conditions.push(eq(surveys.status, statusFilter));
  if (typeFilter) conditions.push(eq(surveys.surveyType, typeFilter));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch surveys + count
  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(surveys)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(surveys.createdAt),
    db
      .select({ count: count() })
      .from(surveys)
      .where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  // Compute stats across all surveys (unfiltered)
  const [statsResult] = await db
    .select({
      totalSurveys: count(),
      activeSurveys: sql<number>`count(*) filter (where ${surveys.status} = 'active')`,
    })
    .from(surveys);

  // Calculate average NPS from surveys that have analytics
  const surveysWithNps = data.filter(
    (s) => s.analyticsSnapshot?.npsScore != null
  );
  const avgNps = surveysWithNps.length > 0
    ? surveysWithNps.reduce((sum, s) => sum + (s.analyticsSnapshot?.npsScore ?? 0), 0) / surveysWithNps.length
    : null;

  // Calculate avg response rate
  const surveysWithResponses = data.filter(
    (s) => s.analyticsSnapshot?.completionRate != null
  );
  const avgResponseRate = surveysWithResponses.length > 0
    ? surveysWithResponses.reduce((sum, s) => sum + (s.analyticsSnapshot?.completionRate ?? 0), 0) / surveysWithResponses.length
    : 0;

  const formattedData = data.map((s) => ({
    id: s.id,
    title: s.title,
    organizationName: undefined, // Would need org join — kept simple for v1
    surveyType: s.surveyType,
    status: s.status,
    responseCount: s.analyticsSnapshot?.totalResponses ?? 0,
    questionCount: Array.isArray(s.questions) ? s.questions.length : 0,
    npsScore: s.analyticsSnapshot?.npsScore ?? null,
    createdAt: s.createdAt,
  }));

  return ctx.json({
    data: formattedData,
    total,
    stats: {
      totalSurveys: Number(statsResult?.totalSurveys ?? 0),
      activeSurveys: Number(statsResult?.activeSurveys ?? 0),
      avgNps,
      avgResponseRate,
    },
  }, 200);
}
