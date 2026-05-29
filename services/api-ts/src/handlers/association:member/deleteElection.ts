import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { DeleteElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { elections } from '../elections/repos/elections.schema';
import { eq } from 'drizzle-orm';
import { auditAction } from '@/utils/audit';
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

  domainEvents.emit('election.deleted', {
    electionId: params.electionId,
    organizationId: existing.organizationId,
    deletedBy: ctx.get('user')?.id ?? '',
  }).catch(() => {});

  return ctx.json({ success: true }, 200);
}
