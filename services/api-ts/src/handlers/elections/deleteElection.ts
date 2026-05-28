import type { Context } from 'hono';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';
import type { Session } from '@/types/auth';

export async function deleteElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const id = ctx.req.param('id');

  // Officer authorization
  const electionRepo = new ElectionsRepository(db);
  const existing = await electionRepo.get(id!);
  if (!existing) throw new NotFoundError('Election not found');

  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, existing.organizationId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to delete elections');
  }

  // Draft-only guard
  if (existing.status !== 'draft') {
    throw new BusinessLogicError(
      'Only draft elections can be deleted',
      'ELECTION_NOT_DRAFT',
    );
  }

  await electionRepo.delete(id!);

  domainEvents.emit('election.deleted', {
    electionId: id!,
    organizationId: existing.organizationId,
    deletedBy: session.user.id,
  }).catch(() => {});

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'election',
    resourceId: id!,
    description: 'Draft election deleted',
  });

  return ctx.json({ success: true }, 200);
}
