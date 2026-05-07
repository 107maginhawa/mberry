import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { OpenElectionVotingParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';

/**
 * openElectionVoting
 *
 * Path: POST /association/member/elections/{electionId}/open-voting
 * OperationId: openElectionVoting
 */
export async function openElectionVoting(
  ctx: ValidatedContext<never, never, OpenElectionVotingParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

  if (existing.status !== 'nominationsOpen') {
    throw new BusinessLogicError('Election must be in nominations_open status to open voting', 'INVALID_STATUS_TRANSITION');
  }

  const nominees = await repo.listNominees(params.electionId);
  if (nominees.length === 0) {
    throw new BusinessLogicError('Election must have at least one nominee before voting can open', 'NO_NOMINEES');
  }

  const updated = await repo.update(params.electionId, {
    status: 'votingOpen',
    votingOpenAt: new Date(),
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'election',
    resourceId: updated.id,
    description: `Election voting opened: ${updated.title}`,
  });

  return ctx.json({ data: updated }, 200);
}
