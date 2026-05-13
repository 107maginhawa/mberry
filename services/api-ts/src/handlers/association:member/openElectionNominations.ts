import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { OpenElectionNominationsParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * openElectionNominations
 *
 * Path: POST /association/member/elections/{electionId}/open-nominations
 * OperationId: openElectionNominations
 */
export async function openElectionNominations(
  ctx: ValidatedContext<never, never, OpenElectionNominationsParams>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(params.electionId);
  if (!existing) throw new NotFoundError('Election');

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

  return ctx.json({ data: updated }, 200);
}
