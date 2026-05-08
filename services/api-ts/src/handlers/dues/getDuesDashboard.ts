import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetDuesDashboardParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues.repo';
import { events } from '@/handlers/association:operations/repos/events.schema';
import { eq, gte, and, sql } from 'drizzle-orm';

/**
 * getDuesDashboard
 *
 * Path: GET /dashboard/{orgId}
 * OperationId: getDuesDashboard
 *
 * Aggregated dues dashboard statistics for an organisation.
 * Includes dues totals + upcoming activity count from events.
 */
export async function getDuesDashboard(
  ctx: ValidatedContext<never, never, GetDuesDashboardParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const params = ctx.req.valid('param');
  const orgId = params.orgId;

  const repo = new DuesRepository(db as any);
  const stats = await repo.getDashboardStats(orgId);

  const [activityCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.organizationId, orgId), gte(events.startDate, new Date())));

  return ctx.json({
    data: {
      ...stats,
      totalCollected: Number(stats.totalCollected),
      totalOutstanding: Number(stats.totalOutstanding),
      upcomingActivities: Number(activityCount?.count ?? 0),
    },
  }, 200);
}
