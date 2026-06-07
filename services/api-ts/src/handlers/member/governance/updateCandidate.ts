import type { ValidatedContext, AuditEventEntry } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { UpdateCandidateBody, UpdateCandidateParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { electionNominees } from '@/handlers/elections/repos/elections.schema';
import { eq } from 'drizzle-orm';
import { requireOfficerTerm } from '@/core/auth/officer-checks';

/**
 * updateCandidate
 *
 * Path: PATCH /association/member/candidates/{candidateId}
 * OperationId: updateCandidate
 */
export async function updateCandidate(
  ctx: ValidatedContext<UpdateCandidateBody, never, UpdateCandidateParams>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

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
  const bodyRecord = body as Record<string, unknown>;

  const auditEvents: AuditEventEntry[] = [];
  ctx.set('auditEvents', auditEvents);

  // Use updateNomineeStatus if status is being updated
  if (bodyRecord['status']) {
    const updated = await repo.updateNomineeStatus(params.candidateId, bodyRecord['status'] as string);

    auditEvents.push({
      action: 'update',
      resourceType: 'election-nominee',
      resource: params.candidateId,
      description: `Nominee status updated to ${bodyRecord['status'] as string}`,
    });

    return ctx.json({ data: updated }, 200);
  }

  // Generic field update
  const [updated] = await db
    .update(electionNominees)
    .set({ ...bodyRecord, updatedAt: new Date() } as Record<string, unknown>)
    .where(eq(electionNominees.id, params.candidateId))
    .returning();

  auditEvents.push({
    action: 'update',
    resourceType: 'election-nominee',
    resource: params.candidateId,
    description: 'Nominee updated',
  });

  return ctx.json({ data: updated }, 200);
}
