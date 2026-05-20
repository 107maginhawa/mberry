import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateElectionBody, UpdateElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

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

  // Convert position strings to {id, title, sortOrder} objects if positions provided
  const updateData = { ...body } as Record<string, unknown>;
  if (Array.isArray(updateData['positions'])) {
    updateData['positions'] = (updateData['positions'] as string[]).map((p: string, i: number) => ({
      id: crypto.randomUUID(),
      title: p,
      sortOrder: i,
    }));
  }

  const updated = await repo.update(params.electionId, updateData);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'election',
    resourceId: updated.id,
    description: `Election updated: ${updated.title}`,
  });

  return ctx.json({ data: updated }, 200);
}
