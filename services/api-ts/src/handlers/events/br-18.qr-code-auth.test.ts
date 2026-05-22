// Business Rules: [BR-18]
/**
 * [BR-18] QR Code Cryptographic Signing — Pure Domain Logic Tests
 *
 * BR-18: QR codes embedded on tickets and ID cards must be cryptographically signed.
 * - The payload includes a canonical identifier (member ID or ticket ID) and a timestamp.
 * - Verification checks the HMAC-SHA256 signature against the server secret.
 * - Tampered payloads fail verification.
 * - Expired signatures (beyond the validity window) are rejected.
 */

import { describe, test, expect } from 'bun:test';
import { createHmac, timingSafeEqual } from 'crypto';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Domain helpers (pure, no DB, no HTTP) ──────────────────

const QR_SECRET = 'test-secret-key-br-18-do-not-use-in-prod';
const QR_VALIDITY_SECONDS = 300; // 5 minutes

interface QrPayload {
  type: 'ticket' | 'id_card';
  id: string; // ticketId or memberId
  issuedAt: number; // Unix timestamp (seconds)
}

/**
 * Signs a QR payload and returns a token string: base64(payload).signature
 */
function signQrPayload(payload: QrPayload, secret: string): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64');
  const sig = createHmac('sha256', secret).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

/**
 * Verifies a QR token.
 * Returns the decoded payload if valid; throws on invalid/expired.
 */
function verifyQrToken(
  token: string,
  secret: string,
  nowSeconds: number,
): QrPayload {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) throw new Error('INVALID_TOKEN_FORMAT');

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  // Timing-safe comparison
  const expectedSig = createHmac('sha256', secret).update(encoded).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error('INVALID_SIGNATURE');
  }

  const payload: QrPayload = JSON.parse(Buffer.from(encoded, 'base64').toString());

  if (nowSeconds - payload.issuedAt > QR_VALIDITY_SECONDS) {
    throw new Error('TOKEN_EXPIRED');
  }

  return payload;
}

// ─── [BR-18] Tests ──────────────────────────────────────────

describe('[BR-18] QR Code Signing', () => {
  const NOW = Math.floor(Date.now() / 1000);

  test('[BR-18] signed ticket QR token verifies successfully', () => {
    const payload: QrPayload = { type: 'ticket', id: 'ticket-001', issuedAt: NOW };
    const token = signQrPayload(payload, QR_SECRET);
    const decoded = verifyQrToken(token, QR_SECRET, NOW);
    expect(decoded.id).toBe('ticket-001');
    expect(decoded.type).toBe('ticket');
  });

  test('[BR-18] signed ID card QR token verifies successfully', () => {
    const payload: QrPayload = { type: 'id_card', id: 'member-abc', issuedAt: NOW };
    const token = signQrPayload(payload, QR_SECRET);
    const decoded = verifyQrToken(token, QR_SECRET, NOW);
    expect(decoded.type).toBe('id_card');
    expect(decoded.id).toBe('member-abc');
  });

  test('[BR-18] tampered payload fails signature check', () => {
    const payload: QrPayload = { type: 'ticket', id: 'ticket-002', issuedAt: NOW };
    const token = signQrPayload(payload, QR_SECRET);

    // Tamper: replace the base64 payload portion
    const [, sig] = token.split('.');
    const evilPayload = Buffer.from(JSON.stringify({ type: 'ticket', id: 'ticket-EVIL', issuedAt: NOW })).toString('base64');
    const tamperedToken = `${evilPayload}.${sig}`;

    expect(() => verifyQrToken(tamperedToken, QR_SECRET, NOW)).toThrow('INVALID_SIGNATURE');
  });

  test('[BR-18] token signed with wrong secret fails verification', () => {
    const payload: QrPayload = { type: 'ticket', id: 'ticket-003', issuedAt: NOW };
    const token = signQrPayload(payload, 'wrong-secret');
    expect(() => verifyQrToken(token, QR_SECRET, NOW)).toThrow('INVALID_SIGNATURE');
  });

  test('[BR-18] expired token is rejected', () => {
    const issuedAt = NOW - QR_VALIDITY_SECONDS - 1; // 1 second past expiry
    const payload: QrPayload = { type: 'id_card', id: 'member-expired', issuedAt };
    const token = signQrPayload(payload, QR_SECRET);
    expect(() => verifyQrToken(token, QR_SECRET, NOW)).toThrow('TOKEN_EXPIRED');
  });

  test('[BR-18] token at exactly the validity boundary is still valid', () => {
    const issuedAt = NOW - QR_VALIDITY_SECONDS; // exactly at limit
    const payload: QrPayload = { type: 'ticket', id: 'ticket-boundary', issuedAt };
    const token = signQrPayload(payload, QR_SECRET);
    // Should NOT throw (boundary is inclusive)
    const decoded = verifyQrToken(token, QR_SECRET, NOW);
    expect(decoded.id).toBe('ticket-boundary');
  });
});
