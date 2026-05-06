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
 * Association Member Lifecycle — Domains 22-25: Elections, Officers, Committees & Board
 *
 * Covers elected positions, elections, candidacies, ballots, officer terms,
 * committees, committee seats, meetings, motions, minutes, board meetings,
 * and board resolutions.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Organizational level at which a position exists")
enum PositionLevel {
  national: "national",
  regional: "regional",
  chapter: "chapter",
}

@doc("Lifecycle status of an election")
enum ElectionStatus {
  draft: "draft",
  nominationOpen: "nominationOpen",
  nominationClosed: "nominationClosed",
  votingOpen: "votingOpen",
  votingClosed: "votingClosed",
  certified: "certified",
  cancelled: "cancelled",
}

@doc("Type of election")
enum ElectionType {
  general: "general",
  special: "special",
  byElection: "byElection",
}

@doc("Status of a nomination/candidacy")
enum CandidateStatus {
  nominated: "nominated",
  accepted: "accepted",
  declined: "declined",
  withdrawn: "withdrawn",
  elected: "elected",
  notElected: "notElected",
}

@doc("Status of an officer term")
enum TermStatus {
  upcoming: "upcoming",
  active: "active",
  completed: "completed",
  resigned: "resigned",
  removed: "removed",
}

@doc("Type of committee")
enum CommitteeType {
  standing: "standing",
  adhoc: "adhoc",
  taskForce: "taskForce",
}

@doc("Role of a person on a committee")
enum CommitteeSeatRole {
  chair: "chair",
  viceChair: "viceChair",
  member: "member",
  secretary: "secretary",
}

@doc("Status of a committee seat")
enum CommitteeSeatStatus {
  active: "active",
  resigned: "resigned",
  removed: "removed",
}

@doc("Status of a committee or board meeting")
enum MeetingStatus {
  scheduled: "scheduled",
  inProgress: "inProgress",
  completed: "completed",
  cancelled: "cancelled",
}

@doc("Status of a motion introduced in a committee meeting")
enum MotionStatus {
  introduced: "introduced",
  seconded: "seconded",
  tabled: "tabled",
  votedOn: "votedOn",
  passed: "passed",
  failed: "failed",
  withdrawn: "withdrawn",
}

@doc("Status of meeting minutes")
enum MinutesStatus {
  draft: "draft",
  submitted: "submitted",
  approved: "approved",
}

@doc("Type of board meeting")
enum BoardMeetingType {
  regular: "regular",
  special: "special",
  annual: "annual",
  emergency: "emergency",
}

@doc("Status of a board resolution")
enum ResolutionStatus {
  proposed: "proposed",
  discussed: "discussed",
  adopted: "adopted",
  rejected: "rejected",
  tabled: "tabled",
}

@doc("Lifecycle status of a committee")
enum CommitteeStatus {
  active: "active",
  suspended: "suspended",
  dissolved: "dissolved",
}

