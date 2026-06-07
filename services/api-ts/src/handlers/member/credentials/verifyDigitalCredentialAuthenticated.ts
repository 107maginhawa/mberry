import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { VerifyDigitalCredentialAuthenticatedBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';
import { verifyCredentialToken } from '@/handlers/association:member/utils/credential-token';

/**
 * verifyDigitalCredentialAuthenticated
 *
 * Path: POST /association/member/credentials/verify
 * OperationId: verifyDigitalCredentialAuthenticated
 *
 * Authenticated version of credential verification. Same logic as public
 * but requires a session.
 */
export async function verifyDigitalCredentialAuthenticated(
  ctx: ValidatedContext<VerifyDigitalCredentialAuthenticatedBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const secret = process.env['CREDENTIAL_VERIFY_SECRET'] || 'dev-credential-verify-secret';

  const payload = verifyCredentialToken(body.token, secret);
  if (!payload) {
    return ctx.json({
      result: 'notFound',
      credential: null,
    }, 200);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DigitalCredentialRepository(db, ctx.get('logger'));

  const credential = await repo.findOneById(payload.credentialId);
  if (!credential) {
    return ctx.json({
      result: 'notFound',
      credential: null,
    }, 200);
  }

  let result: 'valid' | 'expired' | 'revoked' | 'notFound';
  if (credential.status === 'revoked') {
    result = 'revoked';
  } else if (credential.status === 'expired' || (credential.expiresAt && credential.expiresAt < new Date())) {
    result = 'expired';
  } else if (credential.status === 'active') {
    result = 'valid';
  } else {
    result = 'revoked';
  }

  return ctx.json({
    result,
    credential,
  }, 200);
}
