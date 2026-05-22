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
 * Domains 41-43: Conference, Abstracts & Exhibitors
 *
 * Covers annual conferences and multi-day events including program tracks,
 * sessions, speakers, abstract submissions, and exhibitor booth management.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a conference")
enum ConferenceStatus {
  @doc("Conference is being planned — not yet announced")
  planning: "planning",

  @doc("Conference has been announced")
  announced: "announced",

  @doc("Registration is open")
  registrationOpen: "registration_open",

  @doc("Conference is currently in progress")
  inProgress: "in_progress",

  @doc("Conference has concluded")
  completed: "completed",
}

@doc("Status of a submitted conference abstract")
enum AbstractStatus {
  @doc("Abstract has been submitted and awaits review")
  submitted: "submitted",

  @doc("Abstract is currently being reviewed")
  underReview: "under_review",

  @doc("Abstract has been accepted for presentation")
  accepted: "accepted",

  @doc("Abstract was not accepted")
  rejected: "rejected",

  @doc("Submitter withdrew the abstract")
  withdrawn: "withdrawn",

  @doc("Abstract has been scheduled for a session")
  presentationScheduled: "presentation_scheduled",
}

@doc("Status of a conference speaker invitation")
enum SpeakerStatus {
  @doc("Speaker has been invited but not yet responded")
  invited: "invited",

  @doc("Speaker has confirmed their participation")
  confirmed: "confirmed",

  @doc("Speaker declined the invitation")
  declined: "declined",

  @doc("Speaker cancelled after confirming")
  cancelled: "cancelled",
}

@doc("Lifecycle status of a session within a conference")
enum SessionStatus {
  @doc("Session is scheduled")
  scheduled: "scheduled",

  @doc("Session is currently in progress")
  inProgress: "in_progress",

  @doc("Session has concluded")
  completed: "completed",

  @doc("Session has been cancelled")
  cancelled: "cancelled",
}

@doc("Status of an exhibitor application")
enum ExhibitorStatus {
  @doc("Application submitted and awaiting review")
  applied: "applied",

  @doc("Application has been approved")
  approved: "approved",

  @doc("Exhibitor has confirmed their participation")
  confirmed: "confirmed",

  @doc("Participation was cancelled")
  cancelled: "cancelled",
}

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

