/**
 * Anti-shadow verify dispatch (FIX-002 / G2).
 *
 * The three public verification surfaces — signed credential tokens, certificate
 * numbers, and credential numbers — previously lived in three sibling dynamic
 * routes (`/verify/$token`, `/verify/$certificateNumber`, `/verify/$credentialNumber`)
 * that all match `/verify/:anything`, so at most one was ever reachable. A single
 * `/verify/$id` route now dispatches by the shape of the id, preserving every
 * already-distributed `/verify/<...>` URL.
 */
export type VerifyKind = 'token' | 'certificate' | 'credentialNumber'

// createCredentialToken emits `${base64url}.${base64url}` — a single dot with
// base64url halves on each side. Nothing else in the verify space contains a dot.
const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
// Certificate numbers are `${orgCode}-${YYYY}-${NNNN}` (see bulkIssueCertificates).
const CERTIFICATE_RE = /^[A-Za-z0-9]+-\d{4}-\d{4}$/

export function resolveVerifyKind(id: string): VerifyKind {
  if (TOKEN_RE.test(id)) return 'token'
  if (CERTIFICATE_RE.test(id)) return 'certificate'
  return 'credentialNumber'
}

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Staleness hint for a verify result (FIX-014 / PRD 11.5, 30-day rule).
 *
 * A verifier scanning an old QR can confirm the credential is *authentic* but not
 * whether it is *current*. When the issue date is more than 30 days old we surface
 * a note prompting them to confirm current standing. Returns null for fresh,
 * boundary (exactly 30 days), or unparseable dates so we never raise a false alarm.
 */
export function verifyStalenessNote(issuedAt: string, now: number): string | null {
  const issued = Date.parse(issuedAt)
  if (Number.isNaN(issued)) return null
  if (now - issued <= STALE_AFTER_MS) return null
  return 'Issued more than 30 days ago — confirm current standing with the issuing organization.'
}
