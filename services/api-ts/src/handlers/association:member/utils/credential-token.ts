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
