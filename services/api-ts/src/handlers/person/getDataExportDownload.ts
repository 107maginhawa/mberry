import { eq } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { dataExports } from './repos/data-export.schema';

/**
 * getDataExportDownload
 *
 * Path: GET /persons/me/data-export/:id/download
 *
 * Serves the aggregated personal-data payload as a JSON file attachment while
 * the export is `ready` and within its 7-day TTL. Ownership-scoped.
 *
 * NOTE: payload is delivered as JSON. ZIP packaging + signed S3 URL is tracked
 * as residual polish (EM-M02-9f0a1b2c, P3) — no zip dependency exists yet.
 */
export async function getDataExportDownload(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;
  const exportId = ctx.req.param('id')!;

  const [row] = await db
    .select()
    .from(dataExports)
    .where(eq(dataExports.id, exportId))
    .limit(1);

  if (!row || row.personId !== personId) {
    throw new NotFoundError('Data export not found');
  }

  if (row.status !== 'ready' || !row.payload) {
    throw new BusinessLogicError('Export is not ready for download', 'EXPORT_NOT_READY');
  }

  if (row.expiresAt != null && new Date(row.expiresAt) < new Date()) {
    throw new BusinessLogicError('Export download link has expired', 'EXPORT_EXPIRED');
  }

  return ctx.body(JSON.stringify(row.payload, null, 2), 200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="data-export-${exportId}.json"`,
  });
}
