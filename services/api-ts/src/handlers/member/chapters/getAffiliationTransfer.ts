import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetAffiliationTransferParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { AffiliationTransferRepository } from '@/handlers/association:member/repos/chapters.repo';

/**
 * getAffiliationTransfer
 *
 * Path: GET /association/member/affiliation-transfers/{transferId}
 * OperationId: getAffiliationTransfer
 */
export async function getAffiliationTransfer(
  ctx: ValidatedContext<never, never, GetAffiliationTransferParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AffiliationTransferRepository(db, ctx.get('logger'));

  const { transferId } = params as { transferId: string };
  const transfer = await repo.findOneById(transferId);
  if (!transfer) throw new NotFoundError('Affiliation transfer');

  return ctx.json(transfer, 200);
}
