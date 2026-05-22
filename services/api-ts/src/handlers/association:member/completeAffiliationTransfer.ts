import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CompleteAffiliationTransferParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { ChapterAffiliationRepository, AffiliationTransferRepository } from './repos/chapters.repo';
import type { AffiliationTransfer, ChapterAffiliation } from './repos/chapters.schema';
import { auditAction } from '@/utils/audit';

/**
 * completeAffiliationTransfer
 *
 * Path: POST /association/member/affiliation-transfers/{transferId}/complete
 * OperationId: completeAffiliationTransfer
 */
export async function completeAffiliationTransfer(
  ctx: ValidatedContext<never, never, CompleteAffiliationTransferParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { transferId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const transferRepo = new AffiliationTransferRepository(db, logger);
  const affiliationRepo = new ChapterAffiliationRepository(db, logger);

  const transfer = await transferRepo.findOneById(transferId);
  if (!transfer) throw new NotFoundError('Affiliation transfer');

  if (transfer.status !== 'approved') {
    throw new BusinessLogicError(
      'Transfer must be fully approved before it can be completed',
      'INVALID_TRANSFER_STATUS',
    );
  }

  // Mark transfer as completed
  const updatedTransfer = await transferRepo.updateOneById(transferId, {
    status: 'completed',
    completedAt: new Date(),
  } as Partial<AffiliationTransfer>);

  // Find the source affiliation and mark it as transferred
  const sourceAffiliations = await affiliationRepo.findMany({
    organizationId: transfer.organizationId,
    personId: transfer.personId,
    chapterId: transfer.fromChapterId,
    status: 'active',
  });

  if (sourceAffiliations.length > 0) {
    await affiliationRepo.updateOneById(sourceAffiliations[0]!.id, {
      status: 'transferred',
    } as Partial<ChapterAffiliation>);
  }

  // Create new affiliation in the target chapter
  await affiliationRepo.createOne({
    organizationId: transfer.organizationId,
    personId: transfer.personId,
    chapterId: transfer.toChapterId,
    isPrimary: true,
    affiliatedAt: new Date(),
    transferredFrom: transfer.fromChapterId,
    status: 'active',
  });

  await auditAction(ctx, {
    action: 'complete',
    resourceType: 'affiliation-transfer',
    resourceId: transferId,
    description: 'Affiliation transfer completed',
  });

  return ctx.json(updatedTransfer, 200);
}
