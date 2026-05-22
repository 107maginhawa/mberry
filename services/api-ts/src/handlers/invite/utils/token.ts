/**
 * HMAC-based invite token utilities.
 * Tokens are signed with a server secret, never stored raw.
 */

import { createHmac, randomBytes } from 'crypto';

const INVITE_TOKEN_EXPIRY_DAYS = 7;

/**
 * Generate a random invite token and its HMAC hash.
 * The raw token is sent to the user; only the hash is stored.
 */
export function generateInviteToken(secret: string): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = hashToken(raw, secret);
  return { raw, hash };
}

/**
 * Hash a raw token with HMAC-SHA256.
 */
export function hashToken(raw: string, secret: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/**
 * Calculate the default expiry date (7 days from now).
 */
export function defaultExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TOKEN_EXPIRY_DAYS);
  return d;
}

/**
 * Check if a token has expired.
 */
export function isExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}
