/**
 * exportDashboardReport
 *
 * Validates the export request, logs the export for audit (BR-36), and returns
 * export metadata. Actual file generation is deferred (async job or CDN pre-sign).
 *
 * BR-36: All exports must be logged. PII columns are rejected at validation time.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { DashboardRepository } from './repos/dashboard.repo';
import type { NewDashboardExportLog } from './repos/dashboard-snapshot.schema';
import { auditAction } from '@/core/audit/audit-action';

type ReportType = 'association_summary' | 'dues_collection' | 'cpd_compliance' | 'activity';
type OutputFormat = 'pdf' | 'csv';

const VALID_REPORT_TYPES: ReportType[] = [
  'association_summary',
  'dues_collection',
  'cpd_compliance',
  'activity',
];

const VALID_OUTPUT_FORMATS: OutputFormat[] = ['pdf', 'csv'];

/** Columns that would expose individual member PII — blocked from exports. */
const PII_COLUMNS = new Set([
  'member_name',
  'license_number',
  'email',
  'phone',
  'member_id',
  'person_id',
  'contact_info',
]);

function validateNoPiiColumns(columns: string[]): { valid: boolean; violations: string[] } {
  const violations = columns.filter((col) => PII_COLUMNS.has(col.toLowerCase()));
  return { valid: violations.length === 0, violations };
}

export async function exportDashboardReport(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const associationId = ctx.req.param('associationId');
  if (!associationId) {
    return ctx.json({ error: 'associationId is required' }, 400);
  }

  // ── Access control (BR-36) ───────────────────────────────────────────────
  const user = session.user as { id?: string; role?: string } | undefined;
  const isPlatformAdmin = user?.role === 'platform_admin' || user?.role === 'super';

  if (!isPlatformAdmin) {
    const db = ctx.get('database') as DatabaseInstance;
    const logger = ctx.get('logger');
    const repo = new DashboardRepository(db, logger);

    const memberId = user?.id;
    if (!memberId) return ctx.json({ error: 'Forbidden' }, 403);

    const isOfficer = await repo.isDesignatedNationalOfficer(memberId, associationId);
    if (!isOfficer) {
      return ctx.json({ error: 'Forbidden: export requires platform admin or designated national officer role' }, 403);
    }
  }

  // ── Parse & validate request body ───────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await ctx.req.json();
  } catch {
    return ctx.json({ error: 'Invalid JSON body' }, 400);
  }

  const reportType = body['reportType'] as ReportType;
  const outputFormat = (body['outputFormat'] as OutputFormat) ?? 'pdf';
  const scope = typeof body['scope'] === 'string' ? body['scope'] : 'all_chapters';
  const columns = Array.isArray(body['columns']) ? (body['columns'] as string[]) : [];

  if (!VALID_REPORT_TYPES.includes(reportType)) {
    return ctx.json(
      { error: `Invalid reportType. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` },
      400,
    );
  }

  if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
    return ctx.json(
      { error: `Invalid outputFormat. Must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}` },
      400,
    );
  }

  // ── PII validation (BR-36: no individual member data in exports) ─────────
  if (columns.length > 0) {
    const { valid, violations } = validateNoPiiColumns(columns);
    if (!valid) {
      return ctx.json(
        { error: 'Export rejected: PII columns are not permitted', violations },
        422,
      );
    }
  }

  // ── Parse date range ─────────────────────────────────────────────────────
  const dateRangeStart = body['dateRangeStart']
    ? new Date(body['dateRangeStart'] as string)
    : new Date(new Date().getFullYear(), 0, 1); // default: start of current year

  const dateRangeEnd = body['dateRangeEnd']
    ? new Date(body['dateRangeEnd'] as string)
    : new Date();

  if (isNaN(dateRangeStart.getTime()) || isNaN(dateRangeEnd.getTime())) {
    return ctx.json({ error: 'Invalid date range' }, 400);
  }

  if (dateRangeStart > dateRangeEnd) {
    return ctx.json({ error: 'dateRangeStart must be before dateRangeEnd' }, 400);
  }

  // ── Create export log (BR-36: all exports audited) ───────────────────────
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DashboardRepository(db, logger);

  const exportedBy = user?.id ?? 'unknown';

  const logData: NewDashboardExportLog = {
    exportedBy,
    associationId,
    reportType,
    scope,
    dateRangeStart,
    dateRangeEnd,
    outputFormat,
  };

  const exportLog = await repo.createExportLog(logData);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dashboard_export',
    resourceId: exportLog.id,
    description: `Dashboard export requested: ${reportType} (${outputFormat}) for association ${associationId}`,
    details: { reportType, scope, outputFormat, dateRangeStart, dateRangeEnd },
  });

  // ── Return export metadata (file generation deferred) ───────────────────
  return ctx.json(
    {
      data: {
        exportId: exportLog.id,
        associationId,
        reportType,
        scope,
        outputFormat,
        dateRangeStart: exportLog.dateRangeStart,
        dateRangeEnd: exportLog.dateRangeEnd,
        requestedAt: exportLog.createdAt,
        status: 'queued',
        message: 'Export has been queued. File will be available shortly.',
      },
    },
    202,
  );
}
