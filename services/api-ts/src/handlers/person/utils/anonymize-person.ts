/**
 * Canonical PII anonymization field set for DPA 2012 right-to-erasure.
 *
 * FIX-002 / FIX-003 (G-03 / G-17): there used to be TWO hand-maintained scrub
 * lists — one in jobs/deletionProcessor.ts and one in the dead, unrouted
 * executeAccountDeletion.ts. They drifted, and BOTH silently omitted `bio`
 * (free-text PII that can hold a clinic address/phone). This is now the single
 * source of truth so the omission can never recur.
 *
 * Q-4 (Step 46, DECIDED — scrub): `gender` is a stored PII column. The
 * field-level erasure policy decision is to null it alongside `bio` for
 * right-to-erasure completeness, so it is now part of the canonical scrub set.
 */

/**
 * Build the `set(...)` payload that anonymizes a person row in place.
 *
 * The person row is kept (not deleted) so financial-record FKs (BR-32, 7-year
 * retention) still resolve.
 *
 * @param completedAt timestamp to stamp as deletionCompletedAt
 */
export function anonymizePersonFields(completedAt: Date): Record<string, unknown> {
  return {
    firstName: 'DELETED',
    lastName: 'DELETED',
    middleName: null,
    contactInfo: { email: 'deleted@deleted.invalid', phone: undefined },
    primaryAddress: null,
    avatar: null,
    licenseNumber: null,
    specialization: null,
    prcId: null,
    dateOfBirth: null,
    languagesSpoken: null,
    timezone: null,
    preferredLanguage: null,
    bio: null,
    gender: null,
    deletionCompletedAt: completedAt,
    updatedBy: 'system',
  };
}
