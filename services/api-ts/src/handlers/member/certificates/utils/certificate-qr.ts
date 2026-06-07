/**
 * HMAC-based QR code signing for certificate verification.
 *
 * EF-M11-002: Prevents certificate forgery by signing certificate numbers
 * with an HMAC. QR codes on printed certificates include the signature,
 * which the public verification endpoint validates.
 *
 * Follows the same pattern as dues/utils/payment-token.ts.
 */

import { createHmac } from 'crypto';

/**
 * Generate a truncated HMAC-SHA256 signature for a certificate number.
 * Returns a 16-character hex string suitable for QR codes.
 */
export function signCertificateQR(certificateNumber: string, secret: string): string {
  return createHmac('sha256', secret).update(certificateNumber).digest('hex').slice(0, 16);
}

/**
 * Verify a certificate QR signature against the expected HMAC.
 */
export function verifyCertificateQR(
  certificateNumber: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signCertificateQR(certificateNumber, secret);
  return signature === expected;
}
