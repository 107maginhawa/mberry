import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CertifyElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';

/**
 * certifyElection
 *
 * Path: POST /association/member/elections/{electionId}/certify
 * OperationId: certifyElection
 */
export async function certifyElection(
  ctx: ValidatedContext<never, never, CertifyElectionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

  if (existing.status !== 'votingOpen' && existing.status !== 'awaitingConfirmation') {
    throw new BusinessLogicError('Election must be in votingOpen or awaitingConfirmation status to certify', 'INVALID_STATUS_TRANSITION');
  }

  // Tally votes
  const tallies = await repo.getVoteTallies(params.electionId);
  const voterCount = await repo.getVoterCount(params.electionId);

  const updated = await repo.update(params.electionId, {
    status: 'published',
    publishedAt: new Date(),
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'election',
    resourceId: updated.id,
    description: `Election certified and published: ${updated.title}`,
    details: { voterCount, tallies },
  });

  return ctx.json({ data: { election: updated, tallies, voterCount } }, 200);
}
