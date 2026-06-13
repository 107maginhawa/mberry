import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Marketplace Module (Top-level commerce)
 *
 * Vendor-driven commerce marketplace where association-vetted vendors list
 * products / services to members. Distinct from the Member Benefits
 * Marketplace (see association/operations/marketplace.tsp) which models
 * benefit partners, offers, redemptions, and resources.
 *
 * Endpoints (under /association/marketplace):
 *   POST   /vendors                                — register a vendor
 *   GET    /vendors                                — list vendors
 *   GET    /vendors/{vendorId}                     — fetch a vendor
 *   PATCH  /vendors/{vendorId}                     — update a vendor
 *   POST   /vendors/{vendorId}/verify              — review a vendor (approve/reject/suspend, officer)
 *   POST   /listings                               — create a listing
 *   GET    /listings                               — list listings
 *   PATCH  /listings/{listingId}                   — update / activate / archive a listing (officer)
 *   POST   /orders                                 — place an order
 *   GET    /orders                                 — list orders (org-scoped)
 *   GET    /orders/{orderId}                       — fetch an order (org-scoped)
 *   POST   /orders/{orderId}/cancel                — cancel a pending/confirmed order
 *   POST   /orders/{orderId}/fulfill               — mark order fulfilled (vendor/officer)
 *
 * Status: TypeSpec authored Wave G3 (S-C4-026). Routes are emitted under the
 * /association/* org-context boundary (AHA FIX-001 / G-01) and registered via
 * the generated registry; handler implementations live in
 * services/api-ts/src/handlers/marketplace/.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("Verification status of a marketplace vendor")
enum VendorStatus {
  pending: "pending",
  verified: "verified",
  suspended: "suspended",
  rejected: "rejected",
}

@doc("Category of marketplace vendor")
enum VendorCategory {
  emr: "emr",
  supplies: "supplies",
  insurance: "insurance",
  telehealth: "telehealth",
  other: "other",
}

@doc("Lifecycle status of a marketplace listing")
enum ListingStatus {
  draft: "draft",
  active: "active",
  archived: "archived",
}

@doc("Lifecycle status of a marketplace order")
enum OrderStatus {
  pending: "pending",
  confirmed: "confirmed",
  fulfilled: "fulfilled",
  cancelled: "cancelled",
  refunded: "refunded",
}

@doc("Officer decision when reviewing a vendor's verification")
enum VendorVerificationDecision {
  verified: "verified",
  rejected: "rejected",
  suspended: "suspended",
}

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

@doc("A registered marketplace vendor")
model MarketplaceVendor extends BaseEntity {
  @doc("Organisation the vendor is registered with")
  organizationId: UUID;

  @doc("Vendor company name")
  companyName: string;

  @doc("Vendor category")
  category: VendorCategory;

  @doc("Vendor description")
  description: string;

  @doc("Current verification status")
  verificationStatus: VendorStatus;

  @doc("Vendor website URL")
  websiteUrl?: Url;

  @doc("Primary contact email")
  contactEmail: Email;

  @doc("Optional Person ID of the contact representative")
  contactPersonId?: UUID;

  @doc("Timestamp when the vendor was verified")
  verifiedAt?: utcDateTime;

  @doc("Officer Person ID who verified the vendor")
  verifiedBy?: UUID;
}

@doc("A product/service listing posted by a vendor")
model MarketplaceListing extends BaseEntity {
  @doc("Organisation the listing belongs to")
  organizationId: UUID;

  @doc("Vendor owning the listing")
  vendorId: UUID;

  @doc("Listing title")
  title: string;

  @doc("Listing description")
  description: string;

  @doc("Unit price (decimal as string)")
  price?: string;

  @doc("ISO 4217 currency code")
  currency?: string;

  @doc("Current lifecycle status")
  status: ListingStatus;

  @doc("Free-form category tags")
  categoryTags?: string[];
}

@doc("An order placed by a member against a listing")
model MarketplaceOrder extends BaseEntity {
  @doc("Organisation the order belongs to")
  organizationId: UUID;

  @doc("Listing being ordered")
  listingId: UUID;

  @doc("Person placing the order")
  buyerPersonId: UUID;

  @doc("Vendor fulfilling the order")
  vendorId: UUID;

  @doc("Quantity ordered")
  @minValue(1)
  quantity: int32;

  @doc("Total price (decimal as string)")
  totalPrice: string;

  @doc("Current lifecycle status")
  status: OrderStatus;

  @doc("Free-text buyer notes")
  notes?: string;

  @doc("When the order was fulfilled")
  fulfilledAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for registering a vendor")
model CreateMarketplaceVendorRequest {
  @doc("Vendor company name")
  @minLength(1)
  @maxLength(255)
  companyName: string;

  @doc("Vendor category")
  category: VendorCategory;

  @doc("Vendor description")
  @minLength(1)
  description: string;

  @doc("Vendor website URL")
  websiteUrl?: Url;

  @doc("Primary contact email")
  contactEmail: Email;

  @doc("Optional Person ID of the contact representative")
  contactPersonId?: UUID;
}

@doc("Request body for updating a vendor")
model UpdateMarketplaceVendorRequest {
  @doc("Vendor company name")
  companyName?: string;

  @doc("Vendor category")
  category?: VendorCategory;

  @doc("Vendor description")
  description?: string;

  @doc("Vendor website URL")
  websiteUrl?: Url;

  @doc("Primary contact email")
  contactEmail?: Email;

  @doc("Verification status (officer-only transitions)")
  verificationStatus?: VendorStatus;
}

@doc("Request body for creating a marketplace listing")
model CreateMarketplaceListingRequest {
  @doc("Vendor owning the listing")
  vendorId: UUID;

  @doc("Listing title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Listing description")
  @minLength(1)
  description: string;

  @doc("Unit price as decimal string")
  price?: string;

  @doc("ISO 4217 currency code (default USD)")
  currency?: string;

  @doc("Initial status (default draft)")
  status?: ListingStatus;

  @doc("Optional category tags")
  categoryTags?: string[];
}

@doc("Request body for placing an order")
model CreateMarketplaceOrderRequest {
  @doc("Listing being ordered")
  listingId: UUID;

  @doc("Quantity to order")
  @minValue(1)
  quantity?: int32;

  @doc("Optional buyer notes")
  notes?: string;
}

@doc("Officer's vendor verification decision. Defaults to 'verified' when omitted.")
model VerifyVendorRequest {
  @doc("Target review decision: approve (verified), reject, or suspend.")
  decision?: VendorVerificationDecision;
}

@doc("Request body for updating a listing (editable fields and/or lifecycle transition)")
model UpdateMarketplaceListingRequest {
  @doc("Listing title")
  title?: string;

  @doc("Listing description")
  description?: string;

  @doc("Unit price as decimal string")
  price?: string;

  @doc("ISO 4217 currency code")
  currency?: string;

  @doc("Lifecycle status transition (draft → active → archived)")
  status?: ListingStatus;

  @doc("Category tags")
  categoryTags?: string[];
}

@doc("Paginated list of vendors")
model VendorListResponse {
  @doc("Page of vendors")
  data: MarketplaceVendor[];

  @doc("Pagination metadata")
  pagination: {
    total: int32;
    limit: int32;
    offset: int32;
  };
}

@doc("Paginated list of listings")
model ListingListResponse {
  @doc("Page of listings")
  data: MarketplaceListing[];

  @doc("Pagination metadata")
  pagination: {
    total: int32;
    limit: int32;
    offset: int32;
  };
}

@doc("Paginated list of orders")
model OrderListResponse {
  @doc("Page of orders")
  data: MarketplaceOrder[];

  @doc("Pagination metadata")
  pagination: {
    total: int32;
    limit: int32;
    offset: int32;
  };
}

// ---------------------------------------------------------------------------
// Namespace / interfaces
// ---------------------------------------------------------------------------

@route("/association/marketplace")
@tag("Marketplace")
namespace MarketplaceModule {
  @doc("Vendor onboarding, search, and officer-driven verification")
  interface VendorManagement {
    @doc("Register a new vendor. Officer-only.")
    @operationId("createVendor")
    @post
    @route("/vendors")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createVendor(
      @body body: CreateMarketplaceVendorRequest
    ): ApiCreatedResponse<MarketplaceVendor>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List or search vendors with optional filters.")
    @operationId("listVendors")
    @get
    @route("/vendors")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listVendors(
      @query organizationId?: UUID,
      @query category?: VendorCategory,
      @query verificationStatus?: VendorStatus,
      @query limit?: int32,
      @query offset?: int32
    ): ApiOkResponse<VendorListResponse>
      | ApiUnauthorizedResponse;

    @doc("Fetch a single vendor by ID.")
    @operationId("getVendor")
    @get
    @route("/vendors/{vendorId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getVendor(
      @path vendorId: UUID
    ): ApiOkResponse<MarketplaceVendor>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("Update a vendor. Officer-only.")
    @operationId("updateVendor")
    @patch(#{implicitOptionality: true})
    @route("/vendors/{vendorId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateVendor(
      @path vendorId: UUID,
      @body body: UpdateMarketplaceVendorRequest
    ): ApiOkResponse<MarketplaceVendor>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Review a vendor's verification — approve (verified), reject, or suspend. Decision defaults to 'verified'. Officer-only.")
    @operationId("verifyVendor")
    @post
    @route("/vendors/{vendorId}/verify")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "marketplace-vendor" })
    verifyVendor(
      @path vendorId: UUID,
      @body body: VerifyVendorRequest
    ): ApiOkResponse<MarketplaceVendor>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  @doc("Listing CRUD")
  interface ListingManagement {
    @doc("Create a marketplace listing under a verified vendor.")
    @operationId("createListing")
    @post
    @route("/listings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createListing(
      @body body: CreateMarketplaceListingRequest
    ): ApiCreatedResponse<MarketplaceListing>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("List/search marketplace listings.")
    @operationId("listListings")
    @get
    @route("/listings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listListings(
      @query organizationId?: UUID,
      @query vendorId?: UUID,
      @query status?: ListingStatus,
      @query categoryTag?: string,
      @query limit?: int32,
      @query offset?: int32
    ): ApiOkResponse<ListingListResponse>
      | ApiUnauthorizedResponse;

    @doc("Update a listing or transition its lifecycle status (draft → active → archived). Officer-only.")
    @operationId("updateListing")
    @patch(#{ implicitOptionality: true })
    @route("/listings/{listingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateListing(
      @path listingId: UUID,
      @body body: UpdateMarketplaceListingRequest
    ): ApiOkResponse<MarketplaceListing>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  @doc("Order placement and fulfilment")
  interface OrderManagement {
    @doc("Place an order against an active listing.")
    @operationId("createOrder")
    @post
    @route("/orders")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createOrder(
      @body body: CreateMarketplaceOrderRequest
    ): ApiCreatedResponse<MarketplaceOrder>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("List orders for the caller's organization, with optional filters.")
    @operationId("listOrders")
    @get
    @route("/orders")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listOrders(
      @query buyerPersonId?: UUID,
      @query vendorId?: UUID,
      @query status?: OrderStatus,
      @query limit?: int32,
      @query offset?: int32
    ): ApiOkResponse<OrderListResponse>
      | ApiUnauthorizedResponse;

    @doc("Fetch a single order by ID (org-scoped).")
    @operationId("getOrder")
    @get
    @route("/orders/{orderId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getOrder(
      @path orderId: UUID
    ): ApiOkResponse<MarketplaceOrder>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("Cancel a pending or confirmed order.")
    @operationId("cancelOrder")
    @post
    @route("/orders/{orderId}/cancel")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    cancelOrder(
      @path orderId: UUID
    ): ApiOkResponse<MarketplaceOrder>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Mark an order as fulfilled. Vendor or officer.")
    @operationId("fulfillOrder")
    @post
    @route("/orders/{orderId}/fulfill")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff", "user"])
    @extension("x-audit", #{ action: "complete", resourceType: "marketplace-order" })
    fulfillOrder(
      @path orderId: UUID
    ): ApiOkResponse<MarketplaceOrder>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }
}
