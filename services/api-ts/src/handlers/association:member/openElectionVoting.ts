import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { OpenElectionVotingParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';
import { domainEvents } from '@/core/domain-events';

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

  // Fix org context — middleware may have picked up electionId UUID instead of orgId
  ctx.set('organizationId', existing.organizationId);

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  if (existing.status !== 'nominationsOpen') {
    throw new BusinessLogicError('Election must be in nominations_open status to open voting', 'INVALID_STATUS_TRANSITION');
  }

  const nominees = await repo.listNominees(params.electionId);
  if (nominees.length === 0) {
    throw new BusinessLogicError('Election must have at least one nominee before voting can open', 'NO_NOMINEES');
  }

  // BR-33: Every position must have >= 2 candidates before voting opens
  const positions: { id: string; title: string }[] = (existing as Record<string, unknown>)['positions'] as { id: string; title: string }[] ?? [];
  if (positions.length > 0) {
    const countByPosition = new Map<string, number>();
    for (const pos of positions) {
      countByPosition.set(pos.id, 0);
    }
    for (const nom of nominees) {
      countByPosition.set(nom.positionId, (countByPosition.get(nom.positionId) ?? 0) + 1);
    }
    const insufficient: string[] = [];
    for (const pos of positions) {
      const count = countByPosition.get(pos.id) ?? 0;
      if (count < 2) {
        insufficient.push(`${pos.title} (${count} candidate${count === 1 ? '' : 's'})`);
      }
    }
    if (insufficient.length > 0) {
      throw new BusinessLogicError(
        `Each position must have at least 2 candidates. Insufficient: ${insufficient.join(', ')}`,
        'INSUFFICIENT_CANDIDATES',
      );
    }
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

  domainEvents.emit('election.status.changed', {
    electionId: updated.id,
    organizationId: existing.organizationId,
    oldStatus: 'nominationsOpen',
    newStatus: 'votingOpen',
    changedBy: ctx.get('user')?.id ?? '',
  }).catch(() => {});

  return ctx.json({ data: updated }, 200);
}
