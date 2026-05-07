import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateCandidateBody, UpdateCandidateParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { electionNominees } from '../elections/repos/elections.schema';
import { eq } from 'drizzle-orm';
import { auditAction } from '@/utils/audit';

/**
 * updateCandidate
 *
 * Path: PATCH /association/member/candidates/{candidateId}
 * OperationId: updateCandidate
 */
export async function updateCandidate(
  ctx: ValidatedContext<UpdateCandidateBody, never, UpdateCandidateParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const [existing] = await db
    .select()
    .from(electionNominees)
    .where(eq(electionNominees.id, params.candidateId))
    .limit(1);

  if (!existing) throw new NotFoundError('Candidate');

  const repo = new ElectionsRepository(db);

  // Use updateNomineeStatus if status is being updated
  if ((body as any).status) {
    const updated = await repo.updateNomineeStatus(params.candidateId, (body as any).status);

    await auditAction(ctx, {
      action: 'update',
      resourceType: 'election-nominee',
      resourceId: params.candidateId,
      description: `Nominee status updated to ${(body as any).status}`,
    });

    return ctx.json({ data: updated }, 200);
  }

  // Generic field update
  const [updated] = await db
    .update(electionNominees)
    .set({ ...(body as any), updatedAt: new Date() })
    .where(eq(electionNominees.id, params.candidateId))
    .returning();

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'election-nominee',
    resourceId: params.candidateId,
    description: 'Nominee updated',
  });

  return ctx.json({ data: updated }, 200);
}
