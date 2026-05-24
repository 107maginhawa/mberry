import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { OrganizationRepository, AssociationRepository } from './repos/platform-admin.repo';
import { sql, ilike, eq, and, count } from 'drizzle-orm';
import { organizations, associations } from './repos/platform-admin.schema';

/**
 * listPublicOrgs
 *
 * Path: GET /public/orgs
 * Public endpoint — no auth required.
 * Returns paginated list of active organizations with optional search.
 */
export async function listPublicOrgs(
  ctx: BaseContext
): Promise<Response> {
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Parse query params
  const searchRaw = ctx.req.query('search') ?? '';
  const search = searchRaw.trim();
  const limitRaw = parseInt(ctx.req.query('limit') ?? '25', 10);
  const offsetRaw = parseInt(ctx.req.query('offset') ?? '0', 10);

  // Clamp limit to 1-100, offset to >= 0
  const limit = Math.max(1, Math.min(100, isNaN(limitRaw) ? 25 : limitRaw));
  const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

  // Build conditions: only active orgs, exclude cancelled/suspended/trial
  const conditions = [eq(organizations.status, 'active')];
  if (search) {
    conditions.push(ilike(organizations.name, `%${search}%`));
  }

  const whereClause = and(...conditions);

  // Count total matching orgs
  const [countResult] = await db
    .select({ total: count() })
    .from(organizations)
    .where(whereClause);
  const total = countResult?.total ?? 0;

  // Fetch paginated orgs
  const orgs = await db
    .select()
    .from(organizations)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(organizations.name);

  // Fetch association names for all orgs in one query
  const assocIds = [...new Set(orgs.map(o => o.associationId))];
  const assocMap = new Map<string, string>();
  if (assocIds.length > 0) {
    const assocs = await db
      .select({ id: associations.id, name: associations.name })
      .from(associations);
    for (const a of assocs) {
      assocMap.set(a.id, a.name);
    }
  }

  // Get member counts per org via raw SQL
  const memberCounts = new Map<string, number>();
  if (orgs.length > 0) {
    try {
      const orgIds = orgs.map(o => o.id);
      const result = await db.execute(
        sql`SELECT org_id, count(*)::int as count FROM membership WHERE org_id = ANY(${orgIds}) AND status = 'active' GROUP BY org_id`
      );
      const rows = (result as unknown as Record<string, unknown>)['rows'] as Array<Record<string, unknown>> | undefined
        ?? (result as unknown as Array<Record<string, unknown>>);
      if (Array.isArray(rows)) {
        for (const row of rows) {
          memberCounts.set(row['org_id'] as string, (row['count'] as number) ?? 0);
        }
      }
    } catch {
      // membership table may not exist — graceful fallback
    }
  }

  const data = orgs.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    orgType: org.orgType,
    region: org.region,
    status: org.status,
    associationName: assocMap.get(org.associationId) ?? null,
    memberCount: memberCounts.get(org.id) ?? 0,
  }));

  return ctx.json({
    data,
    meta: { total, limit, offset },
  }, 200);
}
