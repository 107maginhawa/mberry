/**
 * QR check-in HMAC utility.
 * Generates and verifies HMAC-signed QR codes for event/training attendance.
 * Reuses the same pattern as invite and payment tokens.
 */

import { createHmac } from 'crypto';

interface QrPayload {
  eventId: string;
  type: 'event' | 'training';
  issuedAt: number;
}

/**
 * Generate a QR check-in token for an event or training session.
 * Token is HMAC-signed and encodes the event reference.
 */
export function generateQrToken(eventId: string, type: 'event' | 'training', secret: string): string {
  const payload: QrPayload = { eventId, type, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a QR check-in token.
 * Returns null if invalid or expired (24-hour validity).
 */
export function verifyQrToken(token: string, secret: string): QrPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expected = createHmac('sha256', secret).update(encoded!).digest('base64url');
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded!, 'base64url').toString()) as QrPayload;
    const ageMs = Date.now() - payload.issuedAt;
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    if (ageMs > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}
