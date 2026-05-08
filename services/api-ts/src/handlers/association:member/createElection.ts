import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { CreateElectionBody } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * createElection
 *
 * Path: POST /association/member/elections
 * OperationId: createElection
 */
export async function createElection(
  ctx: ValidatedContext<CreateElectionBody, never, never>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const election = await repo.create({
    ...body,
    organizationId: orgId,
    status: 'draft',
  } as any);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'election',
    resourceId: election.id,
    description: `Election created: ${election.title}`,
  });

  return ctx.json({ data: election }, 201);
}
