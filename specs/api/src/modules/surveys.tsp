import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Surveys Module - Structured Feedback & NPS Collection
 *
 * Provides a full survey lifecycle: create, publish, collect responses, analyze.
 * Supports multiple question types (NPS, rating, choice, text, yes/no).
 * Officers create and manage surveys; members respond.
 *
 * Key Features:
 * - Multi-question surveys with 6 question types
 * - NPS as a first-class survey type
 * - Event-driven triggers via pg-boss (post-check-in NPS)
 * - Pre-computed analytics (analyticsSnapshot JSONB)
 * - Anonymous survey support
 * - Rate limiting (max 2 survey prompts per member per week)
 * - Duplicate prevention (unique responderId per survey)
 */

// ============================================================================
// CORE MODELS
// ============================================================================

/**
 * Question within a survey
 */
@doc("Individual survey question definition")
model SurveyQuestion {
  @doc("Stable question identifier")
  id: UUID;

  @doc("Question type")
  type: SurveyQuestionType;

  @doc("Question text")
  @maxLength(500)
  text: string;

  @doc("Whether response is required")
  required: boolean;

  @doc("Display order (0-based)")
  @minValue(0)
  order: int32;

  @doc("Options for single_choice and multi_choice types")
  options?: string[];

  @doc("Scale range for nps and rating types")
  scale?: ScaleConfig;

  @doc("Max character length for text type")
  @minValue(1)
  @maxValue(5000)
  maxLength?: int32;

  @doc("Optional skip logic for conditional branching (schema prep — renderer not yet implemented)")
  skipLogic?: SkipLogicConfig;
}

@doc("Skip logic configuration for conditional question branching")
model SkipLogicConfig {
  @doc("Condition expression (e.g. 'value === yes' or 'value >= 8')")
  condition: string;

  @doc("Question ID to skip to when condition is met")
  targetQuestionId: UUID;
}

@doc("Survey question type")
enum SurveyQuestionType {
  @doc("Net Promoter Score (0-10)")
  nps: "nps",

  @doc("Star rating (1-5)")
  rating: "rating",

  @doc("Single choice (radio buttons)")
  single_choice: "single_choice",

  @doc("Multiple choice (checkboxes)")
  multi_choice: "multi_choice",

  @doc("Free text response")
  text: "text",

  @doc("Yes or No")
  yes_no: "yes_no",
}

@doc("Scale configuration for NPS and rating questions")
model ScaleConfig {
  @doc("Minimum value")
  min: int32;

  @doc("Maximum value")
  max: int32;
}

@doc("Structured target audience filter")
model TargetAudienceFilter {
  @doc("Membership tiers to target")
  tiers?: string[];

  @doc("Chapters to target")
  chapters?: string[];

  @doc("Committees to target")
  committees?: string[];
}

@doc("Survey settings")
model SurveySettings {
  @doc("Whether responses are anonymous (responder identity hidden from officers)")
  anonymous?: boolean;

  @doc("Survey deadline (UTC)")
  deadline?: utcDateTime;

  @doc("Structured target audience filter (replaces freeform string)")
  targetAudience?: TargetAudienceFilter;

  @doc("Max surveys per member per week before fatigue throttling (default: 2)")
  @minValue(1)
  fatigueThreshold?: int32;

  @doc("Data retention period in days (default: 1095 = 3 years). Responses purged after this period.")
  @minValue(30)
  retentionDays?: int32;
}

@doc("Survey status")
enum SurveyStatus {
  @doc("Draft - editable, not visible to members")
  draft: "draft",

  @doc("Active - accepting responses")
  active: "active",

  @doc("Closed - no longer accepting responses")
  closed: "closed",

  @doc("Archived - hidden from default views")
  archived: "archived",
}

@doc("Survey type classification")
enum SurveyType {
  @doc("Net Promoter Score survey")
  nps: "nps",

  @doc("Satisfaction survey")
  satisfaction: "satisfaction",

  @doc("Poll / vote")
  poll: "poll",

  @doc("Custom survey")
  custom: "custom",
}

/**
 * Survey entity
 */
@doc("Survey with questions and settings")
model Survey extends BaseEntity {
  @doc("Survey title")
  @maxLength(200)
  title: string;

  @doc("Survey description")
  @maxLength(2000)
  description?: string;

  @doc("Current status")
  status: SurveyStatus;

  @doc("Survey type classification")
  surveyType: SurveyType;

  @doc("Ordered list of questions")
  questions: SurveyQuestion[];

  @doc("Survey configuration")
  settings: SurveySettings;

  @doc("Pre-computed analytics snapshot")
  analyticsSnapshot?: SurveyAnalytics;

  @doc("Person who created the survey")
  createdBy: UUID;

  @doc("Requesting member's response status (only populated when mine=true)")
  myResponseStatus?: ResponseStatus;

  @doc("When the requesting member completed this survey (only populated when mine=true)")
  myCompletedAt?: utcDateTime;
}

