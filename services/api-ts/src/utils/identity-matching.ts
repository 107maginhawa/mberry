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
  email?: string,
  licenseNumber?: string
): Promise<IdentityMatch[]> {
  // Deferred: DB queries pending person schema license fields — identity matching v1.2.0
  // Placeholder structure:
  //
  // const matches: IdentityMatch[] = [];
  // if (email) {
  //   const normalized = normalizeEmail(email);
  //   const emailMatch = await db.query.persons.findFirst({
  //     where: eq(persons.contactInfo, ...) // JSON query for email
  //   });
  //   if (emailMatch) matches.push({ personId: emailMatch.id, matchedBy: 'email', confidence: 'exact' });
  // }
  // if (licenseNumber) {
  //   const normalized = normalizeLicenseNumber(licenseNumber);
  //   const licenseMatch = await db.query.persons.findFirst({
  //     where: eq(persons.licenseNumber, normalized)
  //   });
  //   if (licenseMatch) {
  //     const existing = matches.find(m => m.personId === licenseMatch.id);
  //     if (existing) existing.matchedBy = 'both';
  //     else matches.push({ personId: licenseMatch.id, matchedBy: 'license', confidence: 'exact' });
  //   }
  // }
  // // If email and license point to different persons, mark ambiguous
  // if (matches.length > 1) {
  //   matches.forEach(m => m.confidence = 'ambiguous');
  // }
  // return matches;

  return []; // Placeholder until person queries are built
}
