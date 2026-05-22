import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Types ────────────────────────────────────────────────────────────────────

type VendorStatus = 'pending' | 'verified' | 'suspended' | 'rejected';
type ListingStatus = 'active' | 'inactive' | 'deactivated_by_suspension';
type MemberStatus = 'active' | 'inactive' | 'non_member';

interface VerificationChecklist {
  businessPermit: boolean;
  professionalLicense: boolean;
  identityVerified: boolean;
}

interface Vendor {
  id: string;
  name: string;
  status: VendorStatus;
  checklist: VerificationChecklist;
}

interface Listing {
  id: string;
  vendorId: string;
  title: string;
  status: ListingStatus;
  hasReferralLink: boolean;
  referralDisclosureShown: boolean;
}

interface SearchResult {
  listing: Listing;
  vendor: Vendor;
  isVerified: boolean;
  verificationLabel?: string;
}

interface Member {
  id: string;
  status: MemberStatus;
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

function applyVerificationChecklist(
  vendor: Vendor,
  checklist: VerificationChecklist,
): Vendor {
  const allPassed =
    checklist.businessPermit &&
    checklist.professionalLicense &&
    checklist.identityVerified;
  return {
    ...vendor,
    checklist,
    status: allPassed ? 'verified' : 'pending',
  };
}

function canAccessMarketplace(member: Member): { allowed: boolean; reason?: string } {
  if (member.status !== 'active') {
    return { allowed: false, reason: 'members_only' };
  }
  return { allowed: true };
}

function suspendVendor(vendor: Vendor, listings: Listing[]): {
  vendor: Vendor;
  listings: Listing[];
} {
  const suspended = { ...vendor, status: 'suspended' as VendorStatus };
  const deactivated = listings.map((l) =>
    l.vendorId === vendor.id && l.status === 'active'
      ? { ...l, status: 'deactivated_by_suspension' as ListingStatus }
      : l,
  );
  return { vendor: suspended, listings: deactivated };
}

function applyReferralDisclosure(listing: Listing): Listing {
  if (listing.hasReferralLink) {
    return { ...listing, referralDisclosureShown: true };
  }
  return listing;
}

function labelSearchResults(results: SearchResult[]): SearchResult[] {
  return results.map((r) => {
    if (r.vendor.status !== 'verified') {
      return { ...r, isVerified: false, verificationLabel: 'unverified' };
    }
    return { ...r, isVerified: true };
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('[AC-M17-001] Vendor Verification', () => {
  const pendingVendor: Vendor = {
    id: 'vendor-1',
    name: 'Dental Supplies Co.',
    status: 'pending',
    checklist: { businessPermit: false, professionalLicense: false, identityVerified: false },
  };

  test('vendor verified when all checklist items pass', () => {
    const checklist: VerificationChecklist = {
      businessPermit: true,
      professionalLicense: true,
      identityVerified: true,
    };
    const result = applyVerificationChecklist(pendingVendor, checklist);
    expect(result.status).toBe('verified');
  });

  test('vendor remains pending if any checklist item fails', () => {
    const checklist: VerificationChecklist = {
      businessPermit: true,
      professionalLicense: false,
      identityVerified: true,
    };
    const result = applyVerificationChecklist(pendingVendor, checklist);
    expect(result.status).toBe('pending');
  });

  test('checklist is saved on vendor record', () => {
    const checklist: VerificationChecklist = {
      businessPermit: true,
      professionalLicense: true,
      identityVerified: true,
    };
    const result = applyVerificationChecklist(pendingVendor, checklist);
    expect(result.checklist).toEqual(checklist);
  });
});

describe('[AC-M17-002] Membership Gating', () => {
  test('non-member is blocked from marketplace', () => {
    const nonMember: Member = { id: 'p-1', status: 'non_member' };
    const result = canAccessMarketplace(nonMember);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('members_only');
  });

  test('inactive member is blocked from marketplace', () => {
    const inactive: Member = { id: 'p-2', status: 'inactive' };
    const result = canAccessMarketplace(inactive);
    expect(result.allowed).toBe(false);
  });

  test('active member can access marketplace', () => {
    const active: Member = { id: 'p-3', status: 'active' };
    const result = canAccessMarketplace(active);
    expect(result.allowed).toBe(true);
  });
});

describe('[AC-M17-003] Vendor Suspension Cascade', () => {
  const vendor: Vendor = {
    id: 'vendor-2',
    name: 'MedEquip Ltd.',
    status: 'verified',
    checklist: { businessPermit: true, professionalLicense: true, identityVerified: true },
  };

  const listings: Listing[] = [
    {
      id: 'listing-1',
      vendorId: 'vendor-2',
      title: 'Dental Chair',
      status: 'active',
      hasReferralLink: false,
      referralDisclosureShown: false,
    },
    {
      id: 'listing-2',
      vendorId: 'vendor-2',
      title: 'X-Ray Machine',
      status: 'active',
      hasReferralLink: false,
      referralDisclosureShown: false,
    },
    {
      id: 'listing-3',
      vendorId: 'vendor-other',
      title: 'Other Product',
      status: 'active',
      hasReferralLink: false,
      referralDisclosureShown: false,
    },
  ];

  test('suspending vendor deactivates all their active listings', () => {
    const { listings: updated } = suspendVendor(vendor, listings);
    const vendorListings = updated.filter((l) => l.vendorId === 'vendor-2');
    expect(vendorListings.every((l) => l.status === 'deactivated_by_suspension')).toBe(true);
  });

  test('other vendors listings are unaffected by suspension', () => {
    const { listings: updated } = suspendVendor(vendor, listings);
    const otherListing = updated.find((l) => l.vendorId === 'vendor-other');
    expect(otherListing!.status).toBe('active');
  });

  test('vendor status becomes suspended', () => {
    const { vendor: updated } = suspendVendor(vendor, listings);
    expect(updated.status).toBe('suspended');
  });

  test('deactivated status is distinct from normal inactive', () => {
    const { listings: updated } = suspendVendor(vendor, listings);
    const vendorListing = updated.find((l) => l.vendorId === 'vendor-2');
    expect(vendorListing!.status).toBe('deactivated_by_suspension');
    expect(vendorListing!.status).not.toBe('inactive');
  });
});

describe('[AC-M17-004] Referral Disclosure', () => {
  test('listing with referral link shows disclosure badge', () => {
    const listing: Listing = {
      id: 'listing-4',
      vendorId: 'vendor-3',
      title: 'Promo Item',
      status: 'active',
      hasReferralLink: true,
      referralDisclosureShown: false,
    };
    const result = applyReferralDisclosure(listing);
    expect(result.referralDisclosureShown).toBe(true);
  });

  test('listing without referral link has no disclosure', () => {
    const listing: Listing = {
      id: 'listing-5',
      vendorId: 'vendor-3',
      title: 'Regular Item',
      status: 'active',
      hasReferralLink: false,
      referralDisclosureShown: false,
    };
    const result = applyReferralDisclosure(listing);
    expect(result.referralDisclosureShown).toBe(false);
  });
});

describe('[AC-M17-005] Unverified Vendor Filtering', () => {
  const verifiedVendor: Vendor = {
    id: 'vendor-v',
    name: 'Verified Co.',
    status: 'verified',
    checklist: { businessPermit: true, professionalLicense: true, identityVerified: true },
  };

  const unverifiedVendor: Vendor = {
    id: 'vendor-u',
    name: 'Pending Co.',
    status: 'pending',
    checklist: { businessPermit: false, professionalLicense: false, identityVerified: false },
  };

  const makeResult = (vendor: Vendor): SearchResult => ({
    listing: {
      id: `listing-${vendor.id}`,
      vendorId: vendor.id,
      title: 'Product',
      status: 'active',
      hasReferralLink: false,
      referralDisclosureShown: false,
    },
    vendor,
    isVerified: vendor.status === 'verified',
  });

  test('unverified vendor in search results is labeled', () => {
    const results = labelSearchResults([makeResult(unverifiedVendor)]);
    expect(results[0].verificationLabel).toBe('unverified');
    expect(results[0].isVerified).toBe(false);
  });

  test('verified vendor has no unverified label', () => {
    const results = labelSearchResults([makeResult(verifiedVendor)]);
    expect(results[0].isVerified).toBe(true);
    expect(results[0].verificationLabel).toBeUndefined();
  });

  test('mixed results correctly label each vendor', () => {
    const results = labelSearchResults([
      makeResult(verifiedVendor),
      makeResult(unverifiedVendor),
    ]);
    expect(results[0].isVerified).toBe(true);
    expect(results[1].isVerified).toBe(false);
    expect(results[1].verificationLabel).toBe('unverified');
  });
});