@doc("Response status")
enum ResponseStatus {
  @doc("Awaiting member response")
  pending: "pending",

  @doc("Member submitted response")
  completed: "completed",

  @doc("Expired without response")
  skipped: "skipped",

  @doc("Member explicitly dismissed the prompt")
  dismissed: "dismissed",
}

/**
 * Individual response answer
 */
@doc("Answer to a single survey question")
model QuestionAnswer {
  @doc("Question ID this answer is for")
  questionId: UUID;

  @doc("Answer value (type depends on question type)")
  value: unknown;
}

/**
 * Survey response from a member
 */
@doc("Member's response to a survey")
model SurveyResponse extends BaseEntity {
  @doc("Survey this response belongs to")
  surveyId: UUID;

  @doc("Person who responded (null for anonymous surveys)")
  responderId?: UUID;

  @doc("Answers to survey questions")
  answers: QuestionAnswer[];

  @doc("Response status")
  status: ResponseStatus;

  @doc("When the response was completed")
  completedAt?: utcDateTime;

  @doc("Context that triggered this survey (event ID, booking ID, etc.)")
  contextId?: UUID;
}

/**
 * Analytics for a survey
 */
@doc("Pre-computed survey analytics")
model SurveyAnalytics {
  @doc("Total number of responses")
  totalResponses: int32;

  @doc("Completion rate (0-100)")
  completionRate: float32;

  @doc("NPS score (-100 to 100, only for NPS surveys)")
  npsScore?: float32;

  @doc("Per-question breakdown")
  questionBreakdown: Record<unknown>;
}

/**
 * Trend point for NPS over time
 */
@doc("Single data point on an NPS trend line")
model NpsTrendPoint {
  @doc("Survey creation date")
  date: utcDateTime;

  @doc("NPS score (-100 to 100)")
  score: float32;

  @doc("Title of the survey producing this score")
  surveyTitle: string;

  @doc("Total responses contributing to this score")
  responseCount: int32;
}

/**
 * Result of bulk delete of a member's survey responses
 */
@doc("Outcome of deleting a member's survey responses (data retention / right-to-deletion)")
model DeleteMemberResponsesResult {
  @doc("Number of responses deleted")
  deletedCount: int32;
}

/**
 * Admin-tier flattened survey row (cross-org listing)
 */
@doc("Survey row in the platform-admin cross-org listing")
model AdminSurveyListItem {
  @doc("Survey ID")
  id: UUID;

  @doc("Survey title")
  title: string;

  @doc("Organization that owns the survey")
  organizationName?: string;

  @doc("Survey type")
  surveyType: SurveyType;

  @doc("Current lifecycle status")
  status: SurveyStatus;

  @doc("Response count from analytics snapshot")
  responseCount: int32;

  @doc("Number of questions on the survey")
  questionCount: int32;

  @doc("NPS score from analytics snapshot, if any")
  npsScore?: float32;

  @doc("When the survey was created")
  createdAt: utcDateTime;
}

@doc("Aggregate stats for the platform-admin survey overview")
model AdminSurveyStats {
  @doc("Total surveys across all orgs")
  totalSurveys: int32;

  @doc("Surveys currently in 'active' status")
  activeSurveys: int32;

  @doc("Average NPS across surveys with analytics, if any")
  avgNps?: float32;

  @doc("Average response rate (completion %) across surveys with analytics")
  avgResponseRate: float32;
}

@doc("Platform-admin cross-org survey listing")
model AdminSurveyListResponse {
  @doc("Survey rows for the requested page")
  data: AdminSurveyListItem[];

  @doc("Total matching surveys")
  total: int32;

  @doc("Aggregate stats across ALL surveys (unfiltered)")
  stats: AdminSurveyStats;
}

// ============================================================================
// REQUEST MODELS
// ============================================================================

@doc("Request to create a survey")
model CreateSurveyRequest {
  @doc("Survey title")
  @maxLength(200)
  title: string;

  @doc("Survey description")
  @maxLength(2000)
  description?: string;

  @doc("Survey type")
  surveyType: SurveyType;

  @doc("Questions (can be empty for draft)")
  questions?: SurveyQuestion[];

  @doc("Survey settings")
  settings?: SurveySettings;
}

@doc("Request to update a draft survey")
model UpdateSurveyRequest {
  @doc("Updated title")
  @maxLength(200)
  title?: string;

  @doc("Updated description")
  @maxLength(2000)
  description?: string;

  @doc("Updated survey type")
  surveyType?: SurveyType;

  @doc("Updated questions")
  questions?: SurveyQuestion[];

  @doc("Updated settings")
  settings?: SurveySettings;
}

