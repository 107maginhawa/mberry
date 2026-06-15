/**
 * Cross-org identity matching utilities.
 *
 * Strategy: email (primary) + PRC license number (secondary).
 * - Email: lowercase, trimmed — unique per person
 * - PRC license: strip spaces/dashes/leading zeros — used for cross-org matching
 * - Ambiguous matches (email→PersonA, license→PersonB): flag for human resolution
 */

/**
 * Normalize an email address for matching.
 * Lowercase + trim whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize a PRC license number for matching.
 * Strip spaces, dashes, and leading zeros.
 */
export function normalizeLicenseNumber(license: string): string {
  return license
    .trim()
    .replace(/[\s-]/g, '')
    .replace(/^0+/, '') || '0';
}

export interface IdentityMatch {
  personId: string;
  matchedBy: 'email' | 'license' | 'both';
  confidence: 'exact' | 'ambiguous';
}

/**
 * Find matching persons by email and/or license number.
 * Returns ambiguous if email and license point to different persons.
 *
 * @param db - Database instance
 * @param email - Email to match (will be normalized)
 * @param licenseNumber - PRC license number to match (will be normalized)
 * @returns Array of matches with confidence level
 */
export async function findIdentityMatches(
  _db: unknown,
  _email?: string,
  _licenseNumber?: string
): Promise<IdentityMatch[]> {
  // NOT IMPLEMENTED — deferred to identity-matching v1.2.0 (pending person-schema
  // license fields). This previously returned [] unconditionally, which is a
  // silent landmine: in a cross-org dedup context an empty result reads as
  // "no existing person -> safe to create a new one", so a future caller wired
  // to this stub would silently create duplicate persons. Fail loud instead so
  // the missing implementation is impossible to miss.
  //
  // Implementation sketch:
  //   if (email) -> normalizeEmail + query persons by email (JSON contactInfo)
  //   if (licenseNumber) -> normalizeLicenseNumber + query persons.licenseNumber
  //   merge -> matchedBy 'both'; >1 distinct person -> confidence 'ambiguous'
  throw new Error(
    'findIdentityMatches is not implemented (deferred to identity-matching v1.2.0). ' +
    'Do not wire callers to this until person license-field queries exist.',
  );
}
