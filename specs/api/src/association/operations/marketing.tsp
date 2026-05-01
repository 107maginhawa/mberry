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
 * Domain 52: Marketing Automation
 *
 * Covers multi-channel marketing campaigns, audience segment builder,
 * campaign sequence steps, send records, and suppression list management.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Marketing campaign channel type")
enum CampaignType {
  @doc("Email-only campaign")
  email: "email",

  @doc("SMS-only campaign")
  sms: "sms",

  @doc("Campaign spanning multiple channels")
  multiChannel: "multi_channel",
}

@doc("Lifecycle status of a marketing campaign")
enum MarketingCampaignStatus {
  @doc("Campaign is being configured")
  draft: "draft",

  @doc("Campaign is scheduled to launch at a future date")
  scheduled: "scheduled",

  @doc("Campaign is actively sending")
  active: "active",

  @doc("Campaign has been temporarily paused")
  paused: "paused",

  @doc("Campaign has finished sending")
  completed: "completed",
}

@doc("Conjunction operator for combining segment rules")
enum RuleConjunction {
  @doc("All conditions must be true (logical AND)")
  and: "and",

  @doc("At least one condition must be true (logical OR)")
  or: "or",
}

@doc("Channel used for a campaign sequence step")
enum SequenceChannel {
  @doc("Email message")
  email: "email",

  @doc("SMS text message")
  sms: "sms",
}

@doc("Delivery status for a campaign send record")
enum SendDeliveryStatus {
  @doc("Message was sent to the delivery provider")
  sent: "sent",

  @doc("Message was successfully delivered to the recipient")
  delivered: "delivered",

  @doc("Recipient opened the message")
  opened: "opened",

  @doc("Recipient clicked a link in the message")
  clicked: "clicked",

  @doc("Message bounced and was not delivered")
  bounced: "bounced",

  @doc("Recipient unsubscribed after receiving this message")
  unsubscribed: "unsubscribed",
}

@doc("Reason a contact was added to the suppression list")
enum SuppressionReason {
  @doc("Contact explicitly unsubscribed")
  unsubscribed: "unsubscribed",

  @doc("Address or number hard-bounced")
  bounced: "bounced",

  @doc("Recipient filed a spam complaint")
  complaint: "complaint",

  @doc("Manually suppressed by an administrator")
  manual: "manual",
}

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

