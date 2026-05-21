# Module Specification: Marketplace (M17)

---
oli_version: "Phase B -- Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Health services marketplace connecting verified healthcare professionals with products and services -- EMR referrals, supply procurement (group purchasing), insurance products, telehealth services, and vendor verification. Distribution channel for health-adjacent vendors to reach association members.

### Users
- Member (browse, purchase), Platform Admin (vendor verification, suspension), Vendor (registration, listing management), Officer (org-level marketplace settings)

### Related Modules
- M01 (Auth -- login required), M02 (Member Profile -- buyer identity), M05 (Membership -- active status gating)
- M16 (Advertising -- directory highlight ads for vendors)

### In Scope
- Vendor registration, verification, and suspension lifecycle
- Product/service listing CRUD (draft, publish, archive)
- Marketplace browse with search, category filtering, and vendor detail
- Order placement and fulfillment tracking
- Category management (platform admin)
- Referral disclosure (BR-38)
- Group purchasing / volume discount offers

### Out of Scope
- Payment processing (external -- vendors handle their own payment), full e-commerce cart/checkout, shipping/logistics

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant organization. Scoped by `association_id`. |
| **Organization** | Operational unit within an association. Scoped by `organization_id`. |
| **Member** | A healthcare professional using the platform. Can belong to multiple organizations. |
| **Platform Administrator** | Memberry employee managing the platform. Not affiliated with any association. |
| **Active** | Dues are current. Full access to org features. |
| **Vendor** | External entity offering products/services through the marketplace (see DOMAIN_GLOSSARY: Marketplace Terms). |
| **Group Purchasing** | Collective buying by association members for volume discounts (see DOMAIN_GLOSSARY: Marketplace Terms). |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-097: Vendor Registration & Verification | Vendor, Platform Admin | Apply, verify, list products | P0 |
| WF-098: Browse Marketplace | Member | Search, filter by category | P0 |
| WF-099: Vendor Suspension | Platform Admin | Suspend non-compliant vendor | P1 |

## 4. Workflow Details

### WF-097: Vendor Registration & Verification
**Actor:** Vendor (registration), Platform Admin (verification)
**Preconditions:** Vendor has a valid business entity
**Steps:**
1. Vendor submits registration form: company name, category, description, contact email, website URL.
2. System creates vendor record with `verificationStatus = pending`.
3. Platform Admin reviews vendor application.
4. Admin approves (status -> verified) or rejects (status -> rejected).
5. On approval: vendor can create listings.
**Alternate Flows:** Vendor resubmits after rejection with updated information.
**Exception Flows:** Incomplete submission returns validation errors.
**Postconditions:** Vendor record exists with final status. Domain event `VendorVerified` emitted on approval.

### WF-098: Browse Marketplace
**Actor:** Active member
**Preconditions:** Active membership status (BR: Grace/Lapsed blocked)
**Steps:**
1. Member opens `/org/[id]/marketplace`.
2. Browses by category (EMR, supplies, insurance, telehealth, other).
3. Searches by keyword or applies filters.
4. Views vendor detail: name, description, products, verification badge, referral disclosure (BR-38).
5. Clicks through to vendor external site or submits inquiry.
**Alternate Flows:** Empty results show "No listings found" with category suggestions.
**Postconditions:** Search event logged for analytics.

### WF-099: Vendor Suspension
**Actor:** Platform Admin
**Preconditions:** Vendor is verified
**Steps:**
1. Admin selects vendor from management dashboard.
2. Initiates suspension with reason.
3. System sets `verificationStatus = suspended`, hides all listings.
4. Domain event `vendor.suspended` emitted.
**Postconditions:** Vendor listings hidden. Data preserved for potential reinstatement.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-38 | IF vendor has referral/commission arrangement THEN disclosure shown on listing detail AND association must acknowledge before interacting | Referral disclosure | Disclosure on detail page; block interaction until acknowledged |
| M17-R1 | IF marketplace access THEN active membership required | Access gating | Grace/Lapsed see gating message |
| M17-R2 | IF group purchasing THEN minimum participant threshold must be met | Group buying | Configurable per offer |
| M17-R3 | IF vendor suspended THEN hide all listings, preserve data | Vendor management | Reversible via reinstatement |
| M17-R4 | IF vendor not verified THEN listings not visible to members | Vendor verification | Only verified vendors shown |
| M17-R5 | IF referral terms updated post-listing THEN existing associations notified within 30 days | BR-38 edge case | Block interaction until re-acknowledged |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Browse marketplace | Active members (all org roles) | Grace, Lapsed, non-members | GA |
| View vendor detail | Active members | Grace, Lapsed, non-members | GA |
| Place order | Active members | Grace, Lapsed, non-members | GA |
| Register as vendor | Public (vendor applicant) | -- | Public form |
| Manage vendor listings | Verified vendor (own listings) | -- | GA |
| Verify/reject vendor | super, admin | All others | PA |
| Suspend vendor | super, admin | All others | PA |
| Manage categories | super, admin | All others | PA |

