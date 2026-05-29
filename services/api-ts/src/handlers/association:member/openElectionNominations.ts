import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { OpenElectionNominationsParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';
import { domainEvents } from '@/core/domain-events';

/**
 * openElectionNominations
 *
 * Path: POST /association/member/elections/{electionId}/open-nominations
 * OperationId: openElectionNominations
 */
export async function openElectionNominations(
  ctx: ValidatedContext<never, never, OpenElectionNominationsParams>
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
    throw new BusinessLogicError('Only draft elections can open nominations', 'INVALID_STATUS_TRANSITION');
  }

  const updated = await repo.update(params.electionId, {
    status: 'nominationsOpen',
    nominationsOpenAt: new Date(),
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'election',
    resourceId: updated.id,
    description: `Election nominations opened: ${updated.title}`,
  });

  domainEvents.emit('election.status.changed', {
    electionId: updated.id,
    organizationId: existing.organizationId,
    oldStatus: 'draft',
    newStatus: 'nominationsOpen',
    changedBy: ctx.get('user')?.id ?? '',
  }).catch(() => {});

  return ctx.json({ data: updated }, 200);
}
