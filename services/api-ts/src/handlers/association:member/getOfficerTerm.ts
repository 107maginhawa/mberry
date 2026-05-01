import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { OfficerTermRepository } from './repos/governance.repo';

/**
 * getOfficerTerm
 *
 * Path: GET /association/member/officer-terms/{termId}
 * OperationId: getOfficerTerm
 */
export async function getOfficerTerm(
  ctx: ValidatedContext<never, never, { termId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const { termId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  const term = await repo.findById(termId);
  if (!term || term.tenantId !== tenantId) {
    throw new NotFoundError('Officer term');
  }

  return ctx.json(term);
}