@doc("Request to submit a survey response")
model SubmitResponseRequest {
  @doc("Answers to survey questions")
  answers: QuestionAnswer[];

  @doc("Optional context (event/booking that triggered this)")
  contextId?: UUID;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

namespace SurveysModule {
  interface SurveysManagement {

    @doc("Create a new survey (draft). Requires officer or admin role.")
    @operationId("createSurvey")
    @post
    @route("/")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    createSurvey(
      @body request: CreateSurveyRequest
    ): ApiCreatedResponse<Survey>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List surveys. Officers see all org surveys. Members see assigned surveys (mine=true).")
    @operationId("listSurveys")
    @get
    @route("/")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listSurveys(
      @doc("Filter by status")
      @query status?: SurveyStatus,
      @doc("Filter by survey type")
      @query surveyType?: SurveyType,
      @doc("Show only my assigned surveys")
      @query mine?: boolean,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Survey>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get survey details.")
    @operationId("getSurvey")
    @get
    @route("/{survey}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getSurvey(
      @path survey: UUID
    ): ApiOkResponse<Survey>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a draft survey. Only draft status surveys can be modified.")
    @operationId("updateSurvey")
    @patch
    @route("/{survey}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    updateSurvey(
      @path survey: UUID,
      @body request: UpdateSurveyRequest
    ): ApiOkResponse<Survey>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a draft survey. Only draft status surveys can be deleted.")
    @operationId("deleteSurvey")
    @delete
    @route("/{survey}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    deleteSurvey(
      @path survey: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Publish a draft survey. Transitions to active. Questions must not be empty.")
    @operationId("publishSurvey")
    @post
    @route("/{survey}/publish")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    publishSurvey(
      @path survey: UUID
    ): ApiOkResponse<Survey>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Close an active survey. No more responses accepted.")
    @operationId("closeSurvey")
    @post
    @route("/{survey}/close")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    closeSurvey(
      @path survey: UUID
    ): ApiOkResponse<Survey>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Submit a survey response. Returns 409 if already submitted.")
    @operationId("submitSurveyResponse")
    @post
    @route("/{survey}/responses")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    submitSurveyResponse(
      @path survey: UUID,
      @body request: SubmitResponseRequest
    ): ApiCreatedResponse<SurveyResponse>
      | ApiConflictResponse
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Dismiss an NPS/survey prompt. Records dismissed status server-side so it persists across devices.")
    @operationId("dismissSurveyResponse")
    @post
    @route("/{survey}/responses/dismiss")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    dismissSurveyResponse(
      @path survey: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List survey responses. Officer/admin only. Anonymous surveys hide responderId.")
    @operationId("listSurveyResponses")
    @get
    @route("/{survey}/responses")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    listSurveyResponses(
      @path survey: UUID,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<SurveyResponse>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get survey analytics. Pre-computed snapshot with fallback.")
    @operationId("getSurveyAnalytics")
    @get
    @route("/{survey}/analytics")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    getSurveyAnalytics(
      @path survey: UUID
    ): ApiOkResponse<SurveyAnalytics>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Export survey responses as CSV. Officer/admin only.")
    @operationId("exportSurveyResponses")
    @get
    @route("/{survey}/export")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    exportSurveyResponses(
      @path survey: UUID,
      @doc("Export format")
      @query format?: string
    ): ApiOkResponse<string>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Clone a survey as a new draft with '(Copy)' suffix. Officer/admin only.")
    @operationId("cloneSurvey")
    @post
    @route("/{survey}/clone")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    cloneSurvey(
      @path survey: UUID
    ): ApiCreatedResponse<Survey>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("NPS trends across surveys for trend visualization. Officer/admin only.")
    @operationId("getNpsTrends")
    @get
    @route("/analytics/nps-trends")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer", "admin"])
    getNpsTrends(): ApiOkResponse<NpsTrendPoint[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete all survey responses for the authenticated member (right-to-deletion).")
    @operationId("deleteMemberResponses")
    @delete
    @route("/my-responses")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    deleteMemberResponses(): ApiOkResponse<DeleteMemberResponsesResult>
      | ApiUnauthorizedResponse;
  }

  @doc("Platform-admin cross-org survey listing")
  interface AdminSurveysManagement {

    @doc("List surveys across all orgs with aggregate stats. Platform admin only.")
    @operationId("listAdminSurveys")
    @get
    @route("/")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    listAdminSurveys(
      @doc("Page size (max 100, default 25)")
      @query limit?: int32,
      @doc("Page offset (default 0)")
      @query offset?: int32,
      @doc("Filter by lifecycle status")
      @query status?: SurveyStatus,
      @doc("Filter by survey type")
      @query surveyType?: SurveyType
    ): ApiOkResponse<AdminSurveyListResponse>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
