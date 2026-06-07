import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { GetPlatformSummaryQuery } from '@/generated/openapi/validators';
import { DashboardRepository } from './repos/dashboard.repo';
import { isPlatformAdmin, toCents, type SessionUser } from './utils/national-access';

/**
 * getPlatformSummary
 *
 * Path: GET /admin/national/platform
 * OperationId: getPlatformSummary
 *
 * S10 row 5. Platform-wide per-association analytics. Platform admin only (M14-R1).
 */
interface AssocRow {
  associationId: string;
  associationName?: string;
  chapterCount: number;
  totalMembers: number;
  activeMembers: number;
  collectionRate: number;
  creditCompliance: number;
  totalRevenueCents: number;
}

const SORT_FIELDS = new Set(['totalMembers', 'collectionRate']);

export async function getPlatformSummary(
  ctx: ValidatedContext<never, GetPlatformSummaryQuery, never>,
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const user = session.user as SessionUser | undefined;
  if (!isPlatformAdmin(user)) {
    throw new ForbiddenError('Platform-wide summary is restricted to platform admins');
  }

  const query = ctx.req.valid('query');
  const snapshotMonth = query.snapshotMonth ?? new Date().toISOString().slice(0, 7);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DashboardRepository(db, logger);

  const associationIds = await repo.listAssociationIdsForMonth(snapshotMonth);
  const names = await repo.getOrgNames(associationIds);

  const rows: AssocRow[] = [];
  for (const associationId of associationIds) {
    const agg = await repo.getAssociationAggregate(associationId, snapshotMonth);
    rows.push({
      associationId,
      associationName: names.get(associationId),
      chapterCount: agg.chapterCount,
      totalMembers: agg.totalMembers,
      activeMembers: agg.activeMembers,
      collectionRate: agg.collectionRate * 100,
      creditCompliance: agg.cpdComplianceRate * 100,
      totalRevenueCents: toCents(agg.totalCollected),
    });
  }

  const sortParam = query.sort ?? '-totalMembers';
  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;
  if (SORT_FIELDS.has(field)) {
    rows.sort((a, b) => {
      const av = a[field as keyof AssocRow] as number;
      const bv = b[field as keyof AssocRow] as number;
      return desc ? bv - av : av - bv;
    });
  }

  const total = rows.length;
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const page = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  ctx.set('auditResourceId', 'platform');
  ctx.set('auditDescription', `Platform-wide summary viewed (${snapshotMonth})`);
  ctx.set('auditDetails', { snapshotMonth, associations: total });

  return ctx.json(
    {
      data: page,
      meta: {
        cursor: hasMore ? String(offset + limit) : null,
        hasMore,
        total,
      },
    },
    200,
  );
}
