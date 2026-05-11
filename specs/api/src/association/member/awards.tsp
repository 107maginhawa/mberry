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
 * Association Member Lifecycle — Domains 33-34: Awards, Scholarships & Grants
 *
 * Covers award programs (awards, scholarships, fellowships, grants), nominations,
 * recipient records, disbursement tracking, grant applications, and progress reports.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of award program")
enum AwardProgramType {
  @doc("Honorary award for distinguished contribution or achievement")
  award: "award",

  @doc("Financial award for academic or professional study")
  scholarship: "scholarship",

  @doc("Extended award supporting research or professional development")
  fellowship: "fellowship",

  @doc("Funding award for a specific project or initiative")
  grant: "grant",
}

@doc("Lifecycle status of an award program")
enum AwardProgramStatus {
  @doc("Program is accepting nominations or applications")
  active: "active",

  @doc("Program is temporarily paused")
  suspended: "suspended",

  @doc("Program is permanently retired")
  retired: "retired",
}

@doc("Status of an award nomination")
enum NominationStatus {
  @doc("Nomination has been submitted and is pending review")
  submitted: "submitted",

  @doc("Nomination is under active review")
  underReview: "underReview",

  @doc("Nominee has been shortlisted for selection")
  shortlisted: "shortlisted",

  @doc("Nominee has been selected to receive the award")
  selected: "selected",

  @doc("Nominee was not selected")
  notSelected: "notSelected",

  @doc("Nomination was withdrawn before a decision")
  withdrawn: "withdrawn",
}

@doc("Status of an award disbursement")
enum DisbursementStatus {
  @doc("Disbursement is pending processing")
  pending: "pending",

  @doc("Disbursement has been submitted for payment processing")
  processed: "processed",

  @doc("Payment has been successfully delivered to the recipient")
  completed: "completed",
}

@doc("Lifecycle status of a grant application")
enum GrantStatus {
  @doc("Application is in draft and has not been submitted")
  draft: "draft",

  @doc("Application has been formally submitted")
  submitted: "submitted",

  @doc("Application is under active review")
  underReview: "underReview",

  @doc("Application has been approved for funding consideration")
  approved: "approved",

  @doc("Application was not approved for funding")
  denied: "denied",

  @doc("Grant has been awarded and funds released")
  funded: "funded",

  @doc("Grant project has been completed")
  completed: "completed",

  @doc("Application was withdrawn by the applicant")
  withdrawn: "withdrawn",
}

@doc("Status of a grant progress report")
enum ProgressReportStatus {
  @doc("Report has been submitted by the grantee")
  submitted: "submitted",

  @doc("Report is under review by association staff")
  reviewed: "reviewed",

  @doc("Report has been accepted")
  accepted: "accepted",

  @doc("Revisions have been requested before acceptance")
  revisionsRequested: "revisionsRequested",
}

@doc("Cadence of an award program")
enum AwardCycle {
  @doc("Program runs once per year")
  annual: "annual",

  @doc("Program runs once every two years")
  biennial: "biennial",
}

@doc("Whether the grant applicant is an individual or an organization")
enum GrantApplicantType {
  individual: "individual",
  organization: "organization",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("An award, scholarship, fellowship, or grant program offered by the association")
model AwardProgram extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("Display name of the program")
  @minLength(1)
  @maxLength(150)
  name: string;

  @doc("Type of award program")
  type: AwardProgramType;

  @doc("Description of the program and its purpose")
  @maxLength(5000)
  description?: string;

  @doc("Eligibility criteria for nominees or applicants")
  @maxLength(5000)
  eligibilityCriteria?: string;

  @doc("Whether nominations must be submitted by a third party")
  nominationRequired: boolean;

  @doc("Whether applicants must submit a formal application")
  applicationRequired: boolean;

  @doc("Maximum number of recipients per cycle (null = unlimited)")
  @minValue(1)
  maxRecipients?: int32;

  @doc("Monetary value of the award, scholarship, or grant (null = non-monetary)")
  @minValue(0)
  prizeAmount?: int64;

  @doc("ISO 4217 currency code for the prize amount")
  @minLength(3)
  @maxLength(3)
  currency?: string;

  @doc("How often the program awards recipients")
  cycle: AwardCycle;

  @doc("Lifecycle status of the program")
  status: AwardProgramStatus;
}