@doc("A single rule within an audience segment definition")
model SegmentRule {
  @doc("Member data field to evaluate (e.g., 'membershipType', 'state')")
  @minLength(1)
  @maxLength(100)
  field: string;

  @doc("Comparison operator (e.g., 'eq', 'neq', 'gt', 'contains', 'in')")
  @minLength(1)
  @maxLength(50)
  operator: string;

  @doc("Value to compare against (serialised as string)")
  @maxLength(500)
  value: string;

  @doc("Logical conjunction to combine this rule with the previous one")
  conjunction: RuleConjunction;
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("A marketing campaign definition")
model MarketingCampaign extends BaseEntity {
  @doc("Tenant this campaign belongs to")
  tenantId: string;

  @doc("Campaign display name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Campaign channel type")
  type: CampaignType;

  @doc("Campaign objective or goal description")
  @maxLength(500)
  goal?: string;

  @doc("Identifier of the audience segment this campaign targets")
  audienceSegmentId?: string;

  @doc("Current lifecycle status")
  status: MarketingCampaignStatus;

  @doc("Scheduled or actual campaign start date")
  startDate?: utcDateTime;

  @doc("Scheduled or actual campaign end date")
  endDate?: utcDateTime;

  @doc("Total number of messages sent so far")
  @minValue(0)
  sentCount?: int32;

  @doc("Message open rate (0.0 to 1.0)")
  @minValue(0)
  @maxValue(1)
  openRate?: float64;

  @doc("Message click-through rate (0.0 to 1.0)")
  @minValue(0)
  @maxValue(1)
  clickRate?: float64;
}

@doc("A dynamic audience segment for targeting campaigns")
model AudienceSegment extends BaseEntity {
  @doc("Tenant this segment belongs to")
  tenantId: string;

  @doc("Segment display name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Ordered list of rules that define segment membership")
  rules: SegmentRule[];

  @doc("Estimated number of matching members (refreshed on demand)")
  @minValue(0)
  estimatedSize?: int32;

  @doc("UTC timestamp when the estimated size was last calculated")
  lastCalculatedAt?: utcDateTime;
}

@doc("A single step within a campaign sequence (drip programme)")
model CampaignSequence extends BaseEntity {
  @doc("Tenant this sequence step belongs to")
  tenantId: string;

  @doc("Parent campaign")
  campaignId: string;

  @doc("Ordinal step number within the sequence (1-based)")
  @minValue(1)
  stepNumber: int32;

  @doc("Delivery channel for this step")
  channel: SequenceChannel;

  @doc("Message template identifier to use for this step")
  templateId: string;

  @doc("Number of days to wait after the previous step before sending")
  @minValue(0)
  delayDays: int32;

  @doc("Optional condition expression that must be true to send this step")
  condition?: string;
}

@doc("An individual message send record within a campaign")
model CampaignSendRecord extends BaseEntity {
  @doc("Tenant this send record belongs to")
  tenantId: string;

  @doc("Parent campaign")
  campaignId: string;

  @doc("Sequence step number this record corresponds to")
  @minValue(1)
  sequenceStep: int32;

  @doc("Recipient person identifier")
  recipientId: string;

  @doc("UTC timestamp when the message was sent")
  sentAt: utcDateTime;

  @doc("Current delivery status")
  deliveryStatus: SendDeliveryStatus;
}

@doc("A contact suppressed from receiving marketing communications")
model SuppressionList extends BaseEntity {
  @doc("Tenant this suppression entry belongs to")
  tenantId: string;

  @doc("Suppressed email address")
  @format("email")
  email?: string;

  @doc("Suppressed phone number (E.164 format)")
  phone?: string;

  @doc("Reason for suppression")
  reason: SuppressionReason;

  @doc("UTC timestamp when the entry was added")
  addedAt: utcDateTime;

  @doc("Identifier of the person or system that added the entry")
  addedBy?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a marketing campaign")
model MarketingCampaignCreateRequest {
  @doc("Campaign name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Channel type")
  type: CampaignType;

  @doc("Goal description")
  goal?: string;

  @doc("Audience segment to target")
  audienceSegmentId?: string;

  @doc("Scheduled start date")
  startDate?: utcDateTime;

  @doc("Scheduled end date")
  endDate?: utcDateTime;
}

@doc("Request body for updating a marketing campaign")
model MarketingCampaignUpdateRequest {
  @doc("Campaign name")
  @minLength(1)
  @maxLength(255)
  name?: string;

  @doc("Goal description")
  goal?: string | null;

  @doc("Audience segment")
  audienceSegmentId?: string | null;

  @doc("Scheduled start date")
  startDate?: utcDateTime | null;

  @doc("Scheduled end date")
  endDate?: utcDateTime | null;
}

@doc("Query parameters for marketing campaign search")
model CampaignSearchParams {
  ...PaginationQuery;

  @doc("Filter by campaign type")
  @query
  type?: CampaignType;

  @doc("Filter by status")
  @query
  status?: MarketingCampaignStatus;
}

@doc("Request body for creating an audience segment")
model AudienceSegmentCreateRequest {
  @doc("Segment name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Segment rules")
  rules: SegmentRule[];
}

@doc("Query parameters for audience segment search")
model AudienceSegmentSearchParams {
  ...PaginationQuery;
}

@doc("Response body for a segment size calculation")
model SegmentCalculationResult {
  @doc("Calculated audience size")
  @minValue(0)
  estimatedSize: int32;

  @doc("UTC timestamp when the calculation was performed")
  calculatedAt: utcDateTime;

  @doc("Updated segment record")
  segment: AudienceSegment;
}

@doc("Request body for creating a campaign sequence step")
model CampaignSequenceCreateRequest {
  @doc("Parent campaign")
  campaignId: string;

  @doc("Step number within the sequence")
  @minValue(1)
  stepNumber: int32;

  @doc("Delivery channel")
  channel: SequenceChannel;

  @doc("Message template identifier")
  templateId: string;

  @doc("Delay in days from previous step")
  @minValue(0)
  delayDays: int32;

  @doc("Optional send condition")
  condition?: string;
}

@doc("Aggregate send statistics for a campaign")
model CampaignStats {
  @doc("Campaign identifier")
  campaignId: string;

  @doc("Total messages sent")
  @minValue(0)
  totalSent: int32;

  @doc("Total messages delivered")
  @minValue(0)
  totalDelivered: int32;

  @doc("Total messages opened")
  @minValue(0)
  totalOpened: int32;

  @doc("Total link clicks")
  @minValue(0)
  totalClicked: int32;

  @doc("Total bounces")
  @minValue(0)
  totalBounced: int32;

  @doc("Total unsubscribes triggered by this campaign")
  @minValue(0)
  totalUnsubscribed: int32;

  @doc("Computed open rate (0.0-1.0)")
  @minValue(0)
  @maxValue(1)
  openRate: float64;

  @doc("Computed click-through rate (0.0-1.0)")
  @minValue(0)
  @maxValue(1)
  clickRate: float64;
}

@doc("Query parameters for send record search")
model SendRecordSearchParams {
  ...PaginationQuery;

  @doc("Filter by campaign")
  @query
  campaignId?: string;

  @doc("Filter by recipient")
  @query
  recipientId?: string;

  @doc("Filter by delivery status")
  @query
  deliveryStatus?: SendDeliveryStatus;
}

@doc("Request body for adding a suppression entry")
model SuppressionAddRequest {
  @doc("Email address to suppress")
  @format("email")
  email?: string;

  @doc("Phone number to suppress")
  phone?: string;

  @doc("Reason for suppression")
  reason: SuppressionReason;

  @doc("Who is adding this entry")
  addedBy?: string;
}

@doc("Query parameters for suppression list search")
model SuppressionSearchParams {
  ...PaginationQuery;

  @doc("Filter by email address")
  @query
  email?: string;

  @doc("Filter by phone number")
  @query
  phone?: string;

  @doc("Filter by suppression reason")
  @query
  reason?: SuppressionReason;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/marketing")
@tag("Association:Operations")
namespace Association.Operations.Marketing {

  /**
   * Marketing campaign lifecycle management.
   */
  @useAuth(bearerAuth)
  interface MarketingCampaignManagement {
    @doc("Create a new marketing campaign.")
    @operationId("createMarketingCampaign")
    @post
    @route("/campaigns")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createMarketingCampaign(
      @body body: MarketingCampaignCreateRequest
    ): ApiCreatedResponse<MarketingCampaign>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a marketing campaign by ID.")
    @operationId("getMarketingCampaign")
    @get
    @route("/campaigns/{campaignId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getMarketingCampaign(
      @path campaignId: string
    ): ApiOkResponse<MarketingCampaign>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a marketing campaign.")
    @operationId("updateMarketingCampaign")
    @patch(#{implicitOptionality: true})
    @route("/campaigns/{campaignId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateMarketingCampaign(
      @path campaignId: string,
      @body updates: MarketingCampaignUpdateRequest
    ): ApiOkResponse<MarketingCampaign>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a marketing campaign.")
    @operationId("deleteMarketingCampaign")
    @delete
    @route("/campaigns/{campaignId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteMarketingCampaign(
      @path campaignId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search marketing campaigns with filtering and pagination.")
    @operationId("searchMarketingCampaigns")
    @get
    @route("/campaigns")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchMarketingCampaigns(
      ...CampaignSearchParams
    ): ApiOkResponse<PaginatedResponse<MarketingCampaign>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Launch a campaign — transitions it from draft or scheduled to active.")
    @operationId("launchMarketingCampaign")
    @post
    @route("/campaigns/{campaignId}/launch")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    launchMarketingCampaign(
      @path campaignId: string
    ): ApiOkResponse<MarketingCampaign>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Pause an active campaign.")
    @operationId("pauseMarketingCampaign")
    @post
    @route("/campaigns/{campaignId}/pause")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    pauseMarketingCampaign(
      @path campaignId: string
    ): ApiOkResponse<MarketingCampaign>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Audience segment management.
   */
  @useAuth(bearerAuth)
  interface AudienceSegmentManagement {
    @doc("Create a new audience segment.")
    @operationId("createAudienceSegment")
    @post
    @route("/segments")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createAudienceSegment(
      @body body: AudienceSegmentCreateRequest
    ): ApiCreatedResponse<AudienceSegment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an audience segment by ID.")
    @operationId("getAudienceSegment")
    @get
    @route("/segments/{segmentId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getAudienceSegment(
      @path segmentId: string
    ): ApiOkResponse<AudienceSegment>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an audience segment definition.")
    @operationId("updateAudienceSegment")
    @patch(#{implicitOptionality: true})
    @route("/segments/{segmentId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateAudienceSegment(
      @path segmentId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<AudienceSegment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete an audience segment.")
    @operationId("deleteAudienceSegment")
    @delete
    @route("/segments/{segmentId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteAudienceSegment(
      @path segmentId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search audience segments with pagination.")
    @operationId("searchAudienceSegments")
    @get
    @route("/segments")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchAudienceSegments(
      ...AudienceSegmentSearchParams
    ): ApiOkResponse<PaginatedResponse<AudienceSegment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Recalculate the estimated size for an audience segment.")
    @operationId("calculateAudienceSegmentSize")
    @post
    @route("/segments/{segmentId}/calculate")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    calculateAudienceSegmentSize(
      @path segmentId: string
    ): ApiOkResponse<SegmentCalculationResult>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Campaign sequence (drip step) management.
   */
  @useAuth(bearerAuth)
  interface CampaignSequenceManagement {
    @doc("Create a new campaign sequence step.")
    @operationId("createCampaignSequence")
    @post
    @route("/sequences")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createCampaignSequence(
      @body body: CampaignSequenceCreateRequest
    ): ApiCreatedResponse<CampaignSequence>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a campaign sequence step by ID.")
    @operationId("getCampaignSequence")
    @get
    @route("/sequences/{sequenceId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getCampaignSequence(
      @path sequenceId: string
    ): ApiOkResponse<CampaignSequence>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a campaign sequence step.")
    @operationId("updateCampaignSequence")
    @patch(#{implicitOptionality: true})
    @route("/sequences/{sequenceId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateCampaignSequence(
      @path sequenceId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<CampaignSequence>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a campaign sequence step.")
    @operationId("deleteCampaignSequence")
    @delete
    @route("/sequences/{sequenceId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteCampaignSequence(
      @path sequenceId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Campaign send record query and statistics.
   */
  @useAuth(bearerAuth)
  interface CampaignSendRecordService {
    @doc("Search campaign send records with filtering and pagination.")
    @operationId("searchCampaignSendRecords")
    @get
    @route("/send-records")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchCampaignSendRecords(
      ...SendRecordSearchParams
    ): ApiOkResponse<PaginatedResponse<CampaignSendRecord>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get aggregate send statistics for a campaign.")
    @operationId("getCampaignStats")
    @get
    @route("/campaigns/{campaignId}/stats")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getCampaignStats(
      @path campaignId: string
    ): ApiOkResponse<CampaignStats>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Communication suppression list management.
   */
  @useAuth(bearerAuth)
  interface SuppressionListManagement {
    @doc("Add an email address or phone number to the suppression list.")
    @operationId("addSuppressionEntry")
    @post
    @route("/suppression")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    addSuppressionEntry(
      @body body: SuppressionAddRequest
    ): ApiCreatedResponse<SuppressionList>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Remove a contact from the suppression list.")
    @operationId("removeSuppressionEntry")
    @delete
    @route("/suppression/{entryId}")
    @extension("x-security-required-roles", #["association:admin"])
    removeSuppressionEntry(
      @path entryId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search the suppression list with filtering and pagination.")
    @operationId("searchSuppressionList")
    @get
    @route("/suppression")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchSuppressionList(
      ...SuppressionSearchParams
    ): ApiOkResponse<PaginatedResponse<SuppressionList>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
