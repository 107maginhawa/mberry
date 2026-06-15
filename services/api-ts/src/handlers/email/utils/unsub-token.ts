/**
 * HMAC-based unsubscribe token generation and verification
 *
 * Tokens are deterministic (email + orgId → token) so they can be embedded
 * in email links without being stored server-side.
 *
 * Security: T-25-01 — tamper protection via HMAC-SHA256 with server secret.
 * An attacker who knows only the email address cannot forge a valid token
 * without knowing UNSUBSCRIBE_SECRET.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getUnsubscribeSecret } from '@/core/config';

/** Payload separator — neither field may contain this character */
const SEP = '|';

/**
 * HMAC secret, resolved via the validated config accessor (single source of
 * truth; dev fallback only outside production, fails loud in prod).
 */
function getSecret(): string {
  return getUnsubscribeSecret();
}

/**
 * Generate an HMAC-SHA256 token for the given email and orgId.
 * The token is base64url-encoded (no padding, URL-safe).
 *
 * @param email  - Recipient email address
 * @param orgId  - Organization ID
 * @returns      Base64url-encoded HMAC token
 */
export function generateUnsubToken(email: string, orgId: string): string {
  const payload = `${email}${SEP}${orgId}`;
  const hmac = createHmac('sha256', getSecret());
  hmac.update(payload);
  return hmac.digest('base64url');
}

/**
 * Verify an unsubscribe token against the expected email and orgId.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param token  - Token submitted by the user
 * @param email  - Expected recipient email
 * @param orgId  - Expected organization ID
 * @returns      true if the token is valid
 */
export function verifyUnsubToken(token: string, email: string, orgId: string): boolean {
  try {
    const expected = generateUnsubToken(email, orgId);

    const tokenBuf = Buffer.from(token, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');

    if (tokenBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}
