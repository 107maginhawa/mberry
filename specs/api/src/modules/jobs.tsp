import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Jobs Module (M15)
 *
 * Association-run job board for members and partner organizations. Handles
 * job postings (CRUD + search) and member applications.
 *
 * Endpoints (under /association/jobs):
 *   POST   /postings                        — create a posting
 *   GET    /postings                        — search/list postings
 *   GET    /postings/{postingId}            — fetch a single posting
 *   PATCH  /postings/{postingId}            — update a posting
 *   DELETE /postings/{postingId}            — delete a posting
 *   POST   /applications                    — submit an application
 *   PATCH  /applications/{applicationId}    — update application status (officer)
 *
 * Status: TypeSpec authored Wave G3 (S-C4-025). Route mounting is deferred —
 * handler implementations exist in services/api-ts/src/handlers/jobs/ but are
 * not currently wired into app.ts. See ROADMAP.md for activation plan.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a job posting")
enum JobBoardPostingStatus {
  draft: "draft",
  active: "active",
  filled: "filled",
  expired: "expired",
  closed: "closed",
}

@doc("Employment type of a job posting")
enum JobBoardPostingType {
  fullTime: "full_time",
  partTime: "part_time",
  contract: "contract",
  fellowship: "fellowship",
  internship: "internship",
}

@doc("Lifecycle status of a job application")
enum JobBoardApplicationStatus {
  applied: "applied",
  screening: "screening",
  interviewed: "interviewed",
  offered: "offered",
  hired: "hired",
  rejected: "rejected",
  withdrawn: "withdrawn",
}

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

@doc("A job posting published on the association job board")
model JobBoardPosting extends BaseEntity {
  @doc("Organisation that owns the posting")
  organizationId: UUID;

  @doc("Job title")
  title: string;

  @doc("Hiring organization name (may differ from the association)")
  organizationName: string;

  @doc("Free-text location (city / 'Remote' / etc.)")
  location?: string;

  @doc("Employment type")
  type: JobBoardPostingType;

  @doc("Salary range as free-text (e.g. '$80,000 - $100,000 / yr')")
  salary?: string;

  @doc("Long-form job description")
  description?: string;

  @doc("List of requirements / qualifications")
  requirements?: string[];

  @doc("When the posting was published (null while in draft)")
  postedAt?: utcDateTime;

  @doc("When the posting expires and stops accepting applications")
  expiresAt?: utcDateTime;

  @doc("Current lifecycle status")
  status: JobBoardPostingStatus;

  @doc("Person ID of the officer who posted it")
  postedBy?: UUID;
}