@doc("A nomination submitted for an award program")
model AwardNomination extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the award program")
  programId: string;

  @doc("ID of the nominated person")
  nomineeId: string;

  @doc("ID of the person or entity submitting the nomination")
  nominatedBy: string;

  @doc("Timestamp when the nomination was submitted")
  nominatedAt: utcDateTime;

  @doc("Supporting statement accompanying the nomination")
  @maxLength(10000)
  supportingStatement?: string;

  @doc("Current review status of the nomination")
  status: NominationStatus;
}

@doc("A recipient record for an award program cycle")
model AwardRecipient extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the award program")
  programId: string;

  @doc("ID of the nomination that led to this recipient record (null for direct selection)")
  nominationId?: string;

  @doc("ID of the recipient person")
  personId: string;

  @doc("Calendar year in which the award was given")
  @minValue(1900)
  awardYear: int32;

  @doc("Citation or rationale text for the award")
  @maxLength(5000)
  citation?: string;

  @doc("Timestamp of the award presentation")
  presentedAt?: utcDateTime;

  @doc("ID of the person who presented the award")
  presentedBy?: string;

  @doc("Amount disbursed to the recipient (may differ from prizeAmount due to proration)")
  @minValue(0)
  disbursementAmount?: int64;

  @doc("Current status of the prize disbursement")
  disbursementStatus?: DisbursementStatus;
}

@doc("A grant application submitted to an award program")
model GrantApplication extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the grant program this application is for")
  programId: string;

  @doc("ID of the person or organization submitting the application")
  applicantId: string;

  @doc("Whether the applicant is an individual or an organization")
  applicantType: GrantApplicantType;

  @doc("Title of the proposed project or grant purpose")
  @minLength(1)
  @maxLength(200)
  title: string;

  @doc("Short abstract describing the proposed project")
  @minLength(1)
  @maxLength(5000)
  abstract: string;

  @doc("Total proposed budget for the project")
  @minValue(0)
  proposedBudget: int64;

  @doc("Current status of the grant application")
  status: GrantStatus;

  @doc("Timestamp when the application was formally submitted")
  submittedAt?: utcDateTime;

  @doc("Aggregate review score assigned by reviewers")
  @minValue(0)
  @maxValue(100)
  reviewScore?: float64;

  @doc("Actual amount awarded (may differ from proposed budget)")
  @minValue(0)
  awardedAmount?: int64;
}

@doc("A progress report submitted by a grant recipient")
model GrantProgressReport extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the grant application this report corresponds to")
  grantApplicationId: string;

  @doc("Human-readable label for the reporting period (e.g. 'Q1 2026')")
  @minLength(1)
  @maxLength(100)
  reportingPeriod: string;

  @doc("Narrative description of progress made during the reporting period")
  @minLength(1)
  @maxLength(20000)
  narrative: string;

  @doc("Total expenditures during the reporting period")
  @minValue(0)
  expenditures: int64;

  @doc("Milestones achieved during the reporting period")
  milestones?: string[];

  @doc("Current status of this progress report")
  status: ProgressReportStatus;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create or update an award program")
model AwardProgramRequest {
  name: string;
  type: AwardProgramType;
  description?: string;
  eligibilityCriteria?: string;
  nominationRequired: boolean;
  applicationRequired: boolean;
  maxRecipients?: int32;
  prizeAmount?: int64;
  currency?: string;
  cycle: AwardCycle;
  status: AwardProgramStatus;
}

@doc("Request to create an award nomination")
model AwardNominationCreateRequest {
  programId: string;
  nomineeId: string;
  nominatedBy: string;
  supportingStatement?: string;
}

@doc("Request to update an award nomination")
model AwardNominationUpdateRequest {
  supportingStatement?: string | null;
  status?: NominationStatus;
}

@doc("Request to shortlist an award nomination")
model ShortlistRequest {
  @doc("Notes from the review committee")
  @maxLength(2000)
  notes?: string;
}

@doc("Request to select a nominee as an award recipient")
model SelectNomineeRequest {
  @doc("Citation text to accompany the award")
  @maxLength(5000)
  citation?: string;

  @doc("Year in which the award is being given")
  @minValue(1900)
  awardYear: int32;
}

@doc("Request to create or update an award recipient")
model AwardRecipientRequest {
  programId: string;
  nominationId?: string;
  personId: string;
  awardYear: int32;
  citation?: string;
  presentedAt?: utcDateTime;
  presentedBy?: string;
  disbursementAmount?: int64;
}

@doc("Request to trigger prize disbursement for a recipient")
model DisburseRequest {
  @doc("Amount to disburse")
  @minValue(0)
  amount: int64;

  @doc("Reference to the payment transaction or cheque number")
  @maxLength(100)
  paymentReference?: string;
}

