import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { OfficerTermRepository } from './repos/governance.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteOfficerTerm
 *
 * Path: DELETE /association/member/officer-terms/{termId}
 * OperationId: deleteOfficerTerm
 */
export async function deleteOfficerTerm(
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

  const existing = await repo.findById(termId);
  if (!existing || existing.tenantId !== tenantId) {
    throw new NotFoundError('Officer term');
  }

  await repo.delete(termId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'officer-term',
    resourceId: termId,
    description: 'Officer term deleted',
  });

  return ctx.json({ success: true });
}
