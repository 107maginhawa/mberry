import type { ValidatedContext } from '@/types/app';
import type { DigitalCredential } from '@/handlers/association:member/repos/credentials.schema';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateDigitalCredentialBody, UpdateDigitalCredentialParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

/**
 * updateDigitalCredential
 *
 * Path: PATCH /association/member/credentials/{credentialId}
 * OperationId: updateDigitalCredential
 */
export async function updateDigitalCredential(
  ctx: ValidatedContext<UpdateDigitalCredentialBody, never, UpdateDigitalCredentialParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { credentialId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DigitalCredentialRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(credentialId);
  if (!existing) throw new NotFoundError('Digital credential');

  const updated = await repo.updateOneById(credentialId, body as Partial<DigitalCredential>);

  ctx.set('auditResourceId', credentialId);
  ctx.set('auditDescription', 'Digital credential updated');

  return ctx.json(updated, 200);
}