## 7. Data Requirements

### Entity: Vendor

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| companyName | Yes | Vendor company name | text |
| category | Yes | Vendor category | Enum: `emr`, `supplies`, `insurance`, `telehealth`, `other` |
| description | Yes | Vendor description | text |
| verificationStatus | Yes | Current status | Enum: `pending`, `verified`, `suspended`, `rejected` (default: pending) |
| websiteUrl | No | External website | text, URL format |
| contactEmail | Yes | Primary contact email | text |
| contactPersonId | No | Optional link to person | uuid FK |
| verifiedAt | No | Verification timestamp | timestamp |
| verifiedBy | No | Admin who verified | uuid FK |

### Entity: MarketplaceListing

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| vendorId | Yes | Vendor FK | uuid, cascade delete |
| title | Yes | Listing title | text |
| description | Yes | Product/service description | text |
| price | No | Listed price | numeric(10,2) |
| currency | No | Price currency | text, default: USD |
| status | Yes | Listing status | Enum: `draft`, `active`, `archived` (default: draft) |
| categoryTags | No | Flexible categorization | JSONB string array |

### Entity: MarketplaceOrder

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| listingId | Yes | Listing FK | uuid |
| buyerPersonId | Yes | Buyer person FK | uuid |
| vendorId | Yes | Vendor FK | uuid |
| quantity | No | Order quantity | integer, default: 1 |
| totalPrice | Yes | Order total | numeric(10,2) |
| status | Yes | Order status | Enum: `pending`, `confirmed`, `fulfilled`, `cancelled`, `refunded` (default: pending) |
| notes | No | Order notes | text |
| fulfilledAt | No | Fulfillment timestamp | timestamp |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Vendor | MarketplaceListing | -- | Must be verified before listings visible to members. |
| MarketplaceOrder | -- | -- | Must reference active listing and verified vendor. Buyer must be active member. |

## 8. State Transitions

### Vendor Status
```txt
Pending --> Verified (admin approves)
Pending --> Rejected (admin rejects)
Verified --> Suspended (admin action)
Suspended --> Verified (admin reinstates)
```

### Listing Status
```txt
Draft --> Active (vendor publishes, vendor must be verified)
Active --> Archived (vendor or admin action)
Archived --> Active (vendor re-activates)
```

### Order Status
```txt
Pending --> Confirmed (vendor confirms)
Confirmed --> Fulfilled (vendor marks fulfilled)
Pending --> Cancelled (buyer or vendor cancels)
Confirmed --> Cancelled (buyer or vendor cancels)
Fulfilled --> Refunded (dispute resolution)
```

## 9. UI/UX Requirements

### Screen: Marketplace Browse (/org/[id]/marketplace)
**Purpose:** Browse vendors and services
**Users:** Active members
**Components:** Category tabs (EMR, supplies, insurance, telehealth, other), search bar, vendor cards with verification badge, price range filter, listing grid
**States:** Loading (skeleton cards), Empty ("No listings found. Try a different category."), Success (listing grid), PermissionError ("Active membership required to access marketplace."), UnexpectedError (generic retry)

### Screen: Vendor Detail (/org/[id]/marketplace/vendors/[id])
**Purpose:** View vendor info and listings
**Users:** Active members
**Components:** Vendor header (name, badge, category, description), referral disclosure banner (BR-38), listing cards, contact/inquiry form
**States:** Loading, Success, NotFound ("Vendor not found."), PermissionError

