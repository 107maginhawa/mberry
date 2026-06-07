import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { VerifyCredentialPublicBody } from '@/generated/openapi/validators';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';
import { verifyCredentialToken } from '@/handlers/association:member/utils/credential-token';

/**
 * verifyCredentialPublic
 *
 * Path: POST /association/member/credentials/public-verify
 * OperationId: verifyCredentialPublic
 *
 * PUBLIC endpoint -- NO auth required.
 * Takes an HMAC token, verifies signature, returns credential status + member info.
 */
export async function verifyCredentialPublic(
  ctx: ValidatedContext<VerifyCredentialPublicBody, never, never>
): Promise<Response> {
  // NO auth check -- this is a public endpoint

  const body = ctx.req.valid('json');
  const secret = process.env['CREDENTIAL_VERIFY_SECRET'] || 'dev-credential-verify-secret';

  // Verify HMAC signature
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

  // Determine verification result based on credential status
  let result: 'valid' | 'expired' | 'revoked' | 'notFound';
  if (credential.status === 'revoked') {
    result = 'revoked';
  } else if (credential.status === 'expired' || (credential.expiresAt && credential.expiresAt < new Date())) {
    result = 'expired';
  } else if (credential.status === 'active') {
    result = 'valid';
  } else {
    // suspended or other
    result = 'revoked';
  }

  return ctx.json({
    result,
    credential,
  }, 200);
}
