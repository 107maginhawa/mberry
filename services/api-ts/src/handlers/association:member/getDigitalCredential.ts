import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDigitalCredentialParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DigitalCredentialRepository } from './repos/credentials.repo';

/**
 * getDigitalCredential
 *
 * Path: GET /association/member/credentials/{credentialId}
 * OperationId: getDigitalCredential
 */
export async function getDigitalCredential(
  ctx: ValidatedContext<never, never, GetDigitalCredentialParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DigitalCredentialRepository(db, ctx.get('logger'));

  const credential = await repo.findOneById((params as any).credentialId);
  if (!credential) throw new NotFoundError('Digital credential');

  return ctx.json(credential, 200);
}
