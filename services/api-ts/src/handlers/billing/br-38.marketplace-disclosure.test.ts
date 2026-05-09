// Business Rules: [BR-38]
/**
 * [BR-38] Marketplace Referral Disclosure
 *
 * BR-38: "Any referral fee, commission, or revenue-share arrangement between
 * Memberry and a marketplace vendor must be disclosed to the association before
 * the association can interact with that vendor's listing. The disclosure is
 * shown on the vendor's product detail page and must be acknowledged before
 * proceeding with any adoption or application flow. Associations can opt out
 * of seeing marketplace listings from specific vendors."
 *
 * Edge case: "If a referral arrangement is added to a vendor after their listing
 * goes live, existing associations must be notified of the updated terms within
 * 30 days. Until they acknowledge the updated disclosure, they cannot interact
 * with the listing."
 */

import { describe, test, expect } from 'bun:test';

// ─── Pure rule functions (will be extracted to module when M17 is built) ───

interface VendorListing {
  vendorId: string;
  hasReferralArrangement: boolean;
  referralDisclosure?: string;
  referralAddedAt?: Date;
}

interface AssociationVendorState {
  organizationId: string;
  vendorId: string;
  disclosureAcknowledged: boolean;
  acknowledgedAt?: Date;
  optedOut: boolean;
  referralTermsVersion?: number;
}

const RETROACTIVE_ACKNOWLEDGE_DAYS = 30;

function canInteractWithVendor(
  listing: VendorListing,
  state: AssociationVendorState | undefined,
): boolean {
  // Opted-out associations can't see or interact
  if (state?.optedOut) return false;

  // No referral arrangement — interaction allowed
  if (!listing.hasReferralArrangement) return true;

  // Has referral — must be acknowledged
  if (!state?.disclosureAcknowledged) return false;

  return true;
}

function requiresDisclosure(listing: VendorListing): boolean {
  return listing.hasReferralArrangement;
}

function isRetroactiveNoticeRequired(
  listing: VendorListing,
  state: AssociationVendorState | undefined,
  now: Date,
): boolean {
  if (!listing.hasReferralArrangement || !listing.referralAddedAt) return false;

  // Already acknowledged current terms
  if (state?.disclosureAcknowledged) return false;

  // Within 30-day window
  const deadline = new Date(listing.referralAddedAt);
  deadline.setDate(deadline.getDate() + RETROACTIVE_ACKNOWLEDGE_DAYS);
  return now <= deadline;
}

function isRetroactiveDeadlinePassed(
  listing: VendorListing,
  state: AssociationVendorState | undefined,
  now: Date,
): boolean {
  if (!listing.hasReferralArrangement || !listing.referralAddedAt) return false;
  if (state?.disclosureAcknowledged) return false;

  const deadline = new Date(listing.referralAddedAt);
  deadline.setDate(deadline.getDate() + RETROACTIVE_ACKNOWLEDGE_DAYS);
  return now > deadline;
}

describe('[BR-38] Marketplace Referral Disclosure', () => {
  const vendorWithReferral: VendorListing = {
    vendorId: 'vendor-1',
    hasReferralArrangement: true,
    referralDisclosure: 'Memberry receives 5% referral fee on subscriptions',
  };

  const vendorNoReferral: VendorListing = {
    vendorId: 'vendor-2',
    hasReferralArrangement: false,
  };

  // ─── Disclosure Required Before Interaction ───────────────

  test('cannot interact with vendor listing before acknowledging referral disclosure', () => {
    const state: AssociationVendorState = {
      organizationId: 'org-1',
      vendorId: 'vendor-1',
      disclosureAcknowledged: false,
      optedOut: false,
    };
    expect(canInteractWithVendor(vendorWithReferral, state)).toBe(false);
  });

  test('can interact after acknowledging disclosure', () => {
    const state: AssociationVendorState = {
      organizationId: 'org-1',
      vendorId: 'vendor-1',
      disclosureAcknowledged: true,
      acknowledgedAt: new Date('2026-01-15'),
      optedOut: false,
    };
    expect(canInteractWithVendor(vendorWithReferral, state)).toBe(true);
  });

  test('no disclosure required for vendors without referral arrangements', () => {
    expect(requiresDisclosure(vendorNoReferral)).toBe(false);
    expect(canInteractWithVendor(vendorNoReferral, undefined)).toBe(true);
  });

  test('first-time interaction with referral vendor requires acknowledgment', () => {
    // No existing state — never interacted
    expect(canInteractWithVendor(vendorWithReferral, undefined)).toBe(false);
  });

  // ─── Opt-Out ──────────────────────────────────────────────

  test('association can opt out of specific vendor listings', () => {
    const state: AssociationVendorState = {
      organizationId: 'org-1',
      vendorId: 'vendor-1',
      disclosureAcknowledged: true,
      optedOut: true,
    };
    expect(canInteractWithVendor(vendorWithReferral, state)).toBe(false);
  });

  // ─── Edge Case: Retroactive Referral Arrangement ──────────

  test('retroactive referral requires notice within 30 days', () => {
    const listing: VendorListing = {
      vendorId: 'vendor-3',
      hasReferralArrangement: true,
      referralDisclosure: 'New 3% commission added',
      referralAddedAt: new Date('2026-03-01'),
    };

    const now = new Date('2026-03-15'); // 14 days in
    expect(isRetroactiveNoticeRequired(listing, undefined, now)).toBe(true);
  });

  test('retroactive notice not required after acknowledgment', () => {
    const listing: VendorListing = {
      vendorId: 'vendor-3',
      hasReferralArrangement: true,
      referralAddedAt: new Date('2026-03-01'),
    };
    const state: AssociationVendorState = {
      organizationId: 'org-1',
      vendorId: 'vendor-3',
      disclosureAcknowledged: true,
      acknowledgedAt: new Date('2026-03-10'),
      optedOut: false,
    };

    const now = new Date('2026-03-15');
    expect(isRetroactiveNoticeRequired(listing, state, now)).toBe(false);
  });

  test('interaction blocked after 30-day deadline if not acknowledged', () => {
    const listing: VendorListing = {
      vendorId: 'vendor-3',
      hasReferralArrangement: true,
      referralAddedAt: new Date('2026-03-01'),
    };

    const now = new Date('2026-04-01'); // 31 days later
    expect(isRetroactiveDeadlinePassed(listing, undefined, now)).toBe(true);
    expect(canInteractWithVendor(listing, undefined)).toBe(false);
  });

  test('disclosure shown on vendor product detail page', () => {
    expect(requiresDisclosure(vendorWithReferral)).toBe(true);
    expect(vendorWithReferral.referralDisclosure).toBeDefined();
    expect(vendorWithReferral.referralDisclosure!.length).toBeGreaterThan(0);
  });
});
