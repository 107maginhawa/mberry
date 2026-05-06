import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Domains 49-50: Member Benefits Marketplace & Knowledge Library
 *
 * Covers the association benefit partner directory, discount offers and
 * redemption tracking, plus a managed knowledge resource library with
 * member bookmarking.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Status of a benefit partner record")
enum BenefitPartnerStatus {
  @doc("Partner is active and offering benefits")
  active: "active",

  @doc("Partner relationship is temporarily suspended")
  suspended: "suspended",

  @doc("Partner agreement has expired")
  expired: "expired",
}

@doc("Type of discount provided by a benefit offer")
enum DiscountType {
  @doc("Percentage discount off the regular price")
  percentage: "percentage",

  @doc("Fixed monetary amount reduction")
  fixedAmount: "fixed_amount",

  @doc("A complimentary item or service")
  freeItem: "free_item",

  @doc("A specially negotiated rate")
  specialRate: "special_rate",
}

@doc("Status of a benefit offer")
enum BenefitOfferStatus {
  @doc("Offer is active and redeemable")
  active: "active",

  @doc("Offer validity period has ended")
  expired: "expired",

  @doc("Offer has been suspended by the partner or administrator")
  suspended: "suspended",
}

@doc("Resource type category")
enum ResourceType {
  @doc("Written article or blog post")
  article: "article",

  @doc("Video recording or lecture")
  video: "video",

  @doc("Document template for member use")
  template: "template",

  @doc("Comprehensive toolkit or resource bundle")
  toolkit: "toolkit",

  @doc("Official guideline or best-practice document")
  guideline: "guideline",

  @doc("Recorded or archived webinar")
  webinar: "webinar",

  @doc("Audio podcast episode or series")
  podcast: "podcast",
}

@doc("Access control level for a resource")
enum ResourceAccessLevel {
  @doc("Available to the general public without authentication")
  public: "public",

  @doc("Available to association members only")
  memberOnly: "member_only",

  @doc("Available to premium-tier members only")
  premium: "premium",
}

@doc("Lifecycle status of a knowledge resource")
enum ResourceStatus {
  @doc("Resource is a draft not yet available to members")
  draft: "draft",

  @doc("Resource is published and available")
  published: "published",

