import type { ValidatedContext } from '@/types/app';
import type { DigitalCredential } from './repos/credentials.schema';
import type { DatabaseInstance } from '@/core/database';
import type { RevokeDigitalCredentialBody, RevokeDigitalCredentialParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DigitalCredentialRepository } from './repos/credentials.repo';

/**
 * revokeDigitalCredential
 *
 * Path: POST /association/member/credentials/{credentialId}/revoke
 * OperationId: revokeDigitalCredential
 *
 * Sets the credential status to 'revoked'. Revocation persists through verification.
 */
export async function revokeDigitalCredential(
  ctx: ValidatedContext<RevokeDigitalCredentialBody, never, RevokeDigitalCredentialParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const { credentialId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DigitalCredentialRepository(db, logger);

  const existing = await repo.findOneById(credentialId);
  if (!existing) throw new NotFoundError('Digital credential');

  if (existing.status === 'revoked') {
    throw new BusinessLogicError('Credential is already revoked', 'ALREADY_REVOKED');
  }

  const updated = await repo.updateOneById(credentialId, {
    status: 'revoked',
    revokedAt: new Date(),
    revocationReason: body.reason,
  } as Partial<DigitalCredential>);

  ctx.set('auditResourceId', credentialId);
  ctx.set('auditDescription', `Digital credential revoked: ${body.reason}`);

  return ctx.json(updated, 200);
}