@doc("A named program track within a conference")
model ConferenceTrack {
  @doc("Track display name")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Track description and focus area")
  description?: string;

  @doc("Color used for visual differentiation in the schedule (hex or named color)")
  @maxLength(50)
  color?: string;
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("An association conference or multi-day event")
model Conference extends BaseEntity {

  @doc("Conference display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("UTC date the conference starts")
  startDate: utcDateTime;

  @doc("UTC date the conference ends")
  endDate: utcDateTime;

  @doc("Venue name or address")
  @maxLength(500)
  venue?: string;

  @doc("Host city")
  @maxLength(100)
  city?: string;

  @doc("ISO 3166-1 alpha-2 country code")
  @maxLength(2)
  country?: string;

  @doc("Full description and overview")
  description?: string;

  @doc("Program tracks for organizing sessions")
  tracks: ConferenceTrack[];

  @doc("Current lifecycle status")
  status: ConferenceStatus;

  @doc("Standard registration fee")
  @minValue(0)
  registrationFee?: int64;

  @doc("Early-bird registration fee")
  @minValue(0)
  earlyBirdFee?: int64;

  @doc("Maximum number of attendees")
  @minValue(1)
  capacity?: int32;
}

@doc("A scheduled session within a conference program")
model Session extends BaseEntity {

  @doc("Parent conference")
  conferenceId: string;

  @doc("Program track name this session belongs to")
  @maxLength(100)
  track?: string;

  @doc("Session display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Session abstract or description")
  description?: string;

  @doc("List of speaker identifiers presenting this session")
  speakers: string[];

  @doc("UTC start time of the session")
  startTime: utcDateTime;

  @doc("UTC end time of the session")
  endTime: utcDateTime;

  @doc("Room or hall assignment")
  @maxLength(100)
  room?: string;

  @doc("Maximum attendee capacity for this session")
  @minValue(1)
  capacity?: int32;

  @doc("CE credits awarded for attending this session")
  @minValue(0)
  creditAmount?: float64;

  @doc("Current session status")
  status: SessionStatus;
}

@doc("A confirmed or invited speaker at a conference")
model Speaker extends BaseEntity {

  @doc("Parent conference")
  conferenceId: string;

  @doc("Person record for this speaker")
  personId: string;

  @doc("Speaker biography")
  bio: string;

  @doc("URL of the speaker headshot")
  photoUrl?: string;

  @doc("Company or institution affiliation")
  @maxLength(255)
  company?: string;

  @doc("Speaker's professional title")
  @maxLength(255)
  title?: string;

  @doc("Current speaker participation status")
  status: SpeakerStatus;

  @doc("Agreed honorarium payment amount")
  @minValue(0)
  honorariumAmount?: int64;

  @doc("Agreed travel reimbursement amount")
  @minValue(0)
  travelReimbursement?: int64;

  @doc("Whether the speaker has submitted IRS Form W-9")
  w9Submitted?: boolean;
}

@doc("A paper or presentation abstract submitted for conference review")
model AbstractSubmission extends BaseEntity {

  @doc("Target conference")
  conferenceId: string;

  @doc("Primary author (person identifier)")
  authorId: string;

  @doc("Submission title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Full abstract text")
  abstract: string;

  @doc("Subject or topic category")
  @maxLength(100)
  category?: string;

  @doc("Search and classification keywords")
  keywords?: string[];

  @doc("List of co-author names or identifiers")
  coAuthors?: string[];

  @doc("Current review status")
  status: AbstractStatus;

  @doc("UTC timestamp of submission")
  submittedAt: utcDateTime;

  @doc("Aggregate reviewer score (0-10 scale)")
  @minValue(0)
  @maxValue(10)
  reviewScore?: float64;

  @doc("Consolidated reviewer feedback")
  reviewerComments?: string;
}

@doc("An exhibitor or sponsor profile for a conference")
model ExhibitorProfile extends BaseEntity {

  @doc("Parent conference")
  conferenceId: string;

  @doc("Exhibiting organization name")
  @minLength(1)
  @maxLength(255)
  organizationName: string;

  @doc("Primary contact person name")
  @maxLength(255)
  contactPerson: string;

  @doc("Primary contact email address")
  @format("email")
  contactEmail: string;

  @doc("Requested or assigned booth size (e.g., 10x10, 10x20)")
  @maxLength(50)
  boothSize?: string;

  @doc("Assigned booth number or identifier on the floor plan")
  @maxLength(50)
  boothNumber?: string;

  @doc("Sponsorship tier (e.g., Platinum, Gold, Silver)")
  @maxLength(100)
  sponsorshipLevel?: string;

  @doc("Total sponsorship or booth fee amount")
  @minValue(0)
  amount?: int64;

  @doc("Current application status")
  status: ExhibitorStatus;

  @doc("Special setup requirements or notes")
  specialRequirements?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a conference")
model ConferenceCreateRequest {
  @doc("Conference title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("UTC start date")
  startDate: utcDateTime;

  @doc("UTC end date")
  endDate?: utcDateTime;

  @doc("Venue name or address")
  venue?: string;

  @doc("Host city")
  city?: string;

  @doc("Country code")
  @maxLength(2)
  country?: string;

  @doc("Description")
  description?: string;

  @doc("Program tracks")
  tracks: ConferenceTrack[];

  @doc("Standard registration fee")
  @minValue(0)
  registrationFee?: int64;

  @doc("Early-bird fee")
  @minValue(0)
  earlyBirdFee?: int64;

  @doc("Maximum capacity")
  @minValue(1)
  capacity?: int32;
}

@doc("Query parameters for conference search")
model ConferenceSearchParams {
  ...PaginationQuery;

  @doc("Filter by organization")
  @query
  organizationId?: string;

  @doc("Filter by status")
  @query
  status?: ConferenceStatus;

  @doc("Filter by country code")
  @query
  country?: string;
}

@doc("Request body for creating a conference session")
model SessionCreateRequest {
  @doc("Parent conference")
  conferenceId: string;

  @doc("Program track name")
  track?: string;

  @doc("Session title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Session description")
  description?: string;

  @doc("Speaker identifiers")
  speakers: string[];

  @doc("UTC start time")
  startTime: utcDateTime;

  @doc("UTC end time")
  endTime?: utcDateTime;

  @doc("Room assignment")
  room?: string;

  @doc("Session capacity")
  @minValue(1)
  capacity?: int32;

  @doc("CE credit amount")
  @minValue(0)
  creditAmount?: float64;
}

@doc("Query parameters for session search")
model SessionSearchParams {
  ...PaginationQuery;

  @doc("Filter by conference")
  @query
  conferenceId?: string;

  @doc("Filter by track")
  @query
  track?: string;

  @doc("Filter by status")
  @query
  status?: SessionStatus;
}

@doc("Request body for creating a speaker record")
model SpeakerCreateRequest {
  @doc("Parent conference")
  conferenceId: string;

  @doc("Person identifier")
  personId: string;

  @doc("Speaker biography")
  bio: string;

  @doc("Photo URL")
  photoUrl?: string;

  @doc("Company or institution")
  company?: string;

  @doc("Professional title")
  title?: string;

  @doc("Honorarium amount")
  @minValue(0)
  honorariumAmount?: int64;

  @doc("Travel reimbursement amount")
  @minValue(0)
  travelReimbursement?: int64;
}

@doc("Request body for submitting an abstract")
model AbstractSubmissionCreateRequest {
  @doc("Target conference")
  conferenceId: string;

  @doc("Primary author identifier")
  authorId: string;

  @doc("Submission title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Abstract text")
  abstract: string;

  @doc("Category")
  category?: string;

  @doc("Keywords")
  keywords?: string[];

  @doc("Co-author names or identifiers")
  coAuthors?: string[];
}

@doc("Request body for reviewing an abstract")
model AbstractReviewRequest {
  @doc("Numeric review score (0-10)")
  @minValue(0)
  @maxValue(10)
  reviewScore: float64;

  @doc("Reviewer comments and feedback")
  reviewerComments?: string;
}

@doc("Query parameters for abstract submission search")
model AbstractSearchParams {
  ...PaginationQuery;

  @doc("Filter by conference")
  @query
  conferenceId?: string;

  @doc("Filter by status")
  @query
  status?: AbstractStatus;

  @doc("Filter by author")
  @query
  authorId?: string;
}

@doc("Request body for creating an exhibitor profile")
model ExhibitorCreateRequest {
  @doc("Parent conference")
  conferenceId: string;

  @doc("Organization name")
  @minLength(1)
  @maxLength(255)
  organizationName: string;

  @doc("Contact person name")
  contactPerson: string;

  @doc("Contact email")
  @format("email")
  contactEmail: string;

  @doc("Requested booth size")
  boothSize?: string;

  @doc("Sponsorship tier")
  sponsorshipLevel?: string;

  @doc("Amount")
  @minValue(0)
  amount?: int64;

  @doc("Special requirements")
  specialRequirements?: string;
}

@doc("Query parameters for exhibitor search")
model ExhibitorSearchParams {
  ...PaginationQuery;

  @doc("Filter by conference")
  @query
  conferenceId?: string;

  @doc("Filter by status")
  @query
  status?: ExhibitorStatus;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/conferences")
@tag("Association:Operations")
namespace Association.Operations.Conference {

  /**
   * Conference lifecycle management.
   */
  @useAuth(bearerAuth)
  interface ConferenceManagement {
    @doc("Create a new conference.")
    @operationId("createConference")
    @post
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createConference(
      @body body: ConferenceCreateRequest
    ): ApiCreatedResponse<Conference>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a conference by ID.")
    @operationId("getConference")
    @get
    @route("/{conferenceId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getConference(
      @path conferenceId: string
    ): ApiOkResponse<Conference>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a conference.")
    @operationId("updateConference")
    @patch(#{implicitOptionality: true})
    @route("/{conferenceId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateConference(
      @path conferenceId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Conference>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a conference.")
    @operationId("deleteConference")
    @delete
    @route("/{conferenceId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteConference(
      @path conferenceId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search conferences with filtering and pagination.")
    @operationId("searchConferences")
    @get
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchConferences(
      ...ConferenceSearchParams
    ): ApiOkResponse<PaginatedResponse<Conference>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Conference session management.
   */
  @useAuth(bearerAuth)
  interface SessionManagement {
    @doc("Create a new session within a conference.")
    @operationId("createSession")
    @post
    @route("/sessions")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createSession(
      @body body: SessionCreateRequest
    ): ApiCreatedResponse<Session>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a session by ID.")
    @operationId("getSession")
    @get
    @route("/sessions/{sessionId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getSession(
      @path sessionId: string
    ): ApiOkResponse<Session>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a session.")
    @operationId("updateSession")
    @patch(#{implicitOptionality: true})
    @route("/sessions/{sessionId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateSession(
      @path sessionId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Session>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a session.")
    @operationId("deleteSession")
    @delete
    @route("/sessions/{sessionId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteSession(
      @path sessionId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search sessions with filtering and pagination.")
    @operationId("searchSessions")
    @get
    @route("/sessions")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchSessions(
      ...SessionSearchParams
    ): ApiOkResponse<PaginatedResponse<Session>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Conference speaker management.
   */
  @useAuth(bearerAuth)
  interface SpeakerManagement {
    @doc("Add a speaker to a conference.")
    @operationId("createSpeaker")
    @post
    @route("/speakers")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createSpeaker(
      @body body: SpeakerCreateRequest
    ): ApiCreatedResponse<Speaker>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a speaker record by ID.")
    @operationId("getSpeaker")
    @get
    @route("/speakers/{speakerId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getSpeaker(
      @path speakerId: string
    ): ApiOkResponse<Speaker>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a speaker record.")
    @operationId("updateSpeaker")
    @patch(#{implicitOptionality: true})
    @route("/speakers/{speakerId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateSpeaker(
      @path speakerId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Speaker>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a speaker record.")
    @operationId("deleteSpeaker")
    @delete
    @route("/speakers/{speakerId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteSpeaker(
      @path speakerId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search speaker records with filtering and pagination.")
    @operationId("searchSpeakers")
    @get
    @route("/speakers")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchSpeakers(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Speaker>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Confirm a speaker's participation.")
    @operationId("confirmSpeaker")
    @post
    @route("/speakers/{speakerId}/confirm")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    confirmSpeaker(
      @path speakerId: string
    ): ApiOkResponse<Speaker>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Abstract submission management including peer review workflow.
   */
  @useAuth(bearerAuth)
  interface AbstractSubmissionManagement {
    @doc("Submit a new conference abstract.")
    @operationId("createAbstractSubmission")
    @post
    @route("/abstracts")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    createAbstractSubmission(
      @body body: AbstractSubmissionCreateRequest
    ): ApiCreatedResponse<AbstractSubmission>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an abstract submission by ID.")
    @operationId("getAbstractSubmission")
    @get
    @route("/abstracts/{abstractId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getAbstractSubmission(
      @path abstractId: string
    ): ApiOkResponse<AbstractSubmission>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an abstract submission.")
    @operationId("updateAbstractSubmission")
    @patch(#{implicitOptionality: true})
    @route("/abstracts/{abstractId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    updateAbstractSubmission(
      @path abstractId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<AbstractSubmission>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete an abstract submission.")
    @operationId("deleteAbstractSubmission")
    @delete
    @route("/abstracts/{abstractId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteAbstractSubmission(
      @path abstractId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search abstract submissions with filtering and pagination.")
    @operationId("searchAbstractSubmissions")
    @get
    @route("/abstracts")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchAbstractSubmissions(
      ...AbstractSearchParams
    ): ApiOkResponse<PaginatedResponse<AbstractSubmission>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Record review scores and comments for an abstract.")
    @operationId("reviewAbstractSubmission")
    @post
    @route("/abstracts/{abstractId}/review")
    @extension("x-security-required-roles", #["association:admin", "association:reviewer"])
    reviewAbstractSubmission(
      @path abstractId: string,
      @body body: AbstractReviewRequest
    ): ApiOkResponse<AbstractSubmission>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Accept an abstract for presentation at the conference.")
    @operationId("acceptAbstractSubmission")
    @post
    @route("/abstracts/{abstractId}/accept")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    acceptAbstractSubmission(
      @path abstractId: string
    ): ApiOkResponse<AbstractSubmission>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Reject an abstract submission.")
    @operationId("rejectAbstractSubmission")
    @post
    @route("/abstracts/{abstractId}/reject")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    rejectAbstractSubmission(
      @path abstractId: string
    ): ApiOkResponse<AbstractSubmission>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Exhibitor and sponsor management.
   */
  @useAuth(bearerAuth)
  interface ExhibitorManagement {
    @doc("Create a new exhibitor application.")
    @operationId("createExhibitor")
    @post
    @route("/exhibitors")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:exhibitor"])
    createExhibitor(
      @body body: ExhibitorCreateRequest
    ): ApiCreatedResponse<ExhibitorProfile>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an exhibitor profile by ID.")
    @operationId("getExhibitor")
    @get
    @route("/exhibitors/{exhibitorId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getExhibitor(
      @path exhibitorId: string
    ): ApiOkResponse<ExhibitorProfile>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an exhibitor profile.")
    @operationId("updateExhibitor")
    @patch(#{implicitOptionality: true})
    @route("/exhibitors/{exhibitorId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateExhibitor(
      @path exhibitorId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<ExhibitorProfile>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete an exhibitor profile.")
    @operationId("deleteExhibitor")
    @delete
    @route("/exhibitors/{exhibitorId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteExhibitor(
      @path exhibitorId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search exhibitor profiles with filtering and pagination.")
    @operationId("searchExhibitors")
    @get
    @route("/exhibitors")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchExhibitors(
      ...ExhibitorSearchParams
    ): ApiOkResponse<PaginatedResponse<ExhibitorProfile>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Approve an exhibitor application.")
    @operationId("approveExhibitor")
    @post
    @route("/exhibitors/{exhibitorId}/approve")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    approveExhibitor(
      @path exhibitorId: string
    ): ApiOkResponse<ExhibitorProfile>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }
}
