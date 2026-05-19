# Module Specification: Marketplace (M17)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Health services marketplace connecting verified healthcare professionals with products and services — EMR referrals, supply procurement (group purchasing), insurance products, telehealth services, and vendor verification.

### Users
- Member, Platform Admin, Vendor

### Related Modules
- M01 (Auth), M02 (Member Profile), M05 (Membership — access gating)
- M16 (Advertising — directory highlight ads)

### In Scope
- Marketplace discovery (search, categories), EMR referrals
- Supply procurement / group purchasing, insurance products, telehealth services
- Vendor verification, vendor listing management
- Category management (platform admin)

### Out of Scope
- Payment processing for marketplace transactions (external), full e-commerce

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Vendor | External entity offering products/services through the marketplace. |
| Group Purchasing | Collective buying by association members for volume discounts. |
| EMR Referral | Integration link to electronic medical record systems. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Browse Marketplace | Member | Search and discover vendors/services | P0 |
| Vendor Registration | Vendor | Apply to list on marketplace | P1 |
| Vendor Verification | Platform Admin | Review and approve vendors | P1 |
| Category Management | Platform Admin | Configure marketplace categories | P1 |

## 4. Workflow Details

### Workflow: Browse Marketplace

Actor: Active member
Steps:
1. Opens /org/[id]/marketplace.
2. Browses by category (EMR, supplies, insurance, telehealth).
3. Searches by keyword or filters.
4. Views vendor detail: name, description, products, verification badge.
5. Clicks through to vendor's external site or inquiry form.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-38 | IF vendor listed THEN must be verified by platform admin | Vendor verification | No unverified listings |
| M17-R1 | IF marketplace access THEN active membership required | Access | Grace/Lapsed blocked |
| M17-R2 | IF group purchasing THEN minimum participant threshold | Group buying | Configurable per offer |
| M17-R3 | IF vendor suspended THEN hide listings, preserve data | Vendor management | Reversible |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Browse marketplace | Active members | Grace, Lapsed, non-members | GA |
| Manage vendors | super, admin | All others | PA |
| Register as vendor | Public (vendor) | — | Public form |

## 7. Data Requirements

### Entity: Vendor

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| companyName | Yes | Vendor name | — |
| category | Yes | EMR/supplies/insurance/telehealth | Enum |
| description | Yes | Vendor description | — |
| verificationStatus | Yes | pending/verified/suspended | Enum |
| websiteUrl | No | External site | URL |
| contactEmail | Yes | Primary contact | — |

### Entity: MarketplaceListing

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| vendorId | Yes | Vendor FK | — |
| title | Yes | Listing title | — |
| description | Yes | Product/service description | — |
| category | Yes | Category | — |
| status | Yes | active/inactive | Enum |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Vendor | MarketplaceListing | — | Must be verified before listings visible. |

## 8. State Transitions

### Vendor Verification
```txt
Pending → Verified → Suspended
Pending → Rejected
Suspended → Verified (reinstated)
```

## 9. UI / UX Requirements

### Screen: Marketplace (/org/[id]/marketplace)
Purpose: Browse vendors and services
Components: Category tabs, search bar, vendor cards with verification badge, filters

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id/marketplace | Browse listings | category, search | Listing list | 403 |
| POST /admin/vendors | Register vendor | Vendor data | vendorId | 409 |
| PUT /admin/vendors/:id/verify | Verify vendor | — | Updated vendor | 403 |
| GET /marketplace/vendors/:id | Vendor detail | — | Vendor data | 404 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| VendorVerified | Admin approves vendor | vendorId | — |
| ListingPublished | Vendor listing goes live | listingId, vendorId | M16 (ad opportunities) |

### Consumed Events

None.

## 11. Acceptance Criteria

### AC-M17-001: Vendor Verification
No vendor listings visible until platform admin verifies the vendor.

### AC-M17-002: Access Gating
Only active members can access marketplace. Grace/Lapsed see gating message.

## 12. Test Expectations

Required tests:
- Vendor: registration, verification, suspension
- Search: keyword, category filtering
- Access: active member only, non-active blocked
- Listing visibility: only from verified vendors

## 13. Edge Cases

- All vendors suspended: empty marketplace with message.
- Vendor verification revoked: listings hidden immediately.
- Group purchasing offer with 0 participants at deadline: offer cancelled. [INFERRED]

## 14. Dependencies

### Internal Dependencies
- M01 (Auth), M02 (Profile), M05 (Membership)

### External Dependencies
- External vendor websites (link-out model)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Non-active access | 403 | "Active membership required." |
| Vendor not found | 404 | "Vendor not found." |

## 16. Performance Expectations

- Expected data volume: 50+ vendors, 200+ listings
- Acceptable response times: Search < 500ms

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| marketplace.search | INFO | Search executed | query, category | No |
| marketplace.vendor.verified | INFO | Vendor approved | vendorId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| marketplace_searches_total | counter | category | Search count |
| marketplace_vendors_total | gauge | status | Vendor count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| marketplace_enabled | release | false | Gates marketplace module | — |
| marketplace_group_purchasing | release | false | Group buying feature | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M17-S1 | Vendor Management | Registration, verification | M03 | P0 |
| M17-S2 | Marketplace Browse | Search, filter, view listings | M17-S1, M05 | P0 |
| M17-S3 | Category Management | Admin configures categories | M17-S1 | P1 |
| M17-S4 | Group Purchasing | Collective buying offers | M17-S2 | P2 |
| M17-S5 | EMR Referrals | Integration links | M17-S2 | P2 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