@doc("Lifecycle status of a position")
enum PositionStatus {
  active: "active",
  vacant: "vacant",
  retired: "retired",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("An elected or appointed position within the association hierarchy")
model Position extends BaseEntity {

  @doc("Official title of the position")
  @minLength(1)
  @maxLength(100)
  title: string;

  @doc("ID of the organization this position belongs to")
  organizationId: string;

  @doc("Organizational level of this position")
  level: PositionLevel;

  @doc("Duration of one term in months")
  @minValue(1)
  termLengthMonths: int32;

  @doc("Maximum number of consecutive terms allowed (null = unlimited)")
  @minValue(1)
  maxConsecutiveTerms?: int32;

  @doc("Description of the position's purpose")
  @maxLength(2000)
  description?: string;

  @doc("List of responsibilities associated with this position")
  responsibilities?: string[];

  @doc("Lifecycle status of the position")
  status: PositionStatus;
}

@doc("An election event for one or more positions")
model Election extends BaseEntity {

  @doc("ID of the organization running the election")
  organizationId: string;

  @doc("Display title of the election")
  @minLength(1)
  @maxLength(200)
  title: string;

  @doc("Type of election")
  electionType: ElectionType;

  @doc("IDs of positions open in this election")
  positions: string[];

  @doc("Start of the nomination period")
  nominationStart: utcDateTime;

  @doc("End of the nomination period")
  nominationEnd: utcDateTime;

  @doc("Start of the voting period")
  votingStart: utcDateTime;

  @doc("End of the voting period")
  votingEnd: utcDateTime;

  @doc("Current status of the election")
  status: ElectionStatus;

  @doc("Minimum number of votes required for the election results to be valid")
  @minValue(1)
  quorumRequired?: int32;

  @doc("Whether quorum was met when voting closed")
  quorumMet?: boolean;
}

@doc("A candidate nominated for a position in an election")
model Candidate extends BaseEntity {

  @doc("ID of the election this candidacy belongs to")
  electionId: string;

  @doc("ID of the position the candidate is seeking")
  positionId: string;

  @doc("ID of the person standing as candidate")
  personId: string;

  @doc("ID of the person or group that nominated this candidate")
  nominatedBy: string;

  @doc("Timestamp of nomination")
  nominatedAt: utcDateTime;

  @doc("Current status of this candidacy")
  status: CandidateStatus;

  @doc("Candidate biography")
  @maxLength(5000)
  bio?: string;

  @doc("Candidate's platform statement")
  @maxLength(5000)
  platform?: string;
}

@doc("A single ballot cast by a voter in an election")
model Ballot extends BaseEntity {

  @doc("ID of the election this ballot was cast in")
  electionId: string;

  @doc("ID of the member who cast the ballot")
  voterId: string;

  @doc("ID of the position being voted on")
  positionId: string;

  @doc("ID of the candidate selected")
  candidateId: string;

  @doc("Timestamp when the ballot was cast")
  castAt: utcDateTime;

  @doc("Whether this ballot was cast by a proxy voter")
  isProxy: boolean;

  @doc("ID of the member on whose behalf the proxy voted")
  proxyFor?: string;

  @doc("Hash used to verify ballot integrity without revealing voter identity")
  @maxLength(128)
  verificationHash?: string;
}

@doc("A term served by a person in an elected or appointed position")
model OfficerTerm extends BaseEntity {

  @doc("ID of the position held")
  positionId: string;

  @doc("ID of the officer")
  personId: string;

  @doc("ID of the organization")
  organizationId: string;

  @doc("First day of the term")
  startDate: plainDate;

  @doc("Last day of the term")
  endDate: plainDate;

  @doc("Current status of the term")
  status: TermStatus;

  @doc("ID of the person or body that appointed this officer")
  appointedBy?: string;

  @doc("Timestamp of formal inauguration or swearing-in")
  inauguratedAt?: utcDateTime;
}

@doc("A standing or ad-hoc committee of the association")
model Committee extends BaseEntity {

  @doc("Display name of the committee")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("ID of the organization this committee belongs to")
  organizationId: string;

  @doc("Type of committee")
  type: CommitteeType;

  @doc("ID of the current chair")
  chairId?: string;

  @doc("Statement of the committee's mandate")
  @maxLength(2000)
  purpose?: string;

  @doc("Maximum number of seats on the committee")
  @minValue(1)
  maxMembers?: int32;

  @doc("Lifecycle status of the committee")
  status: CommitteeStatus;
}

@doc("A seat held by a person on a committee")
model CommitteeSeat extends BaseEntity {

  @doc("ID of the committee")
  committeeId: string;

  @doc("ID of the person holding the seat")
  personId: string;

  @doc("Role of this person on the committee")
  role: CommitteeSeatRole;

  @doc("Timestamp when the person joined the committee")
  joinedAt: utcDateTime;

  @doc("Timestamp when the person left the committee")
  leftAt?: utcDateTime;

  @doc("Current status of the seat")
  status: CommitteeSeatStatus;
}

@doc("A scheduled or completed committee meeting")
model CommitteeMeeting extends BaseEntity {

  @doc("ID of the committee holding the meeting")
  committeeId: string;

  @doc("Date and time the meeting is scheduled")
  scheduledDate: utcDateTime;

  @doc("Physical or virtual location of the meeting")
  @maxLength(200)
  location?: string;

  @doc("Meeting agenda")
  @maxLength(10000)
  agenda?: string;

  @doc("Current status of the meeting")
  status: MeetingStatus;
}

@doc("A motion introduced during a committee meeting")
model Motion extends BaseEntity {

  @doc("ID of the meeting in which the motion was introduced")
  meetingId: string;

  @doc("ID of the person who moved the motion")
  movedBy: string;

  @doc("ID of the person who seconded the motion")
  secondedBy?: string;

  @doc("Full text of the motion")
  @minLength(1)
  @maxLength(5000)
  text: string;

  @doc("Current status of the motion")
  status: MotionStatus;
}

@doc("Approved minutes documenting what occurred at a committee meeting")
model MeetingMinutes extends BaseEntity {

  @doc("ID of the meeting these minutes document")
  meetingId: string;

  @doc("Full content of the meeting minutes")
  @minLength(1)
  content: string;

  @doc("ID of the person who prepared the minutes")
  preparedBy: string;

  @doc("ID of the person who formally approved the minutes")
  approvedBy?: string;

  @doc("Timestamp of formal approval")
  approvedAt?: utcDateTime;

  @doc("Approval status of the minutes")
  status: MinutesStatus;
}

@doc("A board-level meeting of the association's governing body")
model BoardMeeting extends BaseEntity {

  @doc("ID of the organization whose board is meeting")
  organizationId: string;

  @doc("Date and time the board meeting is scheduled")
  scheduledDate: utcDateTime;

  @doc("Type of board meeting")
  type: BoardMeetingType;

  @doc("Meeting agenda")
  @maxLength(10000)
  agenda?: string;

  @doc("Current status of the meeting")
  status: MeetingStatus;

  @doc("Whether quorum was present when the meeting was called to order")
  quorumPresent?: boolean;
}

@doc("A formal resolution adopted (or considered) by the board")
model BoardResolution extends BaseEntity {

  @doc("ID of the board meeting at which this resolution was presented")
  boardMeetingId: string;

  @doc("Sequential resolution number within the organization")
  @minLength(1)
  @maxLength(50)
  resolutionNumber: string;

  @doc("Short title of the resolution")
  @minLength(1)
  @maxLength(200)
  title: string;

  @doc("Full text of the resolution")
  @minLength(1)
  text: string;

  @doc("ID of the board member who proposed the resolution")
  proposedBy: string;

  @doc("Current status of the resolution")
  status: ResolutionStatus;

  @doc("Timestamp when the vote was taken")
  votedAt?: utcDateTime;

  @doc("Number of votes in favour")
  @minValue(0)
  votesFor?: int32;

  @doc("Number of votes against")
  @minValue(0)
  votesAgainst?: int32;

  @doc("Number of abstentions")
  @minValue(0)
  abstentions?: int32;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create or update a position")
model PositionRequest {
  title: string;
  organizationId: string;
  level: PositionLevel;
  termLengthMonths: int32;
  maxConsecutiveTerms?: int32;
  description?: string;
  responsibilities?: string[];
  status: PositionStatus;
}

@doc("Request to create an election")
model ElectionCreateRequest {
  organizationId: string;
  title: string;
  electionType: ElectionType;
  positions: string[];
  nominationStart: utcDateTime;
  nominationEnd: utcDateTime;
  votingStart: utcDateTime;
  votingEnd: utcDateTime;
  quorumRequired?: int32;
}

@doc("Request to create or update a candidate")
model CandidateRequest {
  electionId: string;
  positionId: string;
  personId: string;
  nominatedBy: string;
  bio?: string;
  platform?: string;
}

@doc("Request to cast a ballot")
model CastBallotRequest {
  electionId: string;
  positionId: string;
  candidateId: string;
  isProxy: boolean;
  proxyFor?: string;
}

@doc("Request to record or update an officer term")
model OfficerTermRequest {
  positionId: string;
  personId: string;
  organizationId: string;
  startDate: plainDate;
  endDate: plainDate;
  appointedBy?: string;
}

@doc("Request to create or update a committee")
model CommitteeRequest {
  name: string;
  organizationId: string;
  type: CommitteeType;
  chairId?: string;
  purpose?: string;
  maxMembers?: int32;
  status: CommitteeStatus;
}

@doc("Request to create or update a committee seat")
model CommitteeSeatRequest {
  committeeId: string;
  personId: string;
  role: CommitteeSeatRole;
  joinedAt: utcDateTime;
}

@doc("Request to create or update a committee meeting")
model CommitteeMeetingRequest {
  committeeId: string;
  scheduledDate: utcDateTime;
  location?: string;
  agenda?: string;
}

@doc("Request to create or update a motion")
model MotionRequest {
  meetingId: string;
  movedBy: string;
  secondedBy?: string;
  text: string;
}

@doc("Request to vote on a motion")
model MotionVoteRequest {
  @doc("Vote outcome after voting")
  outcome: "passed" | "failed";

  @doc("Number of votes in favour")
  @minValue(0)
  votesFor: int32;

  @doc("Number of votes against")
  @minValue(0)
  votesAgainst: int32;

  @doc("Number of abstentions")
  @minValue(0)
  abstentions: int32;
}

@doc("Request to create or update meeting minutes")
model MeetingMinutesRequest {
  meetingId: string;
  content: string;
  preparedBy: string;
}

@doc("Request to create or update a board meeting")
model BoardMeetingRequest {
  organizationId: string;
  scheduledDate: utcDateTime;
  type: BoardMeetingType;
  agenda?: string;
}

@doc("Request to create or update a board resolution")
model BoardResolutionRequest {
  boardMeetingId: string;
  resolutionNumber: string;
  title: string;
  text: string;
  proposedBy: string;
}

@doc("Request to adopt a board resolution with vote tallies")
model AdoptResolutionRequest {
  votesFor: int32;
  votesAgainst: int32;
  abstentions: int32;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/positions")
@tag("Association:Member")
namespace Association.Member.Governance {
  @doc("CRUD for elected and appointed positions")
  interface PositionManagement {
    @doc("Create a new position.")
    @operationId("createPosition")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createPosition(@body body: PositionRequest): ApiCreatedResponse<Position> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a position by ID.")
    @operationId("getPosition")
    @get
    @route("/{positionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getPosition(@path positionId: string): ApiOkResponse<Position> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List positions.")
    @operationId("listPositions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listPositions(...PaginationQuery, @query organizationId?: string, @query level?: PositionLevel): ApiOkResponse<PaginatedResponse<Position>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a position.")
    @operationId("updatePosition")
    @patch(#{implicitOptionality: true})
    @route("/{positionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updatePosition(@path positionId: string, @body updates: PositionRequest): ApiOkResponse<Position> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a position.")
    @operationId("deletePosition")
    @delete
    @route("/{positionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deletePosition(@path positionId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and election lifecycle management")
  @route("/association/member/elections")
  interface ElectionManagement {
    @doc("Create an election.")
    @operationId("createElection")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createElection(@body body: ElectionCreateRequest): ApiCreatedResponse<Election> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get an election by ID.")
    @operationId("getElection")
    @get
    @route("/{electionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getElection(@path electionId: string): ApiOkResponse<Election> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List elections.")
    @operationId("listElections")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listElections(...PaginationQuery, @query organizationId?: string, @query status?: ElectionStatus): ApiOkResponse<PaginatedResponse<Election>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update an election.")
    @operationId("updateElection")
    @patch(#{implicitOptionality: true})
    @route("/{electionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateElection(@path electionId: string, @body updates: ElectionCreateRequest): ApiOkResponse<Election> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete an election.")
    @operationId("deleteElection")
    @delete
    @route("/{electionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteElection(@path electionId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;

    @doc("Open the nomination period for an election.")
    @operationId("openElectionNominations")
    @post
    @route("/{electionId}/open-nominations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    openElectionNominations(@path electionId: string): ApiOkResponse<Election> | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;

    @doc("Open the voting period for an election.")
    @operationId("openElectionVoting")
    @post
    @route("/{electionId}/open-voting")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    openElectionVoting(@path electionId: string): ApiOkResponse<Election> | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;

    @doc("Certify the results of an election after voting closes.")
    @operationId("certifyElection")
    @post
    @route("/{electionId}/certify")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    certifyElection(@path electionId: string): ApiOkResponse<Election> | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and search for election candidates")
  @route("/association/member/candidates")
  interface CandidateManagement {
    @doc("Create a candidate record.")
    @operationId("createCandidate")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    createCandidate(@body body: CandidateRequest): ApiCreatedResponse<Candidate> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a candidate by ID.")
    @operationId("getCandidate")
    @get
    @route("/{candidateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getCandidate(@path candidateId: string): ApiOkResponse<Candidate> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List candidates.")
    @operationId("listCandidates")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listCandidates(...PaginationQuery, @query electionId?: string, @query positionId?: string): ApiOkResponse<PaginatedResponse<Candidate>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a candidate record.")
    @operationId("updateCandidate")
    @patch(#{implicitOptionality: true})
    @route("/{candidateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCandidate(@path candidateId: string, @body updates: CandidateRequest): ApiOkResponse<Candidate> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a candidate record.")
    @operationId("deleteCandidate")
    @delete
    @route("/{candidateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCandidate(@path candidateId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("Cast and search ballots — no update or delete permitted after casting")
  @route("/association/member/ballots")
  interface BallotManagement {
    @doc("Cast a ballot in an election.")
    @operationId("castBallot")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    castBallot(@body body: CastBallotRequest): ApiCreatedResponse<Ballot> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse;

    @doc("Search ballots (admin only — individual ballots are anonymized).")
    @operationId("listBallots")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listBallots(...PaginationQuery, @query electionId?: string, @query positionId?: string): ApiOkResponse<PaginatedResponse<Ballot>> | ApiUnauthorizedResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and search for officer terms")
  @route("/association/member/officer-terms")
  interface OfficerTermManagement {
    @doc("Create an officer term.")
    @operationId("createOfficerTerm")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createOfficerTerm(@body body: OfficerTermRequest): ApiCreatedResponse<OfficerTerm> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get an officer term by ID.")
    @operationId("getOfficerTerm")
    @get
    @route("/{termId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getOfficerTerm(@path termId: string): ApiOkResponse<OfficerTerm> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List officer terms.")
    @operationId("listOfficerTerms")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listOfficerTerms(...PaginationQuery, @query organizationId?: string, @query personId?: string, @query status?: TermStatus): ApiOkResponse<PaginatedResponse<OfficerTerm>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update an officer term.")
    @operationId("updateOfficerTerm")
    @patch(#{implicitOptionality: true})
    @route("/{termId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateOfficerTerm(@path termId: string, @body updates: OfficerTermRequest): ApiOkResponse<OfficerTerm> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete an officer term.")
    @operationId("deleteOfficerTerm")
    @delete
    @route("/{termId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteOfficerTerm(@path termId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and search for committees")
  @route("/association/member/committees")
  interface CommitteeManagement {
    @doc("Create a committee.")
    @operationId("createCommittee")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCommittee(@body body: CommitteeRequest): ApiCreatedResponse<Committee> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a committee by ID.")
    @operationId("getCommittee")
    @get
    @route("/{committeeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getCommittee(@path committeeId: string): ApiOkResponse<Committee> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List committees.")
    @operationId("listCommittees")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listCommittees(...PaginationQuery, @query organizationId?: string, @query type?: CommitteeType): ApiOkResponse<PaginatedResponse<Committee>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a committee.")
    @operationId("updateCommittee")
    @patch(#{implicitOptionality: true})
    @route("/{committeeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCommittee(@path committeeId: string, @body updates: CommitteeRequest): ApiOkResponse<Committee> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a committee.")
    @operationId("deleteCommittee")
    @delete
    @route("/{committeeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCommittee(@path committeeId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD for committee seats")
  @route("/association/member/committee-seats")
  interface CommitteeSeatManagement {
    @doc("Add a person to a committee.")
    @operationId("createCommitteeSeat")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCommitteeSeat(@body body: CommitteeSeatRequest): ApiCreatedResponse<CommitteeSeat> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse;

    @doc("Get a committee seat by ID.")
    @operationId("getCommitteeSeat")
    @get
    @route("/{seatId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getCommitteeSeat(@path seatId: string): ApiOkResponse<CommitteeSeat> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a committee seat.")
    @operationId("updateCommitteeSeat")
    @patch(#{implicitOptionality: true})
    @route("/{seatId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCommitteeSeat(@path seatId: string, @body updates: CommitteeSeatRequest): ApiOkResponse<CommitteeSeat> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Remove a person from a committee.")
    @operationId("deleteCommitteeSeat")
    @delete
    @route("/{seatId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCommitteeSeat(@path seatId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and search for committee meetings")
  @route("/association/member/committee-meetings")
  interface CommitteeMeetingManagement {
    @doc("Create a committee meeting.")
    @operationId("createCommitteeMeeting")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:chair"])
    createCommitteeMeeting(@body body: CommitteeMeetingRequest): ApiCreatedResponse<CommitteeMeeting> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a committee meeting by ID.")
    @operationId("getCommitteeMeeting")
    @get
    @route("/{meetingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    getCommitteeMeeting(@path meetingId: string): ApiOkResponse<CommitteeMeeting> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List committee meetings.")
    @operationId("listCommitteeMeetings")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    listCommitteeMeetings(...PaginationQuery, @query committeeId?: string, @query status?: MeetingStatus): ApiOkResponse<PaginatedResponse<CommitteeMeeting>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a committee meeting.")
    @operationId("updateCommitteeMeeting")
    @patch(#{implicitOptionality: true})
    @route("/{meetingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:chair"])
    updateCommitteeMeeting(@path meetingId: string, @body updates: CommitteeMeetingRequest): ApiOkResponse<CommitteeMeeting> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a committee meeting.")
    @operationId("deleteCommitteeMeeting")
    @delete
    @route("/{meetingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCommitteeMeeting(@path meetingId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and voting for motions introduced at committee meetings")
  @route("/association/member/motions")
  interface MotionManagement {
    @doc("Introduce a motion.")
    @operationId("createMotion")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    createMotion(@body body: MotionRequest): ApiCreatedResponse<Motion> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a motion by ID.")
    @operationId("getMotion")
    @get
    @route("/{motionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    getMotion(@path motionId: string): ApiOkResponse<Motion> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List motions.")
    @operationId("listMotions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    listMotions(...PaginationQuery, @query meetingId?: string, @query status?: MotionStatus): ApiOkResponse<PaginatedResponse<Motion>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a motion.")
    @operationId("updateMotion")
    @patch(#{implicitOptionality: true})
    @route("/{motionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:chair"])
    updateMotion(@path motionId: string, @body updates: MotionRequest): ApiOkResponse<Motion> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a motion.")
    @operationId("deleteMotion")
    @delete
    @route("/{motionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteMotion(@path motionId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Record the outcome of a vote on a motion.")
    @operationId("voteOnMotion")
    @post
    @route("/{motionId}/vote")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:chair"])
    voteOnMotion(@path motionId: string, @body body: MotionVoteRequest): ApiOkResponse<Motion> | ApiBadRequestResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and approval workflow for committee meeting minutes")
  @route("/association/member/meeting-minutes")
  interface MeetingMinutesManagement {
    @doc("Create meeting minutes.")
    @operationId("createMeetingMinutes")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:secretary"])
    createMeetingMinutes(@body body: MeetingMinutesRequest): ApiCreatedResponse<MeetingMinutes> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get meeting minutes by ID.")
    @operationId("getMeetingMinutes")
    @get
    @route("/{minutesId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    getMeetingMinutes(@path minutesId: string): ApiOkResponse<MeetingMinutes> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List meeting minutes.")
    @operationId("listMeetingMinutes")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:member"])
    listMeetingMinutes(...PaginationQuery, @query meetingId?: string, @query status?: MinutesStatus): ApiOkResponse<PaginatedResponse<MeetingMinutes>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update meeting minutes.")
    @operationId("updateMeetingMinutes")
    @patch(#{implicitOptionality: true})
    @route("/{minutesId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:secretary"])
    updateMeetingMinutes(@path minutesId: string, @body updates: MeetingMinutesRequest): ApiOkResponse<MeetingMinutes> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete meeting minutes.")
    @operationId("deleteMeetingMinutes")
    @delete
    @route("/{minutesId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteMeetingMinutes(@path minutesId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Approve meeting minutes.")
    @operationId("approveMeetingMinutes")
    @post
    @route("/{minutesId}/approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "committee:chair"])
    approveMeetingMinutes(@path minutesId: string, @query approvedBy: string): ApiOkResponse<MeetingMinutes> | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD and search for board meetings")
  @route("/association/member/board-meetings")
  interface BoardMeetingManagement {
    @doc("Create a board meeting.")
    @operationId("createBoardMeeting")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createBoardMeeting(@body body: BoardMeetingRequest): ApiCreatedResponse<BoardMeeting> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a board meeting by ID.")
    @operationId("getBoardMeeting")
    @get
    @route("/{boardMeetingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:board"])
    getBoardMeeting(@path boardMeetingId: string): ApiOkResponse<BoardMeeting> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List board meetings.")
    @operationId("listBoardMeetings")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:board"])
    listBoardMeetings(...PaginationQuery, @query organizationId?: string, @query status?: MeetingStatus): ApiOkResponse<PaginatedResponse<BoardMeeting>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a board meeting.")
    @operationId("updateBoardMeeting")
    @patch(#{implicitOptionality: true})
    @route("/{boardMeetingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateBoardMeeting(@path boardMeetingId: string, @body updates: BoardMeetingRequest): ApiOkResponse<BoardMeeting> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a board meeting.")
    @operationId("deleteBoardMeeting")
    @delete
    @route("/{boardMeetingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteBoardMeeting(@path boardMeetingId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and adoption of board resolutions")
  @route("/association/member/board-resolutions")
  interface BoardResolutionManagement {
    @doc("Create a board resolution.")
    @operationId("createBoardResolution")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:board"])
    createBoardResolution(@body body: BoardResolutionRequest): ApiCreatedResponse<BoardResolution> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get a board resolution by ID.")
    @operationId("getBoardResolution")
    @get
    @route("/{resolutionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:board"])
    getBoardResolution(@path resolutionId: string): ApiOkResponse<BoardResolution> | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("List board resolutions.")
    @operationId("listBoardResolutions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:board"])
    listBoardResolutions(...PaginationQuery, @query boardMeetingId?: string, @query status?: ResolutionStatus): ApiOkResponse<PaginatedResponse<BoardResolution>> | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Update a board resolution.")
    @operationId("updateBoardResolution")
    @patch(#{implicitOptionality: true})
    @route("/{resolutionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateBoardResolution(@path resolutionId: string, @body updates: BoardResolutionRequest): ApiOkResponse<BoardResolution> | ApiBadRequestResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Delete a board resolution.")
    @operationId("deleteBoardResolution")
    @delete
    @route("/{resolutionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteBoardResolution(@path resolutionId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiForbiddenResponse;

    @doc("Adopt a board resolution with vote tallies.")
    @operationId("adoptBoardResolution")
    @post
    @route("/{resolutionId}/adopt")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    adoptBoardResolution(@path resolutionId: string, @body body: AdoptResolutionRequest): ApiOkResponse<BoardResolution> | ApiBadRequestResponse | ApiNotFoundResponse | ApiConflictResponse | ApiForbiddenResponse;
  }
}
