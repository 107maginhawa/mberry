import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DeleteElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { elections } from '../elections/repos/elections.schema';
import { eq } from 'drizzle-orm';
import { requireOfficerTerm } from '@/utils/officer-check';
import { domainEvents } from '@/core/domain-events';

/**
 * deleteElection
 *
 * Path: DELETE /association/member/elections/{electionId}
 * OperationId: deleteElection
 */
export async function deleteElection(
  ctx: ValidatedContext<never, never, DeleteElectionParams>
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

  // [EM-M12-b9c0d1e2] Spec allows deleting draft OR cancelled elections.
  // Published/in-progress elections must be cancelled first (preserves the
  // audit/vote record).
  if (existing.status !== 'draft' && existing.status !== 'cancelled') {
    throw new BusinessLogicError(
      'Only draft or cancelled elections can be deleted',
      'ELECTION_NOT_DELETABLE',
    );
  }

  await db.delete(elections).where(eq(elections.id, params.electionId));

  ctx.set('auditResourceId', params.electionId);
  ctx.set('auditDescription', `Election deleted: ${existing.title}`);

  domainEvents.emit('election.deleted', {
    electionId: params.electionId,
    organizationId: existing.organizationId,
    deletedBy: ctx.get('user')?.id ?? '',
  }).catch(() => {});

  return ctx.json({ success: true }, 200);
}
