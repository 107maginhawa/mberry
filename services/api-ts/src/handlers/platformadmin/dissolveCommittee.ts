import type { ValidatedContext } from '@/types/app';
import type { DissolveCommitteeBody, DissolveCommitteeParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ConflictError } from '@/core/errors';
import { CommitteeRepository } from '@/handlers/association:operations/repos/committee.repo';

/**
 * dissolveCommittee
 *
 * Path: POST /admin/committees/{id}/dissolve
 * OperationId: dissolveCommittee
 *
 * BR-39 (Committee Dissolution). Platform-admin only (gated by the generated
 * x-security-required-roles middleware). Transitions the committee to
 * 'completed', stamps dissolvedAt/dissolvedBy/dissolutionReason, and revokes
 * member access (committee_member.active=false) while RETAINING all committee
 * data. Idempotent guard: an already-completed committee returns 409.
 */
export async function dissolveCommittee(
  ctx: ValidatedContext<DissolveCommitteeBody, never, DissolveCommitteeParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const db = ctx.get('database') as DatabaseInstance;
  const id = ctx.req.param('id')!;
  const body = ctx.req.valid('json');
  const repo = new CommitteeRepository(db);

  const committee = await repo.get(id);
  if (!committee) {
    throw new NotFoundError('Committee not found');
  }

  // BR-39: a committee can only be dissolved once.
  if (committee.status === 'completed') {
    throw new ConflictError('Committee is already dissolved');
  }

  const dissolved = await repo.dissolve(id, session.user.id, body?.reason);

  // x-audit middleware composes the audit event after this handler returns.
  ctx.set('auditResourceId', id);

  return ctx.json(
    {
      data: {
        id: dissolved.id,
        name: dissolved.name,
        organizationId: dissolved.organizationId,
        status: dissolved.status,
        dissolvedAt: dissolved.dissolvedAt,
      },
    },
    200,
  );
}
