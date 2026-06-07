import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ApproveTransferByTargetBody, ApproveTransferByTargetParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { AffiliationTransferRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * approveTransferByTarget
 *
 * Path: POST /association/member/affiliation-transfers/{transferId}/approve-target
 * OperationId: approveTransferByTarget
 */
export async function approveTransferByTarget(
  ctx: ValidatedContext<ApproveTransferByTargetBody, never, ApproveTransferByTargetParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const { transferId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AffiliationTransferRepository(db, ctx.get('logger'));

  const transfer = await repo.findOneById(transferId);
  if (!transfer) throw new NotFoundError('Affiliation transfer');

  if (transfer.status !== 'requested' && transfer.status !== 'pendingTargetApproval') {
    throw new BusinessLogicError(
      `Transfer cannot be approved by target in status '${transfer.status}'`,
      'INVALID_TRANSFER_STATUS',
    );
  }

  const updateData: any = {
    approvedByTarget: user.id,
  };

  // If source has already approved, advance to 'approved'
  if (transfer.approvedBySource) {
    updateData.status = 'approved';
  } else {
    updateData.status = 'pendingSourceApproval';
  }

  const updated = await repo.updateOneById(transferId, updateData);

  ctx.set('auditResourceId', transferId);
  ctx.set('auditDescription', 'Affiliation transfer approved by target');

  return ctx.json(updated, 200);
}