@doc("A member application against a job posting")
model JobBoardApplication extends BaseEntity {
  @doc("Job posting the application is against")
  postingId: UUID;

  @doc("Person who submitted the application")
  personId: UUID;

  @doc("Reference (storage key / URL) to the uploaded resume")
  resumeRef?: string;

  @doc("Optional cover letter text")
  coverLetter?: string;

  @doc("When the application was submitted")
  appliedAt: utcDateTime;

  @doc("Current application status")
  status: JobBoardApplicationStatus;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for creating a job posting")
model CreateJobBoardPostingRequest {
  @doc("Job title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Hiring organization name")
  @minLength(1)
  @maxLength(255)
  organizationName: string;

  @doc("Optional organization id override (defaults to the path :organizationId)")
  organizationId?: UUID;

  @doc("Free-text location")
  location?: string;

  @doc("Employment type")
  type?: JobBoardPostingType;

  @doc("Salary range as free-text")
  salary?: string;

  @doc("Long-form description")
  description?: string;

  @doc("Requirements / qualifications list")
  requirements?: string[];

  @doc("Publish time (ISO 8601). Defaults to now.")
  postedAt?: utcDateTime;

  @doc("Expiry time (ISO 8601)")
  expiresAt?: utcDateTime;

  @doc("Initial lifecycle status. Defaults to draft.")
  status?: JobBoardPostingStatus;
}

@doc("Request body for updating a job posting")
model UpdateJobBoardPostingRequest {
  @doc("Job title")
  @maxLength(255)
  title?: string;

  @doc("Hiring organization name")
  @maxLength(255)
  organizationName?: string;

  @doc("Free-text location")
  location?: string;

  @doc("Employment type")
  type?: JobBoardPostingType;

  @doc("Salary range")
  salary?: string;

  @doc("Description")
  description?: string;

  @doc("Requirements")
  requirements?: string[];

  @doc("Expiry time (ISO 8601)")
  expiresAt?: utcDateTime;

  @doc("Lifecycle status")
  status?: JobBoardPostingStatus;
}

@doc("Request body for submitting a job application")
model CreateJobBoardApplicationRequest {
  @doc("Job posting being applied to")
  postingId: UUID;

  @doc("Reference (storage key / URL) to the uploaded resume")
  resumeRef?: string;

  @doc("Cover letter text")
  coverLetter?: string;
}

@doc("Request body for updating a job application (officer-only)")
model UpdateJobBoardApplicationRequest {
  @doc("Updated lifecycle status")
  status: JobBoardApplicationStatus;

  @doc("Optional reviewer note")
  note?: string;
}

@doc("Paginated list of job postings")
model JobBoardPostingListResponse {
  @doc("Page of job postings")
  data: JobBoardPosting[];

  @doc("Pagination metadata")
  pagination: {
    @doc("Total matching postings")
    total: int32;

    @doc("Page size")
    limit: int32;

    @doc("Pagination offset")
    offset: int32;
  };
}

// ---------------------------------------------------------------------------
// Namespace / interfaces
// ---------------------------------------------------------------------------

@route("/association/jobs")
@tag("Jobs")
namespace JobsModule {
  @doc("Job posting CRUD (officer-managed)")
  interface JobBoardPostingManagement {
    @doc("Create a new job posting. Officer-only.")
    @operationId("createJobPosting")
    @post
    @route("/postings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createJobBoardPosting(
      @body body: CreateJobBoardPostingRequest
    ): ApiCreatedResponse<{ data: JobBoardPosting }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search/list job postings with optional filters.")
    @operationId("searchJobPostings")
    @get
    @route("/postings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    searchJobBoardPostings(
      @query organizationId?: UUID,
      @query status?: JobBoardPostingStatus,
      @query type?: JobBoardPostingType,
      @query search?: string,
      @query limit?: int32,
      @query offset?: int32
    ): ApiOkResponse<JobBoardPostingListResponse>
      | ApiUnauthorizedResponse;

    @doc("Fetch a single job posting by ID.")
    @operationId("getJobPosting")
    @get
    @route("/postings/{postingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getJobBoardPosting(
      @path postingId: UUID
    ): ApiOkResponse<{ data: JobBoardPosting }>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("Update a job posting. Officer-only.")
    @operationId("updateJobPosting")
    @patch(#{implicitOptionality: true})
    @route("/postings/{postingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateJobBoardPosting(
      @path postingId: UUID,
      @body body: UpdateJobBoardPostingRequest
    ): ApiOkResponse<{ data: JobBoardPosting }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a job posting. Officer-only.")
    @operationId("deleteJobPosting")
    @delete
    @route("/postings/{postingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    deleteJobBoardPosting(
      @path postingId: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  @doc("Member job applications + officer review")
  interface JobBoardApplicationManagement {
    @doc("Submit a job application to an active posting.")
    @operationId("createJobApplication")
    @post
    @route("/applications")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createJobBoardApplication(
      @body body: CreateJobBoardApplicationRequest
    ): ApiCreatedResponse<{ data: JobBoardApplication }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Update an application (officer-only — advance status, add note).")
    @operationId("updateJobApplication")
    @patch(#{implicitOptionality: true})
    @route("/applications/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateJobBoardApplication(
      @path applicationId: UUID,
      @body body: UpdateJobBoardApplicationRequest
    ): ApiOkResponse<{ data: JobBoardApplication }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
