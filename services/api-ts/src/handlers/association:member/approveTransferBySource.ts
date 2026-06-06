import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ApproveTransferBySourceBody, ApproveTransferBySourceParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { AffiliationTransferRepository } from './repos/chapters.repo';

/**
 * approveTransferBySource
 *
 * Path: POST /association/member/affiliation-transfers/{transferId}/approve-source
 * OperationId: approveTransferBySource
 */
export async function approveTransferBySource(
  ctx: ValidatedContext<ApproveTransferBySourceBody, never, ApproveTransferBySourceParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const { transferId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AffiliationTransferRepository(db, ctx.get('logger'));

  const transfer = await repo.findOneById(transferId);
  if (!transfer) throw new NotFoundError('Affiliation transfer');

  if (transfer.status !== 'requested' && transfer.status !== 'pendingSourceApproval') {
    throw new BusinessLogicError(
      `Transfer cannot be approved by source in status '${transfer.status}'`,
      'INVALID_TRANSFER_STATUS',
    );
  }

  const updateData: any = {
    approvedBySource: user.id,
  };

  // If target has already approved, advance to 'approved'
  if (transfer.approvedByTarget) {
    updateData.status = 'approved';
  } else {
    updateData.status = 'pendingTargetApproval';
  }

  const updated = await repo.updateOneById(transferId, updateData);

  ctx.set('auditResourceId', transferId);
  ctx.set('auditDescription', 'Affiliation transfer approved by source');

  return ctx.json(updated, 200);
}
