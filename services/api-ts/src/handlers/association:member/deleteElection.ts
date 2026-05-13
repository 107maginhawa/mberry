import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DeleteElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { elections } from '../elections/repos/elections.schema';
import { eq } from 'drizzle-orm';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * deleteElection
 *
 * Path: DELETE /association/member/elections/{electionId}
 * OperationId: deleteElection
 */
export async function deleteElection(
  ctx: ValidatedContext<never, never, DeleteElectionParams>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft elections can be deleted', 'ELECTION_NOT_DRAFT');
  }

  await db.delete(elections).where(eq(elections.id, params.electionId));

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'election',
    resourceId: params.electionId,
    description: `Election deleted: ${existing.title}`,
  });

  return ctx.json({ success: true }, 200);
}
