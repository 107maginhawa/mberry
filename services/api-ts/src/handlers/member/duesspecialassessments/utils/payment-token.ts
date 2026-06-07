/**
 * HMAC-based payment token utilities for one-tap dues payment.
 * Reuses the same cryptographic pattern as invite tokens.
 * Tokens are signed with a server secret, never stored raw.
 */

import { createHmac, randomBytes } from 'crypto';
import { InternalError } from '@/core/errors';

const PAYMENT_TOKEN_EXPIRY_HOURS = 72;

/**
 * Generate a random payment token and its HMAC-SHA256 hash.
 * The raw token is sent to the member via link; only the hash is stored.
 */
export function generatePaymentToken(secret: string): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = hashPaymentToken(raw, secret);
  return { raw, hash };
}

/**
 * Hash a raw token with HMAC-SHA256.
 */
export function hashPaymentToken(raw: string, secret: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/**
 * Calculate the default expiry date (72 hours from now).
 */
export function defaultPaymentTokenExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + PAYMENT_TOKEN_EXPIRY_HOURS);
  return d;
}

/**
 * Check if a payment token has expired.
 */
export function isPaymentTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Get the payment token secret from environment.
 * Falls back to INVITE_TOKEN_SECRET if PAYMENT_TOKEN_SECRET is not set.
 */
export function getPaymentTokenSecret(): string {
  const secret = process.env['PAYMENT_TOKEN_SECRET'] || process.env['INVITE_TOKEN_SECRET'];
  if (!secret) {
    throw new InternalError(
      'Payment token secret not configured. Set PAYMENT_TOKEN_SECRET or INVITE_TOKEN_SECRET environment variable.'
    );
  }
  return secret;
}
