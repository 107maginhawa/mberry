/**
 * getOrgHealthScores
 *
 * Path: GET /admin/analytics/health
 * OperationId: getOrgHealthScores
 *
 * Organization health scores for platform admins. Computes a weighted
 * health score (0-100) per organization based on membership activity,
 * dues collection rate, and engagement metrics.
 *
 * EM-M03-revenue: Implements missing analytics endpoint.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { sql } from 'drizzle-orm';
import { auditAction } from '@/core/audit/audit-action';
import type { Session } from '@/types/auth';

interface OrgHealth {
  organizationId: string;
  organizationName: string;
  healthScore: number;
  activeMemberCount: number;
  duesCollectionRate: number;
  updatedAt: string;
}

export async function getOrgHealthScores(
  ctx: Context,
): Promise<Response> {
  const session = ctx.get('session') as Session;
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const admin = ctx.get('platformAdmin');
  if (!admin) return ctx.json({ error: 'Platform admin access required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const url = new URL(ctx.req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const healthThreshold = url.searchParams.get('filter[healthScore][lte]');

  try {
    // Compute health scores from chapter snapshots (most recent per org)
    const result = await db.execute(sql`
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (organization_id)
          organization_id,
          chapter_name,
          total_members,
          active_members,
          collection_rate,
          cpd_compliance_rate,
          activity_count_90d,
          snapshot_month
        FROM chapter_snapshot
        ORDER BY organization_id, snapshot_month DESC
      )
      SELECT
        ls.organization_id,
        ls.chapter_name,
        ls.total_members,
        ls.active_members,
        ls.collection_rate,
        ls.cpd_compliance_rate,
        ls.activity_count_90d,
        ls.snapshot_month,
        -- Health score: 40% collection + 30% active ratio + 20% CPD + 10% activity
        LEAST(100, GREATEST(0,
          (ls.collection_rate * 40) +
          (CASE WHEN ls.total_members > 0 THEN (ls.active_members::float / ls.total_members) * 30 ELSE 0 END) +
          (ls.cpd_compliance_rate * 20) +
          (LEAST(ls.activity_count_90d, 10)::float / 10 * 10)
        ))::int as health_score
      FROM latest_snapshots ls
      ${healthThreshold ? sql`WHERE LEAST(100, GREATEST(0, (ls.collection_rate * 40) + (CASE WHEN ls.total_members > 0 THEN (ls.active_members::float / ls.total_members) * 30 ELSE 0 END) + (ls.cpd_compliance_rate * 20) + (LEAST(ls.activity_count_90d, 10)::float / 10 * 10))) <= ${Number(healthThreshold)}` : sql``}
      ORDER BY health_score ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const orgs: OrgHealth[] = (result.rows ?? []).map((row: Record<string, unknown>) => ({
      organizationId: String(row['organization_id']),
      organizationName: String(row['chapter_name'] ?? 'Unknown'),
      healthScore: Number(row['health_score'] ?? 0),
      activeMemberCount: Number(row['active_members'] ?? 0),
      duesCollectionRate: Number(row['collection_rate'] ?? 0),
      updatedAt: String(row['snapshot_month'] ?? new Date().toISOString()),
    }));

    await auditAction(ctx, {
      action: 'read',
      resourceType: 'org-health',
      resourceId: 'platform',
      description: `Org health scores accessed: ${orgs.length} results`,
      eventSubType: 'data.pii-accessed',
      eventType: 'data-access',
    });

    return ctx.json({
      data: orgs,
      meta: {
        limit,
        offset,
        hasMore: orgs.length === limit,
      },
    }, 200);
  } catch (error) {
    logger?.error({ error }, 'Failed to compute org health scores');
    return ctx.json({ error: 'Failed to compute org health scores' }, 500);
  }
}
