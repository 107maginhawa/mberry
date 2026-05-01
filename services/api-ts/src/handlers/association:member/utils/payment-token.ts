/**
 * Payment link token utilities.
 * Encodes invoiceId + orgId into HMAC-signed token for public payment pages.
 */

import { createHmac } from 'crypto';

interface PaymentTokenPayload {
  invoiceId: string;
  orgId: string;
  issuedAt: number;
}

const TOKEN_VALIDITY_DAYS = 30;

/**
 * Create a signed payment token encoding the invoice reference.
 */
export function createPaymentToken(invoiceId: string, orgId: string, secret: string): string {
  const payload: PaymentTokenPayload = {
    invoiceId,
    orgId,
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a payment token. Returns null if invalid or expired.
 */
export function verifyPaymentToken(token: string, secret: string): PaymentTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expected = createHmac('sha256', secret).update(encoded!).digest('base64url');
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded!, 'base64url').toString()) as PaymentTokenPayload;
    const ageMs = Date.now() - payload.issuedAt;
    const maxAgeMs = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}
