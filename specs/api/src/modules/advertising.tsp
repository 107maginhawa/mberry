import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Advertising Module (M16)
 *
 * Sponsored content surface for associations. Handles advertiser onboarding,
 * campaign creation, creative review, ad placement, opt-out, and abuse reports.
 *
 * Endpoints (under /association/advertising):
 *   POST  /advertisers                          — register a new advertiser
 *   POST  /campaigns                            — create an ad campaign
 *   POST  /creatives                            — submit a creative for review
 *   POST  /creatives/{creativeId}/review        — approve/reject a creative
 *   POST  /creatives/{creativeId}/report        — abuse report from a member
 *   GET   /placement                            — fetch ad for a feed slot
 *   POST  /opt-out                              — member opt-out from ads
 *
 * Status: TypeSpec authored Wave G3 (S-C4-020). Route mounting is deferred
 * — the handler implementations exist in services/api-ts/src/handlers/advertising/
 * but are not currently wired into app.ts. See ROADMAP.md for activation plan.
 *
 * Business rules: M16-R1 (admin review), M16-R2 (segment targeting only, no PII),
 * M16-R3 (sponsored label required), M16-R4 (member opt-out), M16-R5 (abuse reporting),
 * M16-R6 (budget caps).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("Lifecycle status of an ad campaign")
enum AdCampaignStatus {
  draft: "draft",
  pendingReview: "pending_review",
  active: "active",
  paused: "paused",
  completed: "completed",
  rejected: "rejected",
}

@doc("Review status of a creative asset")
enum CreativeStatus {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
}

@doc("Display surface where the ad will appear")
enum AdSlot {
  feedBanner: "feed_banner",
  sidebar: "sidebar",
  emailFooter: "email_footer",
  eventSponsor: "event_sponsor",
}

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

@doc("A registered advertiser in the association's ad system")
model Advertiser extends BaseEntity {
  @doc("Organisation the advertiser is registered with")
  organizationId: UUID;

  @doc("Advertiser company name")
  companyName: string;

  @doc("Primary contact email")
  contactEmail: Email;

  @doc("Optional Person ID of the contact representative")
  contactPersonId?: UUID;

  @doc("Whether the advertiser is currently active")
  isActive: boolean;
}

@doc("An ad campaign owned by an advertiser")
model AdCampaign extends BaseEntity {
  @doc("Organisation the campaign runs in")
  organizationId: UUID;

  @doc("Advertiser running this campaign")
  advertiserId: UUID;

  @doc("Campaign name")
  name: string;

  @doc("Free-text campaign description")
  description?: string;

  @doc("Current lifecycle status")
  status: AdCampaignStatus;

  @doc("Segment ID used for targeting (M16-R2: no PII targeting)")
  targetSegmentId?: string;

  @doc("Estimated reach of the target segment")
  targetSegmentSize?: int32;

  @doc("Budget cap in minor units (cents)")
  @minValue(0)
  budgetCents: int32;

  @doc("Amount spent so far in minor units (cents)")
  @minValue(0)
  spentCents: int32;

  @doc("Campaign start time (ISO 8601)")
  startsAt?: utcDateTime;

  @doc("Campaign end time (ISO 8601)")
  endsAt?: utcDateTime;

  @doc("Display surface for this campaign")
  adSlot: AdSlot;
}

@doc("A creative (ad asset) submitted under a campaign")
model Creative extends BaseEntity {
  @doc("Organisation the creative belongs to")
  organizationId: UUID;

  @doc("Campaign this creative belongs to")
  campaignId: UUID;

  @doc("Creative headline")
  title: string;

  @doc("Creative body copy")
  bodyText: string;

  @doc("Optional image URL")
  imageUrl?: Url;

  @doc("Click-through URL")
  clickUrl?: Url;

  @doc("Current review status")
  status: CreativeStatus;

  @doc("Reviewer Person ID (set on review)")
  reviewedBy?: UUID;

  @doc("Timestamp of the review decision")
  reviewedAt?: utcDateTime;

  @doc("Reason if the creative was rejected")
  rejectionReason?: string;

  @doc("Whether the 'Sponsored' label must render with the creative (M16-R3)")
  sponsoredLabel: boolean;
}

// ---------------------------------------------------------------------------
// Request / response models
// ---------------------------------------------------------------------------

@doc("Request body for registering a new advertiser")
model CreateAdvertiserRequest {
  @doc("Advertiser company name")
  @minLength(1)
  @maxLength(255)
  companyName: string;

  @doc("Primary contact email address")
  contactEmail: Email;

  @doc("Optional Person ID of the contact representative")
  contactPersonId?: UUID;
}

