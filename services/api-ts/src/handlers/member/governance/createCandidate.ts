import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CreateCandidateBody } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { computeMembershipStatus } from '@/handlers/association:member/utils/compute-membership-status';
import { domainEvents } from '@/core/domain-events';

/**
 * createCandidate
 *
 * Path: POST /association/member/candidates
 * OperationId: createCandidate
 *
 * BR-34: Nomination eligibility — nominee must be an active member and
 * the nomination must fall within the election's nomination period.
 */
export async function createCandidate(
  ctx: ValidatedContext<CreateCandidateBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  // Verify election exists
  const election = await repo.get(body.electionId);
  if (!election) throw new NotFoundError('Election');

  // ── BR-34: Check nomination period ──────────────────────
  const now = new Date();
  if (election.nominationsOpenAt && now < election.nominationsOpenAt) {
    throw new BusinessLogicError('Nomination period has not started yet');
  }
  if (election.nominationsCloseAt && now > election.nominationsCloseAt) {
    throw new BusinessLogicError('Nomination period has closed');
  }

  // ── BR-34: Check nominee membership eligibility ─────────
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.findByPersonAndOrg(
    body.personId,
    election.organizationId,
  );

  if (!membership) {
    throw new BusinessLogicError('Nominee is not a member of this organization');
  }

  const status = computeMembershipStatus({
    duesExpiryDate: membership.duesExpiryDate,
    gracePeriodDays: membership.gracePeriodDays,
    suspendedAt: membership.suspendedAt,
    removedAt: membership.removedAt,
  });

  if (status !== 'active') {
    throw new BusinessLogicError(
      `Nominee membership status is '${status}', must be 'active' to be nominated`,
    );
  }

  const user = ctx.get('user');

  const nominee = await repo.addNominee({
    electionId: body.electionId,
    positionId: body.positionId,
    personId: body.personId,
    nominatedBy: body.nominatedBy ?? user?.id ?? body.personId,
    organizationId: election.organizationId,
  });

  ctx.set('auditResourceId', nominee.id);
  ctx.set('auditDescription', `Nominee added to election ${body.electionId}`);
  ctx.set('auditDetails', { positionId: body.positionId, personId: body.personId });

  domainEvents.emit('nomination.submitted', {
    nomineeId: nominee.id,
    electionId: body.electionId,
    personId: body.personId,
    positionId: body.positionId,
    organizationId: election.organizationId,
  }).catch(() => {});

  return ctx.json({ data: nominee }, 201);
}
