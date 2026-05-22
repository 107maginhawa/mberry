import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DenyAffiliationTransferBody, DenyAffiliationTransferParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { AffiliationTransferRepository } from './repos/chapters.repo';
import type { AffiliationTransfer } from './repos/chapters.schema';
import { auditAction } from '@/utils/audit';

/**
 * denyAffiliationTransfer
 *
 * Path: POST /association/member/affiliation-transfers/{transferId}/deny
 * OperationId: denyAffiliationTransfer
 */
export async function denyAffiliationTransfer(
  ctx: ValidatedContext<DenyAffiliationTransferBody, never, DenyAffiliationTransferParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { transferId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AffiliationTransferRepository(db, ctx.get('logger'));

  const transfer = await repo.findOneById(transferId);
  if (!transfer) throw new NotFoundError('Affiliation transfer');

  if (transfer.status === 'completed' || transfer.status === 'denied' || transfer.status === 'cancelled') {
    throw new BusinessLogicError(
      `Transfer cannot be denied in status '${transfer.status}'`,
      'INVALID_TRANSFER_STATUS',
    );
  }

  const updated = await repo.updateOneById(transferId, {
    status: 'denied',
  } as Partial<AffiliationTransfer>);

  await auditAction(ctx, {
    action: 'deny',
    resourceType: 'affiliation-transfer',
    resourceId: transferId,
    description: 'Affiliation transfer denied',
  });

  return ctx.json(updated, 200);
}
