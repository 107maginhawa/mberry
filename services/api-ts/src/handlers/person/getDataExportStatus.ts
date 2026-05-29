import { eq } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { dataExports } from './repos/data-export.schema';

/**
 * getDataExportStatus
 *
 * Path: GET /persons/me/data-export/:id
 *
 * WF-014 status polling. Returns the export's current state and download URL.
 * Reports `expired` once past the 7-day TTL. Ownership-scoped: a member can
 * only read their own exports.
 */
export async function getDataExportStatus(ctx: BaseContext): Promise<Response> {
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

  const expired =
    row.status === 'ready' && row.expiresAt != null && new Date(row.expiresAt) < new Date();
  const status = expired ? 'expired' : row.status;

  return ctx.json(
    {
      id: row.id,
      status,
      downloadUrl: expired ? null : row.downloadUrl,
      expiresAt: row.expiresAt,
      requestedAt: row.requestedAt,
    },
    200,
  );
}
