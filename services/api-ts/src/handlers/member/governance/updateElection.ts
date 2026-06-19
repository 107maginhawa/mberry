import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { UpdateElectionBody, UpdateElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';
import { resolveElectionPositionSlots } from './resolve-election-positions';
import { requireOfficerTerm } from '@/core/auth/officer-checks';

// AHA FIX-005 (G5): elections in these terminal states are immutable. `published`
// enforces M12-R2 / AC-M12-003 result finality; `cancelled` is terminal in
// ELECTION_VALID_TRANSITIONS. No field (title/dates/positions) may be edited once here.
const IMMUTABLE_ELECTION_STATES = ['published', 'cancelled'];

/**
 * updateElection
 *
 * Path: PATCH /association/member/elections/{electionId}
 * OperationId: updateElection
 */
export async function updateElection(
  ctx: ValidatedContext<UpdateElectionBody, never, UpdateElectionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

  // Fix org context — middleware may have picked up electionId UUID instead of orgId
  ctx.set('organizationId', existing.organizationId);

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  // AHA FIX-005 (G5): state/immutability guard.
  // 1) Published/cancelled elections are terminal — reject ALL mutation (result finality).
  if (IMMUTABLE_ELECTION_STATES.includes(existing.status)) {
    throw new BusinessLogicError(
      `A ${existing.status} election can no longer be modified`,
      'ELECTION_IMMUTABLE',
    );
  }
  // 2) Positions are frozen once nominations open. Regenerating position ids after
  //    `draft` would orphan nominee/vote position references, so changing the
  //    positions list is only permitted while the election is still a draft.
  const bodyRecord = body as Record<string, unknown>;
  if (Array.isArray(bodyRecord['positions']) && existing.status !== 'draft') {
    throw new BusinessLogicError(
      'Election positions cannot be changed after nominations have opened',
      'ELECTION_POSITIONS_LOCKED',
    );
  }

  // AHA FIX-002 (G2): resolve position titles to REAL `position` rows (canonical
  // identity) instead of minting random UUIDs that would orphan nominee/vote FKs.
  // Only reachable while the election is still a draft (guarded above).
  const updateData = { ...body } as Record<string, unknown>;
  if (Array.isArray(updateData['positions'])) {
    const positionRepo = new PositionRepository(db, ctx.get('logger'));
    updateData['positions'] = await resolveElectionPositionSlots(
      positionRepo,
      existing.organizationId,
      updateData['positions'] as string[],
    );
  }

  const updated = await repo.update(params.electionId, updateData);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', `Election updated: ${updated.title}`);

  return ctx.json(updated, 200);
}
