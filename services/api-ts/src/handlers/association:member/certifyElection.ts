import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import type { CertifyElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * certifyElection
 *
 * Path: POST /association/member/elections/{electionId}/certify
 * OperationId: certifyElection
 *
 * BR-33: Only the President can certify an election, and only when
 * the election is in 'awaitingConfirmation' state (voting closed).
 */
export async function certifyElection(
  ctx: ValidatedContext<never, never, CertifyElectionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const user = ctx.get('user');

  // ─── Election lookup ─────────────────────────────────
  const repo = new ElectionsRepository(db);
  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

  // Fix org context — middleware may have picked up electionId UUID instead of orgId
  ctx.set('organizationId', existing.organizationId);

  // ─── President-only guard (BR-33) ────────────────────
  const officerRepo = new OfficerTermRepository(db);
  const orgId = existing.organizationId;
  if (!user) throw new UnauthorizedError();
  const activeTerms = await officerRepo.findActiveByPersonAndOrg(user.id, orgId);
  const isPresident = activeTerms.some(
    (t: any) => t.positionTitle === 'President',
  );
  if (!isPresident) {
    throw new ForbiddenError('Only the President can certify elections');
  }

  // ─── State guard: must be awaitingConfirmation (BR-33) ─
  if (existing.status !== 'awaitingConfirmation') {
    throw new BusinessLogicError(
      'Election must be in awaitingConfirmation status to certify',
      'INVALID_STATUS_TRANSITION',
    );
  }

  // Tally votes
  const tallies = await repo.getVoteTallies(params.electionId);
  const voterCount = await repo.getVoterCount(params.electionId);
  const nominees = await repo.listNominees(params.electionId);
  const nomineeToPerson = new Map(nominees.map((n) => [n.id, n.personId]));

  // ─── Winner determination (WF-078) ───────────────────
  // Highest votes per position wins. For bylaw elections, the winning
  // nominee must also clear passageThreshold (% of total voters).
  const maxByPosition = new Map<string, { nomineeId: string; count: number }>();
  for (const t of tallies) {
    const current = maxByPosition.get(t.positionId);
    if (!current || t.count > current.count) {
      maxByPosition.set(t.positionId, { nomineeId: t.nomineeId, count: t.count });
    }
  }

  const isBylaw = existing.type === 'bylaw';
  const threshold = existing.passageThreshold ?? null;

  const winners: { positionId: string; winnerId: string }[] = [];
  for (const [positionId, top] of maxByPosition) {
    if (isBylaw && threshold !== null) {
      const pct = voterCount > 0 ? (top.count / voterCount) * 100 : 0;
      if (pct < threshold) continue; // failed to pass threshold
    }
    await repo.updateNomineeStatus(top.nomineeId, 'elected');
    const winnerId = nomineeToPerson.get(top.nomineeId) ?? top.nomineeId;
    winners.push({ positionId, winnerId });
  }

  const updated = await repo.update(params.electionId, {
    status: 'published',
    publishedAt: new Date(),
  });

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', `Election certified and published: ${updated.title}`);
  ctx.set('auditDetails', { voterCount, tallies, winners });

  domainEvents.emit('election.published', {
    electionId: updated.id,
    organizationId: existing.organizationId,
    publishedBy: user.id,
    winners,
  }).catch(() => {});

  return ctx.json({ data: { election: updated, tallies, voterCount, winners } }, 200);
}
