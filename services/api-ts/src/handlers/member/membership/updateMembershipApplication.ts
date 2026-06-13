import type { ValidatedContext } from '@/types/app';
import type { MembershipApplication } from '@/handlers/association:member/repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { UpdateMembershipApplicationBody, UpdateMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';
import { assertRecordInCallerOrg } from './utils/assert-record-org';

/**
 * updateMembershipApplication
 *
 * Path: PATCH /association/member/applications/{applicationId}
 * OperationId: updateMembershipApplication
 */
export async function updateMembershipApplication(
  ctx: ValidatedContext<UpdateMembershipApplicationBody, never, UpdateMembershipApplicationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(applicationId);
  if (!existing) throw new NotFoundError('Membership application');
  // FIX-003 (G-02): the application must belong to the caller's org.
  assertRecordInCallerOrg(ctx, existing.organizationId, 'this application');

  // FIX-013 (G-15): the update body's generated shape still exposes personId /
  // organizationId (TypeSpec body-field removal is deferred to its own regen
  // pass). Strip the identity fields here so an admin cannot rewrite WHO
  // applied or for WHICH org; only mutable fields are forwarded to the repo.
  const { personId: _personId, organizationId: _organizationId, ...mutable } =
    body as Record<string, unknown>;

  const updated = await repo.updateOneById(applicationId, mutable as Partial<MembershipApplication>);

  ctx.set('auditResourceId', applicationId);
  ctx.set('auditDescription', 'Membership application updated');

  return ctx.json(updated, 200);
}