  @doc("Resource has been archived")
  archived: "archived",
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("An organization that provides member benefit offers")
model BenefitPartner extends BaseEntity {
  @doc("Tenant this partner belongs to")
  organizationId: string;

  @doc("Partner organization display name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Short description of the partner and their offering")
  description?: string;

  @doc("Business category (e.g., 'Insurance', 'Software', 'Travel')")
  @minLength(1)
  @maxLength(100)
  category: string;

  @doc("Primary contact email address")
  @format("email")
  contactEmail?: string;

  @doc("Partner website URL")
  website?: string;

  @doc("URL of the partner logo image")
  logoUrl?: string;

  @doc("Current partner status")
  status: BenefitPartnerStatus;
}

@doc("A member discount or benefit offer from a partner")
model BenefitOffer extends BaseEntity {
  @doc("Tenant this offer belongs to")
  organizationId: string;

  @doc("Partner providing this offer")
  partnerId: string;

  @doc("Offer headline title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Full offer description and terms")
  description: string;

  @doc("Type of discount provided")
  discountType: DiscountType;

  @doc("Numeric discount value (interpretation depends on discountType)")
  @minValue(0)
  discountValue?: int64;

  @doc("UTC date the offer becomes valid")
  validFrom: utcDateTime;

  @doc("UTC date the offer expires; null means no expiry")
  validTo?: utcDateTime;

  @doc("Human-readable eligibility rule description")
  eligibilityRule?: string;

  @doc("Redemption code members use to claim the offer")
  @maxLength(100)
  redemptionCode?: string;

  @doc("Current offer status")
  status: BenefitOfferStatus;
}

@doc("A record of a member redeeming a benefit offer")
model BenefitRedemption extends BaseEntity {
  @doc("Tenant this redemption belongs to")
  organizationId: string;

  @doc("Offer that was redeemed")
  offerId: string;

  @doc("Member who redeemed the offer")
  personId: string;

  @doc("UTC timestamp of redemption")
  redeemedAt: utcDateTime;

  @doc("Monetary value realised from this redemption")
  @minValue(0)
  value?: int64;
}

@doc("A knowledge resource in the association library")
model Resource extends BaseEntity {
  @doc("Tenant this resource belongs to")
  organizationId: string;

  @doc("Resource title")
  @minLength(1)
  @maxLength(500)
  title: string;

  @doc("Resource type category")
  type: ResourceType;

  @doc("Short description or summary")
  description?: string;

  @doc("Inline content body (for articles, guidelines)")
  content?: string;

  @doc("Storage system reference for downloadable files")
  fileRef?: string;

  @doc("Classification category")
  @minLength(1)
  @maxLength(100)
  category: string;

  @doc("Search tags")
  tags?: string[];

  @doc("Author name or identifier")
  @maxLength(255)
  author?: string;

  @doc("UTC timestamp when the resource was published")
  publishedAt?: utcDateTime;

  @doc("Access control level")
  accessLevel: ResourceAccessLevel;

  @doc("Total view count")
  @minValue(0)
  viewCount: int32;

  @doc("Total download count")
  @minValue(0)
  downloadCount: int32;

  @doc("Current resource status")
  status: ResourceStatus;
}

@doc("A member's bookmark on a knowledge resource")
model Bookmark extends BaseEntity {
  @doc("Tenant this bookmark belongs to")
  organizationId: string;

  @doc("Bookmarked resource")
  resourceId: string;

  @doc("Member who created the bookmark")
  personId: string;

  @doc("UTC timestamp when the bookmark was created")
  createdAt: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a benefit partner")
model BenefitPartnerCreateRequest {
  @doc("Partner name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Description")
  description?: string;

  @doc("Business category")
  @minLength(1)
  @maxLength(100)
  category: string;

  @doc("Contact email")
  @format("email")
  contactEmail?: string;

  @doc("Website URL")
  website?: string;

  @doc("Logo URL")
  logoUrl?: string;
}

@doc("Query parameters for benefit partner search")
model BenefitPartnerSearchParams {
  ...PaginationQuery;

  @doc("Filter by category")
  @query
  category?: string;

  @doc("Filter by status")
  @query
  status?: BenefitPartnerStatus;
}

@doc("Request body for creating a benefit offer")
model BenefitOfferCreateRequest {
  @doc("Partner offering this benefit")
  partnerId: string;

  @doc("Offer title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Offer description")
  description: string;

  @doc("Discount type")
  discountType: DiscountType;

  @doc("Discount value")
  @minValue(0)
  discountValue?: int64;

  @doc("Offer valid from")
  validFrom: utcDateTime;

  @doc("Offer valid to")
  validTo?: utcDateTime;

  @doc("Eligibility rule")
  eligibilityRule?: string;

  @doc("Redemption code")
  redemptionCode?: string;
}

@doc("Query parameters for benefit offer search")
model BenefitOfferSearchParams {
  ...PaginationQuery;

  @doc("Filter by partner")
  @query
  partnerId?: string;

  @doc("Filter by discount type")
  @query
  discountType?: DiscountType;

  @doc("Filter by status")
  @query
  status?: BenefitOfferStatus;
}

@doc("Request body for recording a benefit redemption")
model BenefitRedemptionCreateRequest {
  @doc("Offer being redeemed")
  offerId: string;

  @doc("Member redeeming the offer")
  personId: string;

  @doc("Realised value of this redemption")
  @minValue(0)
  value?: int64;
}

@doc("Query parameters for redemption search")
model BenefitRedemptionSearchParams {
  ...PaginationQuery;

  @doc("Filter by offer")
  @query
  offerId?: string;

  @doc("Filter by member")
  @query
  personId?: string;
}

@doc("Request body for creating a knowledge resource")
model ResourceCreateRequest {
  @doc("Resource title")
  @minLength(1)
  @maxLength(500)
  title: string;

  @doc("Resource type")
  type: ResourceType;

  @doc("Description")
  description?: string;

  @doc("Inline content body")
  content?: string;

  @doc("Storage file reference")
  fileRef?: string;

  @doc("Category")
  @minLength(1)
  @maxLength(100)
  category: string;

  @doc("Tags")
  tags?: string[];

  @doc("Author")
  author?: string;

  @doc("Access level")
  accessLevel: ResourceAccessLevel;
}

@doc("Query parameters for resource search")
model ResourceSearchParams {
  ...PaginationQuery;

  @doc("Filter by resource type")
  @query
  type?: ResourceType;

  @doc("Filter by category")
  @query
  category?: string;

  @doc("Filter by access level")
  @query
  accessLevel?: ResourceAccessLevel;

  @doc("Filter by status")
  @query
  status?: ResourceStatus;
}

@doc("Request body for creating a bookmark")
model BookmarkCreateRequest {
  @doc("Resource to bookmark")
  resourceId: string;

  @doc("Member creating the bookmark")
  personId: string;
}

@doc("Query parameters for bookmark listing")
model BookmarkListParams {
  ...PaginationQuery;

  @doc("Filter by member")
  @query
  personId?: string;

  @doc("Filter by resource")
  @query
  resourceId?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/marketplace")
@tag("Association:Operations")
namespace Association.Operations.Marketplace {

  /**
   * Benefit partner directory management.
   */
  @useAuth(bearerAuth)
  interface BenefitPartnerManagement {
    @doc("Create a new benefit partner.")
    @operationId("createBenefitPartner")
    @post
    @route("/partners")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createBenefitPartner(
      @body body: BenefitPartnerCreateRequest
    ): ApiCreatedResponse<BenefitPartner>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a benefit partner by ID.")
    @operationId("getBenefitPartner")
    @get
    @route("/partners/{partnerId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getBenefitPartner(
      @path partnerId: string
    ): ApiOkResponse<BenefitPartner>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a benefit partner.")
    @operationId("updateBenefitPartner")
    @patch(#{implicitOptionality: true})
    @route("/partners/{partnerId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateBenefitPartner(
      @path partnerId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<BenefitPartner>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a benefit partner.")
    @operationId("deleteBenefitPartner")
    @delete
    @route("/partners/{partnerId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteBenefitPartner(
      @path partnerId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search benefit partners with filtering and pagination.")
    @operationId("searchBenefitPartners")
    @get
    @route("/partners")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchBenefitPartners(
      ...BenefitPartnerSearchParams
    ): ApiOkResponse<PaginatedResponse<BenefitPartner>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Benefit offer management.
   */
  @useAuth(bearerAuth)
  interface BenefitOfferManagement {
    @doc("Create a benefit offer.")
    @operationId("createBenefitOffer")
    @post
    @route("/offers")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createBenefitOffer(
      @body body: BenefitOfferCreateRequest
    ): ApiCreatedResponse<BenefitOffer>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a benefit offer by ID.")
    @operationId("getBenefitOffer")
    @get
    @route("/offers/{offerId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getBenefitOffer(
      @path offerId: string
    ): ApiOkResponse<BenefitOffer>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a benefit offer.")
    @operationId("updateBenefitOffer")
    @patch(#{implicitOptionality: true})
    @route("/offers/{offerId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateBenefitOffer(
      @path offerId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<BenefitOffer>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a benefit offer.")
    @operationId("deleteBenefitOffer")
    @delete
    @route("/offers/{offerId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteBenefitOffer(
      @path offerId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search benefit offers with filtering and pagination.")
    @operationId("searchBenefitOffers")
    @get
    @route("/offers")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchBenefitOffers(
      ...BenefitOfferSearchParams
    ): ApiOkResponse<PaginatedResponse<BenefitOffer>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Benefit redemption tracking.
   */
  @useAuth(bearerAuth)
  interface BenefitRedemptionManagement {
    @doc("Record a benefit offer redemption.")
    @operationId("createBenefitRedemption")
    @post
    @route("/redemptions")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    createBenefitRedemption(
      @body body: BenefitRedemptionCreateRequest
    ): ApiCreatedResponse<BenefitRedemption>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search benefit redemption records.")
    @operationId("searchBenefitRedemptions")
    @get
    @route("/redemptions")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchBenefitRedemptions(
      ...BenefitRedemptionSearchParams
    ): ApiOkResponse<PaginatedResponse<BenefitRedemption>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Knowledge library resource management.
   */
  @useAuth(bearerAuth)
  interface ResourceManagement {
    @doc("Create a new knowledge resource.")
    @operationId("createResource")
    @post
    @route("/resources")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createResource(
      @body body: ResourceCreateRequest
    ): ApiCreatedResponse<Resource>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a resource by ID.")
    @operationId("getResource")
    @get
    @route("/resources/{resourceId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getResource(
      @path resourceId: string
    ): ApiOkResponse<Resource>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a resource.")
    @operationId("updateResource")
    @patch(#{implicitOptionality: true})
    @route("/resources/{resourceId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateResource(
      @path resourceId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Resource>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a resource.")
    @operationId("deleteResource")
    @delete
    @route("/resources/{resourceId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteResource(
      @path resourceId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search knowledge resources with filtering and pagination.")
    @operationId("searchResources")
    @get
    @route("/resources")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchResources(
      ...ResourceSearchParams
    ): ApiOkResponse<PaginatedResponse<Resource>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Increment the view counter for a resource.")
    @operationId("incrementResourceView")
    @post
    @route("/resources/{resourceId}/view")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    incrementResourceView(
      @path resourceId: string
    ): ApiOkResponse<Resource>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Member resource bookmarking.
   */
  @useAuth(bearerAuth)
  interface BookmarkManagement {
    @doc("Create a bookmark on a resource.")
    @operationId("createBookmark")
    @post
    @route("/bookmarks")
    @extension("x-security-required-roles", #["association:member:owner"])
    createBookmark(
      @body body: BookmarkCreateRequest
    ): ApiCreatedResponse<Bookmark>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Remove a bookmark.")
    @operationId("deleteBookmark")
    @delete
    @route("/bookmarks/{bookmarkId}")
    @extension("x-security-required-roles", #["association:member:owner"])
    deleteBookmark(
      @path bookmarkId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("List bookmarks for a member or resource.")
    @operationId("listBookmarks")
    @get
    @route("/bookmarks")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    listBookmarks(
      ...BookmarkListParams
    ): ApiOkResponse<PaginatedResponse<Bookmark>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