### Screen: Vendor Management (/admin/marketplace/vendors)
**Purpose:** Platform admin vendor management
**Users:** super, admin
**Components:** Vendor table (name, category, status, submitted date), approve/reject/suspend actions, filters by status
**States:** Loading, Empty, Success, UnexpectedError

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id/marketplace/listings | Browse listings | category?, search?, page | Paginated listing list | 403 (not active) |
| GET /org/:id/marketplace/vendors/:id | Vendor detail | -- | Vendor + listings | 404, 403 |
| POST /admin/marketplace/vendors | Register vendor | Vendor data | vendorId | 400, 409 |
| PUT /admin/marketplace/vendors/:id/verify | Verify vendor | -- | Updated vendor | 403, 404 |
| PUT /admin/marketplace/vendors/:id/suspend | Suspend vendor | reason | Updated vendor | 403, 404 |
| POST /org/:id/marketplace/orders | Place order | listingId, quantity, notes | orderId | 403, 400 |
| GET /org/:id/marketplace/orders | List own orders | status?, page | Paginated order list | 403 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| vendor.verified | Admin approves vendor | vendorId, orgId | -- |
| vendor.suspended | Admin suspends vendor | vendorId, reason | -- |
| listing.published | Listing goes active | listingId, vendorId, orgId | M16 (ad opportunities) |
| order.confirmed | Vendor confirms order | orderId, buyerPersonId | Notifications |
| order.fulfilled | Order fulfilled | orderId, vendorId | -- |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Check buyer eligibility | Block orders if no longer active |

## 11. Acceptance Criteria

**AC-M17-001:** Given a vendor with status `pending`, when platform admin approves, then vendor status becomes `verified` and `VendorVerified` event is emitted.

**AC-M17-002:** Given a non-active member, when they access `/org/[id]/marketplace`, then they see "Active membership required" and cannot browse.

**AC-M17-003:** Given a verified vendor with active listings, when admin suspends the vendor, then all listings are hidden from member browse results.

**AC-M17-004:** Given a vendor with a referral arrangement (BR-38), when a member views the listing detail, then the referral disclosure is displayed and must be acknowledged before proceeding.

**AC-M17-005:** Given an unverified vendor, when a member searches the marketplace, then the vendor's listings do not appear in results.

## 12. Test Expectations

- **Vendor lifecycle:** registration, verification, suspension, reinstatement, rejection
- **Listing CRUD:** create draft, publish (requires verified vendor), archive, re-activate
- **Order lifecycle:** place, confirm, fulfill, cancel, refund
- **Access gating:** active member only; Grace/Lapsed/non-member blocked
- **Search:** keyword search, category filter, empty results
- **BR-38:** referral disclosure display and acknowledgment flow
- **Listing visibility:** only from verified, non-suspended vendors

## 13. Edge Cases

- All vendors suspended: empty marketplace with "No vendors available" message.
- Vendor verification revoked mid-order: existing confirmed orders continue; new orders blocked.
- Referral terms updated after listing live: existing associations notified; interaction blocked until re-acknowledged (BR-38).
- Group purchasing offer with 0 participants at deadline: offer cancelled.
- Vendor deletes listing with pending orders: orders preserved with "listing removed" note.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth -- session required)
- M02 (Member Profile -- buyer identity)
- M05 (Membership -- active status gating)

### External Dependencies
- External vendor websites (link-out model)
- No internal payment processing (vendors handle their own)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Non-active member access | 403 | "Active membership required to access marketplace." |
| Vendor not found | 404 | "Vendor not found." |
| Listing not found | 404 | "Listing not found." |
| Order on suspended vendor | 400 | "This vendor is currently unavailable." |
| Duplicate vendor registration | 409 | "A vendor with this email already exists." |

## 16. Performance Expectations

