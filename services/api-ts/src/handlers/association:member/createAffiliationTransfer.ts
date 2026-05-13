import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateAffiliationTransferBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { AffiliationTransferRepository } from './repos/chapters.repo';
import { auditAction } from '@/utils/audit';

/**
 * createAffiliationTransfer
 *
 * Path: POST /association/member/affiliation-transfers
 * OperationId: createAffiliationTransfer
 */
export async function createAffiliationTransfer(
  ctx: ValidatedContext<CreateAffiliationTransferBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AffiliationTransferRepository(db, logger);

  const transfer = await repo.createOne({
    organizationId: orgId,
    personId: body.personId,
    fromChapterId: body.fromChapterId,
    toChapterId: body.toChapterId,
    requestedAt: new Date(),
    requestedBy: user.id,
    status: 'requested',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'affiliation-transfer',
    resourceId: transfer.id,
    description: 'Affiliation transfer requested',
  });

  return ctx.json(transfer, 201);
}
