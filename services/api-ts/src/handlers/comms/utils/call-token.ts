/**
 * Video-call signaling token (P0 — comms security remediation).
 *
 * Mints and verifies a short-lived, HMAC-SHA256-signed token that binds a
 * person to a specific active video call. The WebSocket signaling/relay path
 * (`ws.chat-room.ts`) verifies this token before relaying any `video.*` frame,
 * so that mere room membership is no longer sufficient to drive an active
 * call's signaling.
 *
 * SECURITY: the signing secret comes from the centralized validated config
 * accessor `getCallSigningSecret()` — there is NO runtime `dev-fallback`. In
 * production a missing/default secret throws (fail-closed). The token is signed
 * over `{ callId, personId, exp }` and is rejected if expired, forged, or bound
 * to a different call/person.
 *
 * Token format: base64url(JSON.stringify({ callId, personId, exp })).hmacHex
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { getCallSigningSecret } from '@/core/config';

/** Default token lifetime — calls are short-lived; signaling tokens even more so. */
export const CALL_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

interface CallTokenPayload {
  /** The active call message id this token authorizes signaling for. */
  callId: string;
  /** The person the token was minted for. */
  personId: string;
  /** Unix epoch seconds after which the token is invalid. */
  exp: number;
}

/**
 * Mint a signed call token bound to `{ callId, personId }`, expiring after
 * `ttlSeconds`. Throws (via getCallSigningSecret) when the secret is absent in
 * production — callers must let this propagate so the join fails closed rather
 * than signing with a constant.
 */
export function generateCallToken(opts: {
  callId: string;
  personId: string;
  ttlSeconds?: number;
  /** Test/override hook; production code passes nothing and uses the accessor. */
  secret?: string;
}): string {
  const signingKey = opts.secret ?? getCallSigningSecret();
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? CALL_TOKEN_TTL_SECONDS);
  const payload: CallTokenPayload = { callId: opts.callId, personId: opts.personId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingKey).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

export type CallTokenVerifyResult =
  | { valid: true; payload: CallTokenPayload }
  | { valid: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-call' | 'wrong-person' };

/**
 * Verify a call token. Recomputes the HMAC with the validated secret and
 * checks expiry plus (when supplied) the expected callId/personId binding.
 *
 * Returns a discriminated result rather than throwing so the relay path can
 * silently drop a bad frame. The secret resolution itself still fails closed in
 * production (no dev-fallback).
 */
export function verifyCallToken(
  token: string,
  expected: { callId: string; personId?: string; secret?: string },
): CallTokenVerifyResult {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'malformed' };
  }

  const dotIdx = token.lastIndexOf('.');
  const encoded = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);
  if (!encoded || !signature) {
    return { valid: false, reason: 'malformed' };
  }

  const signingKey = expected.secret ?? getCallSigningSecret();
  const expectedSig = createHmac('sha256', signingKey).update(encoded).digest('hex');

  // Constant-time compare; length mismatch is an immediate signature failure.
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'bad-signature' };
  }

  let payload: CallTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as CallTokenPayload;
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (
    !payload ||
    typeof payload.callId !== 'string' ||
    typeof payload.personId !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { valid: false, reason: 'malformed' };
  }

  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    return { valid: false, reason: 'expired' };
  }

  if (payload.callId !== expected.callId) {
    return { valid: false, reason: 'wrong-call' };
  }

  if (expected.personId !== undefined && payload.personId !== expected.personId) {
    return { valid: false, reason: 'wrong-person' };
  }

  return { valid: true, payload };
}