- **Data volume:** 50-200 vendors, 500-2000 listings per association
- **Concurrent users:** 50-100 browsing simultaneously
- **Response times:** Search < 500ms, vendor detail < 300ms
- **Caching:** Listing search results cacheable (5min TTL); vendor verification status cached

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| marketplace.search | INFO | Search executed | query, category, resultCount | No |
| marketplace.vendor.verified | INFO | Vendor approved | vendorId | No |
| marketplace.vendor.suspended | WARN | Vendor suspended | vendorId, reason | No |
| marketplace.order.placed | INFO | Order created | orderId, listingId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| marketplace_searches_total | counter | category | Search count |
| marketplace_vendors_total | gauge | status | Vendor count by status |
| marketplace_orders_total | counter | status | Order count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| marketplace_enabled | release | false | Gates entire marketplace module | -- |
| marketplace_group_purchasing | release | false | Group buying feature | -- |
| marketplace_orders | release | false | Order placement (vs browse-only) | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M17-S1 | Vendor Management | Registration, verification, suspension | M03 (platform admin) | P0 |
| M17-S2 | Marketplace Browse | Search, filter, view listings | M17-S1, M05 | P0 |
| M17-S3 | Vendor Listings CRUD | Vendor creates/manages own listings | M17-S1 | P0 |
| M17-S4 | Order Placement | Member places order, vendor confirms/fulfills | M17-S2 | P1 |
| M17-S5 | Category Management | Admin configures marketplace categories | M17-S1 | P1 |
| M17-S6 | Referral Disclosure | BR-38 disclosure and acknowledgment flow | M17-S2 | P1 |
| M17-S7 | Group Purchasing | Collective buying offers with thresholds | M17-S4 | P2 |

## 20. AI Instructions

When implementing this module:
1. Schema file: `services/api-ts/src/handlers/marketplace/repos/marketplace.schema.ts` -- define `vendor`, `marketplace_listing`, `marketplace_order` tables with enums.
2. Follow Router -> Validators -> Handlers -> Repositories pattern per ARCHITECTURE.md.
3. TypeSpec first: define endpoints in `specs/api/src/modules/marketplace.tsp` before implementation.
4. Vendor verification is a platform admin action -- use `platformAdminAuthMiddleware`.
5. Browse endpoints use `requireActiveStatus()` handler guard for membership gating.
6. Order system is lightweight (no internal payment) -- vendors handle fulfillment externally.
7. Implement vertical slices: M17-S1 (vendor mgmt) first, then M17-S2 (browse), then remaining.
8. BR-38 referral disclosure: store disclosure text on vendor record; track acknowledgment per association.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | |
| 2. Domain Terms | COMPLETE | Vendor, Group Purchasing referenced from DOMAIN_GLOSSARY: Marketplace Terms |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP |
| 4. Workflow Details | COMPLETE | |
| 5. Business Rules | COMPLETE | BR-38 from upstream; M17-R1 through R5 module-specific |
| 6. Permissions | PARTIAL | No ROLE_PERMISSION_MATRIX section for M17 yet |
| 7. Data Requirements | COMPLETE | From DOMAIN_MODEL section 10 |
| 7b. Aggregate Boundaries | COMPLETE | |
| 8. State Transitions | COMPLETE | From DOMAIN_MODEL enums |
| 9. UI/UX Requirements | COMPLETE | |
| 10. API Expectations | COMPLETE | |
| 10b. Domain Events | COMPLETE | |
| 11. Acceptance Criteria | COMPLETE | |
| 12. Test Expectations | COMPLETE | |
| 13. Edge Cases | COMPLETE | |
| 14. Dependencies | COMPLETE | From MODULE_MAP |
| 15. Error Handling | COMPLETE | |
| 16. Performance | COMPLETE | |
| 17. Observability | COMPLETE | |
| 18. Feature Flags | COMPLETE | |
| 19. Vertical Slice Plan | COMPLETE | Expanded from v1.0 |
| 20. AI Instructions | COMPLETE | |
| 21. Section Completeness | COMPLETE | |
| 22. Downstream Impact | COMPLETE | |

## 22. Downstream Impact

- **DOMAIN_GLOSSARY.md**: Needs `Vendor`, `Group Purchasing`, `Marketplace Listing` term definitions added
- **ROLE_PERMISSION_MATRIX.md**: Needs section 3.x for Marketplace module
- **M16 (Advertising)**: Consumes `listing.published` event for ad opportunity targeting
- **API_CONTRACTS.md**: Marketplace endpoints not yet defined -- will need TypeSpec definitions
