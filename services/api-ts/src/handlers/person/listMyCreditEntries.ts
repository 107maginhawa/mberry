import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

/**
 * listMyCreditEntries
 *
 * Path: GET /credit-entries
 * OperationId: listMyCreditEntries
 */
export async function listMyCreditEntries(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const organizationId = ctx.req.query('organizationId');
  const type = ctx.req.query('type') as 'auto' | 'manual' | undefined;

  const repo = new CreditEntryRepository(db, logger);
  const entries = await repo.findMany({ personId, organizationId, type });

  return ctx.json({ data: entries, total: entries.length }, 200);
}
