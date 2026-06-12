import { eq, and, gte, desc } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { dataExports } from './repos/data-export.schema';
import { buildMyDataExport } from './utils/build-data-export';

const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * exportMyData
 *
 * Path: GET /export
 * OperationId: exportMyData
 *
 * GDPR/DPA data portability: aggregates all user data and returns as JSON.
 */
export async function exportMyData(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  // M2-R4: rate limit — 1 export per 24h per person (shared ledger with the
  // async data-export path so neither endpoint can be used to bypass the other)
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await db
    .select({ id: dataExports.id, status: dataExports.status })
    .from(dataExports)
    .where(and(eq(dataExports.personId, personId), gte(dataExports.requestedAt, since)))
    .orderBy(desc(dataExports.requestedAt))
    .limit(1);
  if (recent.length > 0 && recent[0]!.status !== 'failed') {
    return ctx.json(
      { error: 'You can request one export per 24 hours.', code: 'RATE_LIMITED' },
      429,
    );
  }

  // Aggregate the full DPA portability envelope (shared with the async path so
  // the contract and the stored payload cannot drift) — FIX-008.
  const exportEnvelope = await buildMyDataExport(db, logger, personId);

  // Record in the shared export ledger so the 24h window applies across both
  // the sync and async export endpoints.
  await db.insert(dataExports).values({
    personId,
    status: 'ready',
    requestedAt: new Date(),
    createdBy: personId,
  });

  ctx.set('auditResourceId', personId);
  ctx.set('auditDescription', 'User exported personal data (GDPR/DPA portability)');

  return ctx.json(exportEnvelope, 200);
}
