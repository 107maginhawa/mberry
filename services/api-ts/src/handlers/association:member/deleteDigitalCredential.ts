import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteDigitalCredentialParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DigitalCredentialRepository } from './repos/credentials.repo';

/**
 * deleteDigitalCredential
 *
 * Path: DELETE /association/member/credentials/{credentialId}
 * OperationId: deleteDigitalCredential
 */
export async function deleteDigitalCredential(
  ctx: ValidatedContext<never, never, DeleteDigitalCredentialParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { credentialId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DigitalCredentialRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(credentialId);
  if (!existing) throw new NotFoundError('Digital credential');

  await repo.deleteOneById(credentialId);

  ctx.set('auditResourceId', credentialId);
  ctx.set('auditDescription', 'Digital credential deleted');

  return ctx.body(null, 204);
}
