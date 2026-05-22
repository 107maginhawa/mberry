/**
 * Cryptographic utilities for security-sensitive operations.
 *
 * P0-2: Session token hashing — Better-Auth stores session tokens as plaintext
 * in the DB. This module provides HMAC-SHA256 hashing so that a custom adapter
 * wrapper can store hashes instead of raw tokens, preventing session hijack on
 * DB compromise.
 *
 * Uses Node.js built-in crypto (zero dependencies).
 */

import { createHmac, createHash, randomBytes, timingSafeEqual as _timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256 a value with a secret key.
 * Used for session token hashing where we need deterministic output
 * (same input + key = same hash) for DB lookups.
 */
export function hmacSha256(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Plain SHA-256 hash (no key). Use for non-secret integrity checks.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a cryptographically secure random hex string.
 */
export function randomHex(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return _timingSafeEqual(bufA, bufB);
}
