import type { Context } from 'hono';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { DashboardRepository } from '../platformadmin/repos/dashboard.repo';
import { auditAction } from '@/utils/audit';
import { escapeCsvValue } from '@/utils/sanitize';
import { domainEvents } from '@/core/domain-events';
import type { Session } from '@/types/auth';

function snapshotsToCsv(snapshots: Record<string, any>[]): string {
  if (snapshots.length === 0) return '';

  const headers = [
    'chapterName', 'totalMembers', 'activeMembers', 'graceMembers',
    'lapsedMembers', 'suspendedMembers', 'collectionRate',
    'totalCollected', 'totalExpected', 'cpdComplianceRate',
    'avgCreditsPerMember', 'activityCount90d',
  ];

  const rows = snapshots.map(s =>
    headers.map(h => escapeCsvValue(s[h])).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export async function exportNationalDashboard(ctx: Context): Promise<Response> {
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const associationId = ctx.req.param('associationId')!;
  const body = await ctx.req.json();
  const snapshotMonth = body.snapshotMonth || new Date().toISOString().slice(0, 7);
  const format = body.format || 'csv';

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DashboardRepository(db, logger);

  // BR-36: Access control — platform admin or designated national officer
  const user = session.user as { id: string; role?: string };
  const isPlatformAdmin = user.role === 'platform_admin' || user.role === 'super';

  if (!isPlatformAdmin) {
    const isOfficer = await repo.isDesignatedNationalOfficer(user.id, associationId);
    if (!isOfficer) {
      return ctx.json({ error: 'Forbidden: national officer or admin role required' }, 403);
    }
  }

  const snapshots = await repo.listChapterSnapshots(associationId, snapshotMonth);

  // Log export for audit (BR-36)
  const exportLog = await repo.createExportLog({
    exportedBy: user.id,
    associationId,
    reportType: 'association_summary',
    scope: 'all_chapters',
    dateRangeStart: new Date(`${snapshotMonth}-01`),
    dateRangeEnd: new Date(),
    outputFormat: format,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dashboard_export',
    resourceId: exportLog.id,
    description: `National dashboard exported: ${format} for ${snapshotMonth}`,
  });

  // EM-M14-b1e3c2d0: emit DashboardExported domain event (spec §10b).
  domainEvents.emit('dashboard.exported', {
    exportId: exportLog.id,
    associationId,
    format,
    exportedBy: user.id,
  }).catch(() => {});

  if (format === 'json') {
    return ctx.json({
      data: {
        exportId: exportLog.id,
        format: 'json',
        snapshotMonth,
        chapters: snapshots,
      },
    }, 200);
  }

  // Default: CSV
  const csv = snapshotsToCsv(snapshots);
  return ctx.json({
    data: {
      exportId: exportLog.id,
      format: 'csv',
      snapshotMonth,
      csv,
    },
  }, 200);
}
