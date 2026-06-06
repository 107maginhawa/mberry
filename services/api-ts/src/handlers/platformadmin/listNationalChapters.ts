import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListNationalChaptersQuery } from '@/generated/openapi/validators';
import { DashboardRepository } from './repos/dashboard.repo';
import {
  resolveAssociationAccess,
  isSuppressed,
  pct,
  toCents,
  type SessionUser,
} from './utils/national-access';

/**
 * listNationalChapters
 *
 * Path: GET /admin/national/chapters
 * OperationId: listNationalChapters
 *
 * S10 row 2 / WF-084. Comparative chapter metrics for benchmarking.
 * BR-36 access control; M14-R2 suppresses chapters with <5 members.
 */
interface ChapterRow {
  organizationId: string;
  organizationName?: string;
  totalMembers: number;
  activeMembers: number;
  activePercentage: number;
  collectionRate: number;
  creditCompliance: number;
  totalRevenueCents: number;
  eventCount: number;
  trainingCount: number;
  isSuppressed: boolean;
}

const SORT_FIELDS = new Set(['totalMembers', 'collectionRate', 'creditCompliance']);

export async function listNationalChapters(
  ctx: ValidatedContext<never, ListNationalChaptersQuery, never>,
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const snapshotMonth = query.snapshotMonth ?? new Date().toISOString().slice(0, 7);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DashboardRepository(db, logger);

  const user = session.user as SessionUser | undefined;
  const associationId = await resolveAssociationAccess(repo, user, query.associationId);

  const snapshots = await repo.listChapterSnapshots(associationId, snapshotMonth);
  const names = await repo.getOrgNames(snapshots.map((s) => s.orgId));

  const rows: ChapterRow[] = snapshots.map((s) => {
    const suppressed = isSuppressed(s.totalMembers);
    const totalCollected = Number(s.totalCollected ?? 0);
    return {
      organizationId: s.orgId,
      organizationName: names.get(s.orgId),
      totalMembers: s.totalMembers,
      activeMembers: suppressed ? 0 : (s.activeMembers ?? 0),
      activePercentage: suppressed ? 0 : pct(s.activeMembers ?? 0, s.totalMembers),
      collectionRate: suppressed ? 0 : Number(s.collectionRate ?? 0) * 100,
      creditCompliance: suppressed ? 0 : Number(s.cpdComplianceRate ?? 0) * 100,
      totalRevenueCents: suppressed ? 0 : toCents(totalCollected),
      eventCount: suppressed ? 0 : (s.activityCount90d ?? 0),
      trainingCount: 0,
      isSuppressed: suppressed,
    };
  });

  // Sort (default -totalMembers)
  const sortParam = query.sort ?? '-totalMembers';
  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;
  if (SORT_FIELDS.has(field)) {
    rows.sort((a, b) => {
      const av = a[field as keyof ChapterRow] as number;
      const bv = b[field as keyof ChapterRow] as number;
      return desc ? bv - av : av - bv;
    });
  }

  const total = rows.length;
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const page = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  ctx.set('auditResourceId', associationId);
  ctx.set('auditDescription', `National chapter comparison viewed for association ${associationId} (${snapshotMonth})`);
  ctx.set('auditDetails', { snapshotMonth, returned: page.length, total });

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
