import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListPendingProofsQuery } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * listPendingProofs
 *
 * Path: GET /association/member/dues-payments/pending-proofs
 * OperationId: listPendingProofs
 *
 * Lists payments with status 'submitted' for an organization,
 * awaiting officer review.
 */
export async function listPendingProofs(
  ctx: ValidatedContext<never, ListPendingProofsQuery, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const orgId = query.organizationId ?? (ctx.get('organizationId') as string);
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const { data, total } = await repo.listPayments({
    organizationId: orgId,
    status: 'submitted',
    limit: query.limit ?? 25,
    offset: query.offset ?? 0,
  });

  // Enrich with proof details
  const enriched = data.map((p) => ({
    ...p,
    proof: p.proofStorageKey ? {
      paymentId: p.id,
      storageKey: p.proofStorageKey,
      fileName: p.proofFileName,
      mimeType: p.proofMimeType,
      uploadedAt: p.paidAt?.toISOString() ?? p.createdAt?.toISOString(),
    } : undefined,
  }));

  return ctx.json({
    data: enriched,
    pagination: {
      total,
      limit: query.limit ?? 25,
      offset: query.offset ?? 0,
    },
  }, 200);
}
