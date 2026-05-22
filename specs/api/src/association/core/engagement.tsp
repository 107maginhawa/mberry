import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "./primitives.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Domain 3 — Interaction & Engagement Timeline
 *
 * Tracks every discrete touchpoint a person has with the association
 * and derives a rolling engagement score used for segmentation, retention
 * campaigns, and reporting.
 */
namespace Association.Core.Engagement;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Discrete types of interaction events tracked by the system.")
enum InteractionEventType {
  @doc("Member authenticated into the portal.")
  login: "login",

  @doc("Member viewed a page or screen.")
  pageView: "pageView",

  @doc("Member opened a broadcast email.")
  emailOpen: "emailOpen",

  @doc("Member attended a chapter or association event.")
  eventAttend: "eventAttend",

  @doc("Member submitted a form (application, survey, etc.).")
  formSubmit: "formSubmit",

  @doc("Member completed a donation transaction.")
  donationMade: "donationMade",

  @doc("Member performed a volunteer action.")
  volunteerAction: "volunteerAction",
}

@doc("Engagement bucket derived from the computed score.")
enum EngagementBucket {
  @doc("Score ≥ 80 — very active member.")
  highly_engaged: "highly_engaged",

  @doc("Score 60–79 — regularly active.")
  engaged: "engaged",

  @doc("Score 40–59 — activity declining.")
  at_risk: "at_risk",

  @doc("Score 20–39 — infrequent activity.")
  disengaged: "disengaged",

  @doc("Score < 20 — no recent activity.")
  dormant: "dormant",
}

// ---------------------------------------------------------------------------
// Core models
// ---------------------------------------------------------------------------

@doc("A single discrete interaction event for a person.")
model InteractionEvent extends AssociationBaseEntity {
  @doc("Person this event belongs to.")
  personId: string;

  @doc("Type of interaction that occurred.")
  eventType: InteractionEventType;

  @doc("System or channel that produced the event (e.g. 'portal', 'mobile-app', 'email-platform').")
  source: string;

  @doc("Arbitrary additional data captured at event time.")
  metadata?: Record<unknown>;

  @doc("Wall-clock time at which the interaction occurred.")
  occurredAt: utcDateTime;
}

@doc("Computed engagement score for a person at a point in time.")
model EngagementScore extends AssociationBaseEntity {
  @doc("Person the score applies to.")
  personId: string;

  @doc("Overall engagement score (0–100 scale).")
  @minValue(0)
  @maxValue(100)
  score: float64;

  @doc("Qualitative bucket derived from the numeric score.")
  bucket: EngagementBucket;

  @doc("Timestamp at which this score was calculated.")
  calculatedAt: utcDateTime;

  @doc("Breakdown of score components (e.g. loginScore, eventScore, donationScore).")
  components?: Record<unknown>;
}

@doc("Aggregated activity summary for a person over a reporting period.")
model ActivitySummary {
  @doc("Person this summary describes.")
  personId: string;

  @doc("Reporting period label (e.g. '2024-Q1', '2024-03').")
  period: string;

  @doc("Number of portal logins in the period.")
  loginCount: int32;

  @doc("Number of events attended in the period.")
  eventAttendance: int32;

  @doc("Email open rate as a decimal fraction (0.0–1.0).")
  emailOpenRate: float64;

  @doc("Total value of donations made in the period (native currency).")
  donationsTotal: float64;

  @doc("Total volunteer hours recorded in the period.")
  volunteerHours: float64;

  @doc("Continuing-education or other credits earned in the period.")
  creditEarned: float64;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to record a single interaction event.")
model InteractionEventCreateRequest {
  @doc("Person this event belongs to.")
  personId: string;

  @doc("Type of interaction.")
  eventType: InteractionEventType;

  @doc("Source system or channel.")
  source: string;

  @doc("Optional event metadata.")
  metadata?: Record<unknown>;

  @doc("When the interaction occurred (defaults to now if omitted).")
  occurredAt?: utcDateTime;
}

@doc("Request body for bulk-ingesting interaction events.")
model InteractionEventBulkCreateRequest {
  @doc("Batch of events to create (max 500 per request).")
  @maxItems(500)
  events: InteractionEventCreateRequest[];
}

@doc("Query parameters for searching interaction events.")
model InteractionEventSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by person ID.")
  @query
  personId?: string;

  @doc("Filter by event type.")
  @query
  eventType?: InteractionEventType;

  @doc("Filter by source system.")
  @query
  source?: string;

  @doc("Events occurring on or after this timestamp.")
  @query
  occurredAfter?: utcDateTime;

  @doc("Events occurring on or before this timestamp.")
  @query
  occurredBefore?: utcDateTime;
}

@doc("Query parameters for searching engagement scores.")
model EngagementScoreSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by person ID.")
  @query
  personId?: string;

  @doc("Filter by engagement bucket.")
  @query
  bucket?: EngagementBucket;

  @doc("Scores calculated on or after this timestamp.")
  @query
  calculatedAfter?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/engagement/interactions")
@tag("Engagement")
namespace InteractionManagement {
  interface InteractionManagement {
    @doc("Record a single interaction event.")
    @operationId("createInteractionEvent")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "system"])
    createInteractionEvent(
      @body body: InteractionEventCreateRequest
    ): ApiCreatedResponse<InteractionEvent>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Bulk-ingest a batch of interaction events.")
    @operationId("bulkCreateInteractionEvents")
    @post
    @route("/bulk")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "system"])
    bulkCreateInteractionEvents(
      @body body: InteractionEventBulkCreateRequest
    ): ApiCreatedResponse<InteractionEvent[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list interaction events.")
    @operationId("searchInteractionEvents")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "support"])
    searchInteractionEvents(
      ...InteractionEventSearchParams
    ): ApiOkResponse<PaginatedResponse<InteractionEvent>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/engagement/scores")
@tag("Engagement")
namespace EngagementScoreManagement {
  interface EngagementScoreManagement {
    @doc("Get the current engagement score for a person.")
    @operationId("getEngagementScore")
    @get
    @route("/{personId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "support", "member:owner"])
    getEngagementScore(
      @path personId: string
    ): ApiOkResponse<EngagementScore>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Trigger a recalculation of the engagement score for a person.")
    @operationId("recalculateEngagementScore")
    @post
    @route("/{personId}/recalculate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "system"])
    recalculateEngagementScore(
      @path personId: string
    ): ApiOkResponse<EngagementScore>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search engagement scores across members.")
    @operationId("searchEngagementScores")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    searchEngagementScores(
      ...EngagementScoreSearchParams
    ): ApiOkResponse<PaginatedResponse<EngagementScore>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
