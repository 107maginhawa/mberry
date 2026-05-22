# Module 17: Marketplace

- **Phase:** 3
- **Monetization:** Add-on (revenue-share)
- **Dependencies:** M05 (Membership)

---

## Overview

The Marketplace connects association members with verified vendors offering professional products and services. Revenue is generated through referral fees and revenue-share agreements with listed vendors. All referral fees are disclosed to associations per BR-38.

---

## Categories

| Category | Description |
|----------|-------------|
| EMR / Clinic Software | Electronic medical records and clinic management systems |
| Dental & Medical Supplies | Consumables, instruments, equipment |
| Insurance Products | Group health insurance, professional liability insurance |
| Telehealth Services | Licensed provider directory for specialist referrals |

---

## Key Specifications

### Discovery

- Members browse listings by category, specialty, and rating.
- Search with keyword, category filter, specialty filter, and sort by rating or relevance.
- Each listing shows: vendor name, product/service title, description, rating, number of reviews, pricing model, and verified badge.

### EMR Referrals

- Clinic associations (`org_type = clinic`) can adopt an EMR product listed on the marketplace.
- When a clinic adopts an EMR through the platform, the platform earns a referral fee from the EMR vendor.
- **BR-38:** The referral fee arrangement must be disclosed to the association. The disclosure appears on the product detail page and in the adoption confirmation flow.

### Supply Procurement (Group Purchasing)

- Associations can access group purchasing for dental and medical supplies.
- Negotiated rates are available based on aggregate association membership volume.
- Orders are placed per association; the platform facilitates but does not warehouse inventory.
- Pricing tiers are visible to association officers before committing.

### Insurance Products

- Group health insurance products for association members.
- Professional liability insurance products tailored by specialty.
- Members apply through the marketplace; applications are forwarded to the insurance provider.
- Platform earns a referral or commission fee (disclosed per BR-38).

### Telehealth Services

- Directory of licensed telehealth providers available for specialist referrals.
- Providers are listed with specialty, availability, consultation fee, and license verification status.
- Members can request a referral or book directly depending on the vendor's integration.

### Vendor Verification

- Vendors must submit a verification application before their listings become visible.
- Required information: business registration, relevant licenses, product/service documentation.
- Platform admin reviews and approves or rejects vendor applications.
- Verified vendors display a verified badge on all their listings.
- Vendors can be suspended or revoked by platform admin if they violate marketplace policies.

---

## Business Rules

| Rule | Description |
|------|-------------|
| BR-38 | Referral fee disclosure. Any referral fee or revenue-share arrangement between the platform and a vendor must be disclosed to the association. Disclosure appears on the product detail page and in the adoption/application confirmation flow. |

---

## Screens

> **Phase 3 scope note:** Member-facing marketplace browsing (`/marketplace/...`) is Phase 3 frontend scope — screen specs deferred to Phase 3 sprint planning. Admin vendor management screens are in scope for PRD v3.

| Route | Description |
|-------|-------------|
| `/marketplace` | Marketplace home (Phase 3). Category grid, featured listings, search bar. |
| `/marketplace/[category]` | Category listing page (Phase 3). Filtered results with sort and filter controls. |
| `/marketplace/[product-id]` | Product/service detail page (Phase 3). Vendor info, description, pricing, reviews, referral fee disclosure (if applicable). |
| `/marketplace/[product-id]/apply` | Application or adoption flow (Phase 3). Member or association officer submits interest or starts onboarding for the product/service. |
| `/admin/marketplace/vendors` | Platform admin vendor management. List of all vendors with status (pending, verified, suspended). Filter and search. |
| `/admin/marketplace/vendors/[id]` | Vendor detail and verification review. View submitted documents, approve/reject/suspend vendor. |
