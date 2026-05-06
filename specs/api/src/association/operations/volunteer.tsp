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
 * Domains 44-46: Volunteers, Job Board & Mentorship
 *
 * Covers volunteer opportunity and hours management, a member-facing job board,
 * and structured mentorship programme pairing.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Status of a volunteer opportunity posting")
enum VolunteerOpportunityStatus {
  @doc("Open and accepting applications")
  open: "open",

  @doc("All spots have been filled")
  filled: "filled",

  @doc("Opportunity is closed to new applications")
  closed: "closed",

  @doc("Opportunity has been cancelled")
  cancelled: "cancelled",
}

@doc("Status of an individual volunteer application")
enum VolApplicationStatus {
  @doc("Application submitted and under review")
  applied: "applied",

  @doc("Application has been accepted")
  accepted: "accepted",

  @doc("Application was not accepted")
  declined: "declined",

  @doc("Applicant withdrew their application")
  withdrawn: "withdrawn",

  @doc("Volunteer completed the opportunity")
  completed: "completed",
}

@doc("Status of a volunteer hours log entry")
enum VolunteerHoursStatus {
  @doc("Hours have been logged by the volunteer")
  logged: "logged",

  @doc("Hours have been reviewed and approved")
  approved: "approved",

  @doc("Hours were rejected during review")
  rejected: "rejected",
}

@doc("Employment type for a job posting")
enum JobPostingType {
  @doc("Full-time permanent position")
  fullTime: "full_time",

  @doc("Part-time position")
  partTime: "part_time",

  @doc("Contract or consulting engagement")
  contract: "contract",

  @doc("Fellowship or research position")
  fellowship: "fellowship",

  @doc("Student or graduate internship")
  internship: "internship",
}

@doc("Status of a job posting")
enum JobPostingStatus {
  @doc("Draft — not yet visible to members")
  draft: "draft",

  @doc("Active and accepting applications")
  active: "active",

  @doc("Position has been filled")
  filled: "filled",

  @doc("Listing has expired")
  expired: "expired",

  @doc("Listing was manually closed")
  closed: "closed",
}

@doc("Status of a job application")
enum JobApplicationStatus {
  @doc("Application submitted")
  applied: "applied",

  @doc("Applicant is being screened")
  screening: "screening",

  @doc("Applicant has been interviewed")
  interviewed: "interviewed",

  @doc("Offer has been extended to the applicant")
  offered: "offered",

  @doc("Applicant has accepted and been hired")
  hired: "hired",

  @doc("Application was not selected")
  rejected: "rejected",

  @doc("Applicant withdrew their application")
  withdrawn: "withdrawn",
}

@doc("Status of a mentorship programme")
enum MentorshipProgramStatus {
  @doc("Programme is open for mentor and mentee enrolment")
  enrolling: "enrolling",

  @doc("Programme is active and pairs are meeting")
  active: "active",

  @doc("Programme cycle has completed")
  completed: "completed",

  @doc("Programme has been temporarily suspended")
  suspended: "suspended",
}

@doc("Status of a mentor-mentee pair")
enum PairStatus {
  @doc("Match has been proposed but not yet confirmed")
  proposed: "proposed",

  @doc("Both parties have accepted — pair is active")
  active: "active",

  @doc("Pairing successfully completed the programme")
  completed: "completed",

