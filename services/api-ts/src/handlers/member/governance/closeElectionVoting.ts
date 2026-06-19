import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CloseElectionVotingParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { requireOfficerTerm } from '@/core/auth/officer-checks';
import { ELECTION_VALID_TRANSITIONS, isValidTransition } from '@/utils/status-transitions';
import { domainEvents } from '@/core/domain-events';

/**
 * closeElectionVoting
 *
 * Path: POST /association/member/elections/{electionId}/close-voting
 * OperationId: closeElectionVoting
 *
 * AHA FIX-001 (G1): closes the voting period, transitioning an election from
 * `votingOpen` to `awaitingConfirmation`. This is the ONLY operation that reaches
 * `awaitingConfirmation` — the state that `certifyElection` requires — so without
 * it the election lifecycle had a hard dead end and could never be certified
 * through the product. Transitions are governed by `ELECTION_VALID_TRANSITIONS`;
 * any source state other than `votingOpen` is rejected with 422.
 */
export async function closeElectionVoting(
  ctx: ValidatedContext<never, never, CloseElectionVotingParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

  // Fix org context — middleware may have picked up electionId UUID instead of orgId
  ctx.set('organizationId', existing.organizationId);

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  // State guard — only votingOpen → awaitingConfirmation is permitted.
  if (!isValidTransition(ELECTION_VALID_TRANSITIONS, existing.status, 'awaitingConfirmation')) {
    throw new BusinessLogicError(
      'Election must be in votingOpen status to close voting',
      'INVALID_STATUS_TRANSITION',
    );
  }

  const updated = await repo.update(params.electionId, {
    status: 'awaitingConfirmation',
    votingCloseAt: new Date(),
  });

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', `Election voting closed: ${updated.title}`);

  domainEvents.emit('election.status.changed', {
    electionId: updated.id,
    organizationId: existing.organizationId,
    oldStatus: 'votingOpen',
    newStatus: 'awaitingConfirmation',
    changedBy: ctx.get('user')?.id ?? '',
  }).catch(() => {});

  return ctx.json(updated, 200);
}
