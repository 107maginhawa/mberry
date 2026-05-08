import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { CreateCandidateBody } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';

/**
 * createCandidate
 *
 * Path: POST /association/member/candidates
 * OperationId: createCandidate
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

  const user = ctx.get('user');

  const nominee = await repo.addNominee({
    electionId: body.electionId,
    positionId: body.positionId,
    personId: body.personId,
    nominatedBy: body.nominatedBy ?? user?.id ?? body.personId,
    organizationId: election.organizationId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'election-nominee',
    resourceId: nominee.id,
    description: `Nominee added to election ${body.electionId}`,
    details: { positionId: body.positionId, personId: body.personId },
  });

  return ctx.json({ data: nominee }, 201);
}
