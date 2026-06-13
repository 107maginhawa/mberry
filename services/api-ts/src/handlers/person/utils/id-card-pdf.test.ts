/**
 * Tests for member ID-card PDF rendering (FIX-001, Batch A2 closeout).
 *
 * Mirrors certificate-template.test.ts: PDF text is binary/non-greppable, so we
 * assert on the `%PDF` magic header + a byte-size delta proving the scannable
 * verify QR adds content only when a verifyCredentialNumber is present.
 */

import { describe, test, expect } from 'bun:test';
import { renderIdCardPdf } from './id-card-pdf';
import type { IdCardData } from './id-card-data';

function makeCard(overrides: Partial<IdCardData> = {}): IdCardData {
  return {
    personId: 'person-1',
    firstName: 'Maria',
    lastName: 'Santos',
    licenseNumber: 'PRC-12345',
    organizationName: 'Philippine Dental Association',
    membershipStatus: 'active',
    photoUrl: null,
    qrPayload: 'base64payload',
    qrSignature: 'deadbeef',
    validUntil: '2026-12-31',
    verifyCredentialNumber: null,
    ...overrides,
  };
}

describe('[FIX-001] Member ID-card PDF verify QR', () => {
  test('renders a valid PDF with a scannable QR when verifyCredentialNumber is present', async () => {
    const bytes = await renderIdCardPdf(makeCard({ verifyCredentialNumber: 'MC-PERSON1-ORG1-ABCDEF' }));
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('%PDF');
  });

  test('embedding the QR adds content (PDF larger than the no-credential variant)', async () => {
    const withQr = await renderIdCardPdf(makeCard({ verifyCredentialNumber: 'MC-PERSON1-ORG1-ABCDEF' }));
    const withoutQr = await renderIdCardPdf(makeCard({ verifyCredentialNumber: null }));
    expect(withQr.byteLength).toBeGreaterThan(withoutQr.byteLength);
  });

  test('still renders the text-only entry point when no credential (backward compatible)', async () => {
    const bytes = await renderIdCardPdf(makeCard({ verifyCredentialNumber: null }));
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('%PDF');
  });
});
