/**
 * Credential verification token utilities.
 * Encodes credentialId + organizationId into HMAC-signed token for public credential verification.
 * Reuses the payment-token.ts pattern.
 */

import { createHmac } from 'crypto';

interface CredentialTokenPayload {
  credentialId: string;
  organizationId: string;
  issuedAt: number;
}

/**
 * Resolve the HMAC secret for credential verification tokens.
 *
 * FIX-012 (G16): fail closed. The old `?? 'dev-credential-verify-secret'`
 * literal made every issued credential token forgeable in any environment that
 * forgot to set the secret — anyone could mint a token that validated. In
 * production we now REFUSE the guessable fallback and throw; outside production
 * the dev literal is allowed so local/test flows keep working. Mirrors the
 * id-card-data.ts fail-closed pattern (BR-18).
 */
export function resolveCredentialVerifySecret(): string {
  const secret = process.env['CREDENTIAL_VERIFY_SECRET'];
  if (secret) return secret;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'CREDENTIAL_VERIFY_SECRET is not configured. Set it — refusing to sign/verify ' +
        'credential tokens with a guessable fallback secret (BR-18, FIX-012).',
    );
  }
  return 'dev-credential-verify-secret';
}

/**
 * Create a signed credential verification token.
 */
export function createCredentialToken(credentialId: string, organizationId: string, secret: string): string {
  const payload: CredentialTokenPayload = {
    credentialId,
    organizationId,
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a credential verification token. Returns null if invalid.
 * Note: Credential tokens do not expire — they are valid as long as the credential itself is active.
 */
export function verifyCredentialToken(token: string, secret: string): CredentialTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expected = createHmac('sha256', secret).update(encoded!).digest('base64url');
  if (sig !== expected) return null;

  try {
    return JSON.parse(Buffer.from(encoded!, 'base64url').toString()) as CredentialTokenPayload;
  } catch {
    return null;
  }
}