@doc("Request body for creating a new campaign")
model CreateCampaignRequest {
  @doc("Advertiser running this campaign")
  advertiserId: UUID;

  @doc("Campaign name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Free-text description")
  description?: string;

  @doc("Segment ID used for targeting (M16-R2: PII targeting rejected)")
  targetSegmentId?: string;

  @doc("Estimated segment size")
  targetSegmentSize?: int32;

  @doc("Budget cap in minor units (cents)")
  @minValue(0)
  budgetCents?: int32;

  @doc("Campaign start time (ISO 8601)")
  startsAt?: utcDateTime;

  @doc("Campaign end time (ISO 8601)")
  endsAt?: utcDateTime;

  @doc("Display surface for this campaign")
  adSlot?: AdSlot;
}

@doc("Request body for submitting a creative")
model CreateCreativeRequest {
  @doc("Campaign this creative belongs to")
  campaignId: UUID;

  @doc("Creative headline")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Creative body copy")
  @minLength(1)
  bodyText: string;

  @doc("Optional image URL")
  imageUrl?: Url;

  @doc("Optional click-through URL")
  clickUrl?: Url;
}

@doc("Decision payload for a creative review")
model ReviewCreativeRequest {
  @doc("Whether to approve the creative")
  approved: boolean;

  @doc("Reason if rejecting (required when approved=false)")
  rejectionReason?: string;
}

@doc("Member abuse report payload")
model ReportAdRequest {
  @doc("Free-text reason the member is reporting the ad")
  @minLength(1)
  @maxLength(1000)
  reason: string;
}

@doc("Member opt-out request payload (M16-R4)")
model SetMemberOptOutRequest {
  @doc("Whether the member is opting out of ad personalization")
  optedOut: boolean;
}

@doc("Response for ad placement requests")
model AdPlacementResponse {
  @doc("Selected creative for display, or null if no eligible ads")
  ad: Creative | null;

  @doc("Whether the response is a generic/fallback ad")
  generic: boolean;

  @doc("Reason a generic ad was returned (when applicable)")
  reason?: string;
}

// ---------------------------------------------------------------------------
// Namespace / interfaces
// ---------------------------------------------------------------------------

@route("/association/advertising")
@tag("Advertising")
namespace AdvertisingModule {
  @doc("Advertiser onboarding (officer-only)")
  interface AdvertiserManagement {
    @doc("Register a new advertiser. Requires officer role.")
    @operationId("createAdvertiser")
    @post
    @route("/advertisers")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createAdvertiser(
      @body body: CreateAdvertiserRequest
    ): ApiCreatedResponse<Advertiser>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Campaign creation (officer-only)")
  interface CampaignManagement {
    @doc("Create a new campaign under an advertiser. Targeting must be segment-based (M16-R2).")
    @operationId("createCampaign")
    @post
    @route("/campaigns")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createCampaign(
      @body body: CreateCampaignRequest
    ): ApiCreatedResponse<AdCampaign>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  @doc("Creative submission and review")
  interface CreativeManagement {
    @doc("Submit a new creative under a campaign. Enters pending_review status.")
    @operationId("createCreative")
    @post
    @route("/creatives")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createCreative(
      @body body: CreateCreativeRequest
    ): ApiCreatedResponse<Creative>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @doc("Approve or reject a pending creative (M16-R1 admin review gate).")
    @operationId("reviewCreative")
    @post
    @route("/creatives/{creativeId}/review")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    reviewCreative(
      @path creativeId: UUID,
      @body body: ReviewCreativeRequest
    ): ApiOkResponse<Creative>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Submit a member-facing abuse report against a creative (M16-R5).")
    @operationId("reportAd")
    @post
    @route("/creatives/{creativeId}/report")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    reportAd(
      @path creativeId: UUID,
      @body body: ReportAdRequest
    ): ApiOkResponse<{ success: boolean }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;
  }

  @doc("Member-facing ad placement and opt-out")
  interface AdPlacement {
    @doc("Fetch an ad for placement in a feed slot. Returns null when member has opted out (M16-R4) or no approved creatives are available.")
    @operationId("getAdForPlacement")
    @get
    @route("/placement")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getAdForPlacement(
      @query optedOut?: boolean,
      @query adSlot?: AdSlot
    ): ApiOkResponse<AdPlacementResponse>
      | ApiUnauthorizedResponse;

    @doc("Opt the authenticated member in or out of ad personalization (M16-R4).")
    @operationId("setMemberOptOut")
    @post
    @route("/opt-out")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    setMemberOptOut(
      @body body: SetMemberOptOutRequest
    ): ApiOkResponse<{ success: boolean }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;
  }
}
