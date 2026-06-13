import { describe, test, expect } from 'bun:test'
import { resolveVerifyKind, verifyStalenessNote } from './verify-dispatch'

// FIX-002 (G2): one /verify/$id route must dispatch by id shape so cert numbers,
// credential numbers, and signed credential tokens each reach the correct
// verifier — instead of three sibling dynamic routes shadowing each other.
describe('resolveVerifyKind — anti-shadow dispatch', () => {
  test('a signed credential token (base64url.base64url) routes to the token verifier', () => {
    // shape produced by createCredentialToken: `${base64url}.${base64url}`
    expect(resolveVerifyKind('eyJjcmVkIjoiMSJ9.c2lnbmF0dXJl')).toBe('token')
  })

  test('a certificate number (ORG-YYYY-NNNN) routes to the certificate verifier', () => {
    expect(resolveVerifyKind('PDA-2026-0001')).toBe('certificate')
    expect(resolveVerifyKind('PDADC-2025-0042')).toBe('certificate')
  })

  test('an arbitrary credential number routes to the credential-number lookup', () => {
    expect(resolveVerifyKind('CRED-ABC-123')).toBe('credentialNumber')
    expect(resolveVerifyKind('membership-card-7f3a')).toBe('credentialNumber')
  })

  test('a bare UUID (legacy id-card QR value) is NOT treated as a certificate', () => {
    // legacy /verify/<memberId> URLs must not silently resolve to a wrong verifier
    expect(resolveVerifyKind('550e8400-e29b-41d4-a716-446655440000')).toBe('credentialNumber')
  })
})

// FIX-014 (G14 / PRD 11.5): verifiers must be able to judge currency, not just
// authenticity — a 30-day staleness hint on the verify result.
describe('verifyStalenessNote — 30-day window', () => {
  const now = Date.parse('2026-06-12T00:00:00.000Z')

  test('returns null for a freshly-issued credential (within 30 days)', () => {
    expect(verifyStalenessNote('2026-06-01T00:00:00.000Z', now)).toBeNull()
  })

  test('returns null exactly at the 30-day boundary', () => {
    expect(verifyStalenessNote('2026-05-13T00:00:00.000Z', now)).toBeNull()
  })

  test('returns a note when issued more than 30 days ago', () => {
    const note = verifyStalenessNote('2026-01-01T00:00:00.000Z', now)
    expect(note).not.toBeNull()
    expect(note).toMatch(/30 days/i)
  })

  test('returns null for an unparseable / missing issued date (no false alarm)', () => {
    expect(verifyStalenessNote('', now)).toBeNull()
    expect(verifyStalenessNote('not-a-date', now)).toBeNull()
  })
})
