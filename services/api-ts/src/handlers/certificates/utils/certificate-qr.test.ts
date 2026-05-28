/**
 * EF-M11-002: HMAC QR signing for certificate verification
 *
 * Verifies the signCertificateQR / verifyCertificateQR utilities
 * produce deterministic, tamper-resistant signatures.
 */

import { describe, test, expect } from 'bun:test';
import { signCertificateQR, verifyCertificateQR } from './certificate-qr';

const SECRET = 'test-cert-secret-key';

describe('EF-M11-002: certificate QR signing', () => {
  test('signCertificateQR returns a 16-char hex string', () => {
    const sig = signCertificateQR('PDA-2025-0001', SECRET);
    expect(sig).toMatch(/^[0-9a-f]{16}$/);
  });

  test('signature is deterministic for same input', () => {
    const sig1 = signCertificateQR('PDA-2025-0001', SECRET);
    const sig2 = signCertificateQR('PDA-2025-0001', SECRET);
    expect(sig1).toBe(sig2);
  });

  test('different certificate numbers produce different signatures', () => {
    const sig1 = signCertificateQR('PDA-2025-0001', SECRET);
    const sig2 = signCertificateQR('PDA-2025-0002', SECRET);
    expect(sig1).not.toBe(sig2);
  });

  test('different secrets produce different signatures', () => {
    const sig1 = signCertificateQR('PDA-2025-0001', SECRET);
    const sig2 = signCertificateQR('PDA-2025-0001', 'other-secret');
    expect(sig1).not.toBe(sig2);
  });

  test('verifyCertificateQR returns true for valid signature', () => {
    const sig = signCertificateQR('PDA-2025-0001', SECRET);
    expect(verifyCertificateQR('PDA-2025-0001', sig, SECRET)).toBe(true);
  });

  test('verifyCertificateQR returns false for tampered signature', () => {
    expect(verifyCertificateQR('PDA-2025-0001', 'deadbeefdeadbeef', SECRET)).toBe(false);
  });

  test('verifyCertificateQR returns false for wrong certificate number', () => {
    const sig = signCertificateQR('PDA-2025-0001', SECRET);
    expect(verifyCertificateQR('PDA-2025-9999', sig, SECRET)).toBe(false);
  });
});
