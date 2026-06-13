import type { ValidatedContext } from '@/types/app';
import type { DuesConfig } from '@/handlers/association:member/repos/dues.schema';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { UpdateDuesConfigBody, UpdateDuesConfigParams } from '@/generated/openapi/validators';
import { DuesConfigRepository } from '@/handlers/association:member/repos/dues.repo';

/**
 * updateDuesConfig
 *
 * Path: PATCH /association/member/dues-configs/{duesConfigId}
 * OperationId: updateDuesConfig
 */
export async function updateDuesConfig(
  ctx: ValidatedContext<UpdateDuesConfigBody, never, UpdateDuesConfigParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { duesConfigId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesConfigRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(duesConfigId);
  if (!existing) throw new NotFoundError('DuesConfig');

  // Cross-org tenant guard: findOneById is unscoped (by id only), so an officer
  // of org A must not be able to mutate org B's dues config by supplying its id.
  // Mirrors confirmPaymentProof / refundDuesPayment / updateDunningTemplate.
  if (existing.organizationId !== ctx.get('organizationId')) {
    throw new ForbiddenError('Dues config does not belong to this organization');
  }

  const updated = await repo.updateOneById(duesConfigId, body as Partial<DuesConfig>);

  ctx.set('auditResourceId', duesConfigId);
  ctx.set('auditDescription', 'Dues config updated');

  return ctx.json(updated, 200);
}
