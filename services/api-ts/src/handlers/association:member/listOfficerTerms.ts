import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { OfficerTermRepository } from './repos/governance.repo';

/**
 * listOfficerTerms
 *
 * Path: GET /association/member/officer-terms
 * OperationId: listOfficerTerms
 */
export async function listOfficerTerms(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  const terms = await repo.findByOrg(orgId);

  return ctx.json({ items: terms });
}