  @doc("Pairing was dissolved before completion")
  dissolved: "dissolved",
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("A volunteer opportunity posted by an organization")
model VolunteerOpportunity extends BaseEntity {

  @doc("Opportunity title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Full description of the volunteer role")
  description: string;

  @doc("Skills or qualifications desired")
  skillsRequired?: string[];

  @doc("Time commitment description (e.g., 4 hours/week)")
  @maxLength(255)
  commitment: string;

  @doc("Physical location or 'Remote'")
  @maxLength(500)
  location?: string;

  @doc("UTC date the opportunity becomes available")
  startDate?: utcDateTime;

  @doc("UTC date the opportunity ends or closes")
  endDate?: utcDateTime;

  @doc("Total volunteer spots available")
  @minValue(1)
  spotsAvailable?: int32;

  @doc("Number of spots currently filled")
  @minValue(0)
  spotsFilled: int32;

  @doc("Current posting status")
  status: VolunteerOpportunityStatus;
}

@doc("A volunteer's application for an opportunity")
model VolunteerApplication extends BaseEntity {

  @doc("Opportunity being applied for")
  opportunityId: string;

  @doc("Applicant person identifier")
  personId: string;

  @doc("UTC timestamp of application submission")
  appliedAt: utcDateTime;

  @doc("Applicant's motivation statement")
  motivation?: string;

  @doc("Relevant skills the applicant brings")
  skills?: string[];

  @doc("Current application status")
  status: VolApplicationStatus;
}

@doc("A log entry recording volunteer hours worked")
model VolunteerHours extends BaseEntity {

  @doc("Person who volunteered")
  personId: string;

  @doc("Opportunity the hours are attributed to")
  opportunityId?: string;

  @doc("Date the volunteer work was performed")
  date: plainDate;

  @doc("Number of hours worked")
  @minValue(0)
  hours: float64;

  @doc("Description of activities performed")
  description?: string;

  @doc("Identifier of the person who approved the hours")
  approvedBy?: string;

  @doc("Approval status of this hours log entry")
  status: VolunteerHoursStatus;
}

@doc("A job posting on the association member job board")
model JobPosting extends BaseEntity {

  @doc("Position title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Hiring organization name")
  @minLength(1)
  @maxLength(255)
  organizationName: string;

  @doc("Work location (city/state or Remote)")
  @maxLength(500)
  location?: string;

  @doc("Employment type")
  type: JobPostingType;

  @doc("Salary range or compensation description")
  @maxLength(255)
  salary?: string;

  @doc("Full job description")
  description: string;

  @doc("Required qualifications and experience")
  requirements?: string[];

  @doc("UTC timestamp when the posting went live")
  postedAt: utcDateTime;

  @doc("UTC timestamp after which the posting expires")
  expiresAt?: utcDateTime;

  @doc("Current posting status")
  status: JobPostingStatus;
}

@doc("A member's application for a job posting")
model JobApplication extends BaseEntity {

  @doc("Job posting being applied for")
  postingId: string;

  @doc("Applicant person identifier")
  personId: string;

  @doc("Storage reference for the uploaded resume")
  resumeRef?: string;

  @doc("Cover letter text")
  coverLetter?: string;

  @doc("UTC timestamp of application submission")
  appliedAt: utcDateTime;

  @doc("Current application status")
  status: JobApplicationStatus;
}

@doc("A structured mentorship programme definition")
model MentorshipProgram extends BaseEntity {

  @doc("Programme display name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Programme description and goals")
  description?: string;

  @doc("Programme duration in months")
  @minValue(1)
  duration: int32;

  @doc("Current programme status")
  status: MentorshipProgramStatus;
}

@doc("A matched mentor-mentee pair within a programme")
model MentorshipPair extends BaseEntity {

  @doc("Parent mentorship programme")
  programId: string;

  @doc("Mentor person identifier")
  mentorId: string;

  @doc("Mentee person identifier")
  menteeId: string;

  @doc("UTC timestamp when the match was made")
  matchedAt: utcDateTime;

  @doc("Current pair status")
  status: PairStatus;

  @doc("Agreed mentorship goals")
  goals?: string[];

  @doc("Agreed meeting frequency (e.g., bi-weekly)")
  @maxLength(100)
  meetingFrequency?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a volunteer opportunity")
model VolunteerOpportunityCreateRequest {
  @doc("Title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Description")
  description: string;

  @doc("Skills required")
  skillsRequired?: string[];

  @doc("Commitment description")
  commitment: string;

  @doc("Location")
  location?: string;

  @doc("Start date")
  startDate?: utcDateTime;

  @doc("End date")
  endDate?: utcDateTime;

  @doc("Spots available")
  @minValue(1)
  spotsAvailable?: int32;
}

@doc("Request body for approving volunteer hours")
model VolunteerHoursApprovalRequest {
  @doc("Approval decision")
  decision: VolunteerHoursStatus;

  @doc("Optional reviewer note")
  note?: string;
}

@doc("Query parameters for volunteer opportunity search")
model VolunteerOpportunitySearchParams {
  ...PaginationQuery;

  @doc("Filter by organization")
  @query
  organizationId?: string;

  @doc("Filter by status")
  @query
  status?: VolunteerOpportunityStatus;
}

@doc("Query parameters for volunteer application search")
model VolunteerApplicationSearchParams {
  ...PaginationQuery;

  @doc("Filter by opportunity")
  @query
  opportunityId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by status")
  @query
  status?: VolApplicationStatus;
}

@doc("Query parameters for volunteer hours search")
model VolunteerHoursSearchParams {
  ...PaginationQuery;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by opportunity")
  @query
  opportunityId?: string;

  @doc("Filter by status")
  @query
  status?: VolunteerHoursStatus;
}

@doc("Request body for creating a job posting")
model JobPostingCreateRequest {
  @doc("Position title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Hiring organization name")
  organizationName: string;

  @doc("Work location")
  location?: string;

  @doc("Employment type")
  type: JobPostingType;

  @doc("Salary description")
  salary?: string;

  @doc("Full job description")
  description: string;

  @doc("Requirements list")
  requirements?: string[];

  @doc("UTC expiry timestamp")
  expiresAt?: utcDateTime;
}

@doc("Query parameters for job posting search")
model JobPostingSearchParams {
  ...PaginationQuery;

  @doc("Filter by employment type")
  @query
  type?: JobPostingType;

  @doc("Filter by status")
  @query
  status?: JobPostingStatus;
}

@doc("Request body for submitting a job application")
model JobApplicationCreateRequest {
  @doc("Job posting to apply for")
  postingId: string;

  @doc("Applicant person identifier")
  personId: string;

  @doc("Resume storage reference")
  resumeRef?: string;

  @doc("Cover letter text")
  coverLetter?: string;
}

@doc("Query parameters for job application search")
model JobApplicationSearchParams {
  ...PaginationQuery;

  @doc("Filter by posting")
  @query
  postingId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by status")
  @query
  status?: JobApplicationStatus;
}

@doc("Request body for creating a mentorship programme")
model MentorshipProgramCreateRequest {
  @doc("Programme name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Description")
  description?: string;

  @doc("Duration in months")
  @minValue(1)
  duration: int32;
}

@doc("Request body for creating a mentorship pair")
model MentorshipPairCreateRequest {
  @doc("Parent programme")
  programId: string;

  @doc("Mentor person identifier")
  mentorId: string;

  @doc("Mentee person identifier")
  menteeId: string;

  @doc("Agreed goals")
  goals?: string[];

  @doc("Agreed meeting frequency")
  meetingFrequency?: string;
}

@doc("Query parameters for mentorship pair search")
model MentorshipPairSearchParams {
  ...PaginationQuery;

  @doc("Filter by programme")
  @query
  programId?: string;

  @doc("Filter by mentor")
  @query
  mentorId?: string;

  @doc("Filter by mentee")
  @query
  menteeId?: string;

  @doc("Filter by pair status")
  @query
  status?: PairStatus;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/volunteer")
@tag("Association:Operations")
namespace Association.Operations.Volunteer {

  /**
   * Volunteer opportunity posting management.
   */
  @useAuth(bearerAuth)
  interface VolunteerOpportunityManagement {
    @doc("Create a volunteer opportunity.")
    @operationId("createVolunteerOpportunity")
    @post
    @route("/opportunities")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createVolunteerOpportunity(
      @body body: VolunteerOpportunityCreateRequest
    ): ApiCreatedResponse<VolunteerOpportunity>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a volunteer opportunity by ID.")
    @operationId("getVolunteerOpportunity")
    @get
    @route("/opportunities/{opportunityId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getVolunteerOpportunity(
      @path opportunityId: string
    ): ApiOkResponse<VolunteerOpportunity>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a volunteer opportunity.")
    @operationId("updateVolunteerOpportunity")
    @patch(#{implicitOptionality: true})
    @route("/opportunities/{opportunityId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateVolunteerOpportunity(
      @path opportunityId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<VolunteerOpportunity>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a volunteer opportunity.")
    @operationId("deleteVolunteerOpportunity")
    @delete
    @route("/opportunities/{opportunityId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteVolunteerOpportunity(
      @path opportunityId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search volunteer opportunities.")
    @operationId("searchVolunteerOpportunities")
    @get
    @route("/opportunities")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchVolunteerOpportunities(
      ...VolunteerOpportunitySearchParams
    ): ApiOkResponse<PaginatedResponse<VolunteerOpportunity>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Volunteer application management.
   */
  @useAuth(bearerAuth)
  interface VolunteerApplicationManagement {
    @doc("Submit a volunteer application.")
    @operationId("createVolunteerApplication")
    @post
    @route("/applications")
    @extension("x-security-required-roles", #["association:member"])
    createVolunteerApplication(
      @body body: Record<unknown>
    ): ApiCreatedResponse<VolunteerApplication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a volunteer application by ID.")
    @operationId("getVolunteerApplication")
    @get
    @route("/applications/{applicationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getVolunteerApplication(
      @path applicationId: string
    ): ApiOkResponse<VolunteerApplication>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a volunteer application.")
    @operationId("updateVolunteerApplication")
    @patch(#{implicitOptionality: true})
    @route("/applications/{applicationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateVolunteerApplication(
      @path applicationId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<VolunteerApplication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a volunteer application.")
    @operationId("deleteVolunteerApplication")
    @delete
    @route("/applications/{applicationId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteVolunteerApplication(
      @path applicationId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search volunteer applications.")
    @operationId("searchVolunteerApplications")
    @get
    @route("/applications")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchVolunteerApplications(
      ...VolunteerApplicationSearchParams
    ): ApiOkResponse<PaginatedResponse<VolunteerApplication>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Volunteer hours logging and approval.
   */
  @useAuth(bearerAuth)
  interface VolunteerHoursManagement {
    @doc("Log volunteer hours.")
    @operationId("createVolunteerHours")
    @post
    @route("/hours")
    @extension("x-security-required-roles", #["association:member:owner"])
    createVolunteerHours(
      @body body: Record<unknown>
    ): ApiCreatedResponse<VolunteerHours>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a volunteer hours record by ID.")
    @operationId("getVolunteerHours")
    @get
    @route("/hours/{hoursId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getVolunteerHours(
      @path hoursId: string
    ): ApiOkResponse<VolunteerHours>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a volunteer hours record.")
    @operationId("updateVolunteerHours")
    @patch(#{implicitOptionality: true})
    @route("/hours/{hoursId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    updateVolunteerHours(
      @path hoursId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<VolunteerHours>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a volunteer hours record.")
    @operationId("deleteVolunteerHours")
    @delete
    @route("/hours/{hoursId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteVolunteerHours(
      @path hoursId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search volunteer hours records.")
    @operationId("searchVolunteerHours")
    @get
    @route("/hours")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchVolunteerHours(
      ...VolunteerHoursSearchParams
    ): ApiOkResponse<PaginatedResponse<VolunteerHours>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Approve or reject a volunteer hours log entry.")
    @operationId("approveVolunteerHours")
    @post
    @route("/hours/{hoursId}/approve")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    approveVolunteerHours(
      @path hoursId: string,
      @body body: VolunteerHoursApprovalRequest
    ): ApiOkResponse<VolunteerHours>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Job board posting management.
   */
  @useAuth(bearerAuth)
  interface JobPostingManagement {
    @doc("Create a job posting.")
    @operationId("createJobPosting")
    @post
    @route("/jobs")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createJobPosting(
      @body body: JobPostingCreateRequest
    ): ApiCreatedResponse<JobPosting>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a job posting by ID.")
    @operationId("getJobPosting")
    @get
    @route("/jobs/{postingId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getJobPosting(
      @path postingId: string
    ): ApiOkResponse<JobPosting>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a job posting.")
    @operationId("updateJobPosting")
    @patch(#{implicitOptionality: true})
    @route("/jobs/{postingId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateJobPosting(
      @path postingId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<JobPosting>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a job posting.")
    @operationId("deleteJobPosting")
    @delete
    @route("/jobs/{postingId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteJobPosting(
      @path postingId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search job postings.")
    @operationId("searchJobPostings")
    @get
    @route("/jobs")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchJobPostings(
      ...JobPostingSearchParams
    ): ApiOkResponse<PaginatedResponse<JobPosting>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Job board application management.
   */
  @useAuth(bearerAuth)
  interface JobApplicationManagement {
    @doc("Submit a job application.")
    @operationId("createJobApplication")
    @post
    @route("/jobs/applications")
    @extension("x-security-required-roles", #["association:member"])
    createJobApplication(
      @body body: JobApplicationCreateRequest
    ): ApiCreatedResponse<JobApplication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a job application by ID.")
    @operationId("getJobApplication")
    @get
    @route("/jobs/applications/{applicationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getJobApplication(
      @path applicationId: string
    ): ApiOkResponse<JobApplication>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a job application.")
    @operationId("updateJobApplication")
    @patch(#{implicitOptionality: true})
    @route("/jobs/applications/{applicationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateJobApplication(
      @path applicationId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<JobApplication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a job application.")
    @operationId("deleteJobApplication")
    @delete
    @route("/jobs/applications/{applicationId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteJobApplication(
      @path applicationId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search job applications.")
    @operationId("searchJobApplications")
    @get
    @route("/jobs/applications")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchJobApplications(
      ...JobApplicationSearchParams
    ): ApiOkResponse<PaginatedResponse<JobApplication>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Mentorship programme management.
   */
  @useAuth(bearerAuth)
  interface MentorshipProgramManagement {
    @doc("Create a mentorship programme.")
    @operationId("createMentorshipProgram")
    @post
    @route("/mentorship/programs")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createMentorshipProgram(
      @body body: MentorshipProgramCreateRequest
    ): ApiCreatedResponse<MentorshipProgram>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a mentorship programme by ID.")
    @operationId("getMentorshipProgram")
    @get
    @route("/mentorship/programs/{programId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getMentorshipProgram(
      @path programId: string
    ): ApiOkResponse<MentorshipProgram>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a mentorship programme.")
    @operationId("updateMentorshipProgram")
    @patch(#{implicitOptionality: true})
    @route("/mentorship/programs/{programId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateMentorshipProgram(
      @path programId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<MentorshipProgram>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a mentorship programme.")
    @operationId("deleteMentorshipProgram")
    @delete
    @route("/mentorship/programs/{programId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteMentorshipProgram(
      @path programId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Mentor-mentee pair management.
   */
  @useAuth(bearerAuth)
  interface MentorshipPairManagement {
    @doc("Create a mentor-mentee pair.")
    @operationId("createMentorshipPair")
    @post
    @route("/mentorship/pairs")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createMentorshipPair(
      @body body: MentorshipPairCreateRequest
    ): ApiCreatedResponse<MentorshipPair>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a mentorship pair by ID.")
    @operationId("getMentorshipPair")
    @get
    @route("/mentorship/pairs/{pairId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getMentorshipPair(
      @path pairId: string
    ): ApiOkResponse<MentorshipPair>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a mentorship pair.")
    @operationId("updateMentorshipPair")
    @patch(#{implicitOptionality: true})
    @route("/mentorship/pairs/{pairId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateMentorshipPair(
      @path pairId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<MentorshipPair>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a mentorship pair record.")
    @operationId("deleteMentorshipPair")
    @delete
    @route("/mentorship/pairs/{pairId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteMentorshipPair(
      @path pairId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search mentorship pairs with filtering and pagination.")
    @operationId("searchMentorshipPairs")
    @get
    @route("/mentorship/pairs")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchMentorshipPairs(
      ...MentorshipPairSearchParams
    ): ApiOkResponse<PaginatedResponse<MentorshipPair>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Dissolve an active mentorship pair.")
    @operationId("dissolveMentorshipPair")
    @post
    @route("/mentorship/pairs/{pairId}/dissolve")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    dissolveMentorshipPair(
      @path pairId: string
    ): ApiOkResponse<MentorshipPair>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }
}