@doc("Request to create a grant application")
model GrantApplicationCreateRequest {
  programId: string;
  applicantId: string;
  applicantType: GrantApplicantType;
  title: string;
  abstract: string;
  proposedBudget: int64;
}

@doc("Request to approve a grant application with awarded amount")
model GrantApproveRequest {
  @doc("Amount awarded to the applicant")
  @minValue(0)
  awardedAmount: int64;

  @doc("Notes from the review committee")
  @maxLength(3000)
  notes?: string;
}

@doc("Request to deny a grant application")
model GrantDenyRequest {
  @doc("Reason for denial")
  @minLength(1)
  @maxLength(3000)
  reason?: string;
}

@doc("Request to submit a grant application")
model GrantSubmitRequest {
  @doc("Confirmation that the applicant certifies the information is accurate")
  certificationAccepted: boolean;
}

@doc("Request to create or update a grant progress report")
model GrantProgressReportRequest {
  grantApplicationId: string;
  reportingPeriod: string;
  narrative: string;
  expenditures: int64;
  milestones?: string[];
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/award-programs")
@tag("Association:Member")
namespace Association.Member.Awards {
  @doc("CRUD and search for award programs")
  interface AwardProgramManagement {
    @doc("Create an award program.")
    @operationId("createAwardProgram")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createAwardProgram(
      @body body: AwardProgramRequest
    ): ApiCreatedResponse<AwardProgram>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an award program by ID.")
    @operationId("getAwardProgram")
    @get
    @route("/{programId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getAwardProgram(
      @path programId: string
    ): ApiOkResponse<AwardProgram>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List award programs.")
    @operationId("listAwardPrograms")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listAwardPrograms(
      ...PaginationQuery,
      @query type?: AwardProgramType,
      @query status?: AwardProgramStatus
    ): ApiOkResponse<PaginatedResponse<AwardProgram>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an award program.")
    @operationId("updateAwardProgram")
    @patch(#{implicitOptionality: true})
    @route("/{programId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateAwardProgram(
      @path programId: string,
      @body updates: AwardProgramRequest
    ): ApiOkResponse<AwardProgram>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete an award program.")
    @operationId("deleteAwardProgram")
    @delete
    @route("/{programId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteAwardProgram(
      @path programId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, shortlisting, and selection of award nominations")
  @route("/association/member/award-nominations")
  interface AwardNominationManagement {
    @doc("Submit a nomination.")
    @operationId("createAwardNomination")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member", "association:admin"])
    createAwardNomination(
      @body body: AwardNominationCreateRequest
    ): ApiCreatedResponse<AwardNomination>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a nomination by ID.")
    @operationId("getAwardNomination")
    @get
    @route("/{nominationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getAwardNomination(
      @path nominationId: string
    ): ApiOkResponse<AwardNomination>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List nominations with optional filters.")
    @operationId("listAwardNominations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listAwardNominations(
      ...PaginationQuery,
      @query programId?: string,
      @query nomineeId?: string,
      @query status?: NominationStatus
    ): ApiOkResponse<PaginatedResponse<AwardNomination>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a nomination.")
    @operationId("updateAwardNomination")
    @patch(#{implicitOptionality: true})
    @route("/{nominationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateAwardNomination(
      @path nominationId: string,
      @body updates: AwardNominationUpdateRequest
    ): ApiOkResponse<AwardNomination>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a nomination.")
    @operationId("deleteAwardNomination")
    @delete
    @route("/{nominationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteAwardNomination(
      @path nominationId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Move a nomination to shortlisted status.")
    @operationId("shortlistAwardNomination")
    @post
    @route("/{nominationId}/shortlist")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    shortlistAwardNomination(
      @path nominationId: string,
      @body body: ShortlistRequest
    ): ApiOkResponse<AwardNomination>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Select a nominee as an award recipient.")
    @operationId("selectAwardNominee")
    @post
    @route("/{nominationId}/select")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    selectAwardNominee(
      @path nominationId: string,
      @body body: SelectNomineeRequest
    ): ApiOkResponse<AwardRecipient>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and disbursement for award recipients")
  @route("/association/member/award-recipients")
  interface AwardRecipientManagement {
    @doc("Create an award recipient record.")
    @operationId("createAwardRecipient")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createAwardRecipient(
      @body body: AwardRecipientRequest
    ): ApiCreatedResponse<AwardRecipient>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an award recipient record by ID.")
    @operationId("getAwardRecipient")
    @get
    @route("/{recipientId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getAwardRecipient(
      @path recipientId: string
    ): ApiOkResponse<AwardRecipient>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List award recipients.")
    @operationId("listAwardRecipients")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listAwardRecipients(
      ...PaginationQuery,
      @query programId?: string,
      @query awardYear?: int32,
      @query disbursementStatus?: DisbursementStatus
    ): ApiOkResponse<PaginatedResponse<AwardRecipient>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an award recipient record.")
    @operationId("updateAwardRecipient")
    @patch(#{implicitOptionality: true})
    @route("/{recipientId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateAwardRecipient(
      @path recipientId: string,
      @body updates: AwardRecipientRequest
    ): ApiOkResponse<AwardRecipient>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete an award recipient record.")
    @operationId("deleteAwardRecipient")
    @delete
    @route("/{recipientId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteAwardRecipient(
      @path recipientId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Trigger prize disbursement for an award recipient.")
    @operationId("disburseAwardPrize")
    @post
    @route("/{recipientId}/disburse")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    disburseAwardPrize(
      @path recipientId: string,
      @body body: DisburseRequest
    ): ApiOkResponse<AwardRecipient>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, submission, approval, and denial of grant applications")
  @route("/association/member/grant-applications")
  interface GrantApplicationManagement {
    @doc("Create a grant application.")
    @operationId("createGrantApplication")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member", "association:admin"])
    createGrantApplication(
      @body body: GrantApplicationCreateRequest
    ): ApiCreatedResponse<GrantApplication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a grant application by ID.")
    @operationId("getGrantApplication")
    @get
    @route("/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getGrantApplication(
      @path applicationId: string
    ): ApiOkResponse<GrantApplication>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List grant applications.")
    @operationId("listGrantApplications")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listGrantApplications(
      ...PaginationQuery,
      @query programId?: string,
      @query applicantId?: string,
      @query status?: GrantStatus
    ): ApiOkResponse<PaginatedResponse<GrantApplication>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a draft grant application.")
    @operationId("updateGrantApplication")
    @patch(#{implicitOptionality: true})
    @route("/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    updateGrantApplication(
      @path applicationId: string,
      @body updates: GrantApplicationCreateRequest
    ): ApiOkResponse<GrantApplication>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Delete a grant application.")
    @operationId("deleteGrantApplication")
    @delete
    @route("/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteGrantApplication(
      @path applicationId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Formally submit a grant application for review.")
    @operationId("submitGrantApplication")
    @post
    @route("/{applicationId}/submit")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    submitGrantApplication(
      @path applicationId: string,
      @body body: GrantSubmitRequest
    ): ApiOkResponse<GrantApplication>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Approve a grant application.")
    @operationId("approveGrantApplication")
    @post
    @route("/{applicationId}/approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    approveGrantApplication(
      @path applicationId: string,
      @body body: GrantApproveRequest
    ): ApiOkResponse<GrantApplication>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Deny a grant application.")
    @operationId("denyGrantApplication")
    @post
    @route("/{applicationId}/deny")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    denyGrantApplication(
      @path applicationId: string,
      @body body: GrantDenyRequest
    ): ApiOkResponse<GrantApplication>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD and search for grant progress reports")
  @route("/association/member/grant-progress-reports")
  interface GrantProgressReportManagement {
    @doc("Submit a grant progress report.")
    @operationId("createGrantProgressReport")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    createGrantProgressReport(
      @body body: GrantProgressReportRequest
    ): ApiCreatedResponse<GrantProgressReport>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a progress report by ID.")
    @operationId("getGrantProgressReport")
    @get
    @route("/{reportId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getGrantProgressReport(
      @path reportId: string
    ): ApiOkResponse<GrantProgressReport>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List progress reports.")
    @operationId("listGrantProgressReports")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listGrantProgressReports(
      ...PaginationQuery,
      @query grantApplicationId?: string,
      @query status?: ProgressReportStatus
    ): ApiOkResponse<PaginatedResponse<GrantProgressReport>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a progress report.")
    @operationId("updateGrantProgressReport")
    @patch(#{implicitOptionality: true})
    @route("/{reportId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    updateGrantProgressReport(
      @path reportId: string,
      @body updates: GrantProgressReportRequest
    ): ApiOkResponse<GrantProgressReport>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a progress report.")
    @operationId("deleteGrantProgressReport")
    @delete
    @route("/{reportId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteGrantProgressReport(
      @path reportId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }
}
