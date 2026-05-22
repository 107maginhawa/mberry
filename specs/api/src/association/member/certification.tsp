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
 * Association Member Lifecycle — Domains 29-31: Certification, Accreditation & CE Credits
 *
 * Covers certification programs, enrollment and exam results, accredited CE providers,
 * continuing education credit cycles, and individual credit entries.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of requirement within a certification program")
enum CertRequirementType {
  @doc("Written or practical examination")
  exam: "exam",

  @doc("Formal training course or workshop")
  training: "training",

  @doc("Documented professional experience")
  experience: "experience",

  @doc("Signed attestation or declaration")
  attestation: "attestation",
}

@doc("Lifecycle status of a certification program")
enum CertProgramStatus {
  @doc("Program is open for new enrollments")
  active: "active",

  @doc("Program is temporarily not accepting enrollments")
  suspended: "suspended",

  @doc("Program is permanently closed")
  retired: "retired",
}

@doc("Status of a member's enrollment in a certification program")
enum EnrollmentStatus {
  @doc("Member has enrolled in the program")
  enrolled: "enrolled",

  @doc("Member is actively working toward certification")
  inProgress: "inProgress",

  @doc("Member has scheduled their examination")
  examScheduled: "examScheduled",

  @doc("Member has passed all requirements and is certified")
  passed: "passed",

  @doc("Member did not meet the requirements for certification")
  failed: "failed",

  @doc("Member has been awarded the certification")
  certified: "certified",

  @doc("Certification has expired without renewal")
  expired: "expired",

  @doc("Certification has been administratively revoked")
  revoked: "revoked",
}

@doc("Accreditation status of a CE provider organization")
enum AccreditationStatus {
  @doc("Application for accreditation has been submitted")
  applied: "applied",

  @doc("Provider is fully accredited")
  approved: "approved",

  @doc("Provider is on probation with conditions")
  probation: "probation",

  @doc("Provider accreditation has been suspended")
  suspended: "suspended",

  @doc("Provider accreditation has been permanently revoked")
  revoked: "revoked",

  @doc("Provider accreditation has lapsed due to non-renewal")
  expired: "expired",
}

@doc("Status of a member's continuing education credit cycle")
enum CycleStatus {
  @doc("Cycle is in progress and credits are being accumulated")
  active: "active",

  @doc("Member has met the required credits for the cycle")
  completed: "completed",

  @doc("Cycle ended without the member meeting the credit requirement")
  deficient: "deficient",

  @doc("Member is in a grace period to make up the credit deficiency")
  grace: "grace",
}

@doc("Source of a CE credit entry")
enum CreditProvenance {
  @doc("Credit was automatically awarded by the system (e.g., via event attendance tracking)")
  auto: "auto",

  @doc("Credit was manually entered by an administrator")
  manual: "manual",
}

@doc("Category of activity for which CE credit is awarded")
enum CreditActivityType {
  @doc("Association event attendance")
  event: "event",

  @doc("Formal training course")
  training: "training",

  @doc("Conference attendance")
  conference: "conference",

  @doc("Independent self-study activity")
  selfStudy: "selfStudy",

  @doc("Authorship of a professional publication")
  publication: "publication",

  @doc("Teaching or instructing others")
  teaching: "teaching",

  @doc("Any other eligible activity")
  other: "other",
}

// ---------------------------------------------------------------------------
// Value Models (non-entity, embedded)
// ---------------------------------------------------------------------------

@doc("A single requirement within a certification program")
model CertRequirement {
  @doc("Category of the requirement")
  type: CertRequirementType;

  @doc("Description of what must be completed or demonstrated")
  @minLength(1)
  @maxLength(1000)
  description: string;

  @doc("Whether this requirement is mandatory (false = elective)")
  required: boolean;
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("A professional certification program offered by the association")
model CertificationProgram extends BaseEntity {

  @doc("Display name of the certification program")
  @minLength(1)
  @maxLength(150)
  name: string;

  @doc("Short alphanumeric code used in certificates and reporting")
  @minLength(1)
  @maxLength(20)
  @pattern("^[A-Z0-9_-]+$")
  code: string;

  @doc("Description of the program's purpose and scope")
  @maxLength(5000)
  description?: string;

  @doc("List of requirements that candidates must satisfy to obtain certification")
  requirements: CertRequirement[];

  @doc("Duration (in months) for which the certification is valid before recertification is required")
  @minValue(1)
  validityPeriod: int32;

  @doc("Whether holders must complete a recertification process before expiry")
  recertificationRequired: boolean;

  @doc("Lifecycle status of the program")
  status: CertProgramStatus;
}

@doc("A member's enrollment record in a certification program")
model CertificationEnrollment extends BaseEntity {

  @doc("ID of the enrolled member")
  personId: string;

  @doc("ID of the certification program")
  programId: string;

  @doc("Timestamp when the member enrolled")
  enrolledAt: utcDateTime;

  @doc("Current status of the enrollment")
  status: EnrollmentStatus;

  @doc("Timestamp when the certification was awarded")
  certifiedAt?: utcDateTime;

  @doc("Official certificate number issued to the member")
  @maxLength(100)
  certificationNumber?: string;

  @doc("Date on which the issued certification expires")
  expiresAt?: plainDate;
}

@doc("The result of a certification examination attempt")
model ExamResult extends BaseEntity {

  @doc("ID of the enrollment this exam result belongs to")
  enrollmentId: string;

  @doc("ID of the candidate")
  personId: string;

  @doc("Date on which the examination was taken")
  examDate: plainDate;

  @doc("Raw score achieved (null if score is pass/fail only)")
  @minValue(0)
  score?: float64;

  @doc("Minimum score required to pass (null if score is pass/fail only)")
  @minValue(0)
  passingScore?: float64;

  @doc("Whether the candidate passed this attempt")
  passed: boolean;

  @doc("Cumulative number of attempts for this enrollment")
  @minValue(1)
  attempts: int32;
}

@doc("An organization accredited to deliver continuing education activities")
model AccreditedProvider extends BaseEntity {

  @doc("ID of the provider organization")
  organizationId: string;

  @doc("Display name of the provider organization")
  @minLength(1)
  @maxLength(200)
  organizationName: string;

  @doc("Type of accreditation granted (e.g. 'Approved Provider', 'Co-sponsor')")
  @minLength(1)
  @maxLength(100)
  accreditationType: string;

  @doc("IDs or codes of activity categories this provider is approved to offer")
  approvedActivities: string[];

  @doc("Current accreditation status")
  status: AccreditationStatus;

  @doc("Date on which accreditation was granted")
  approvedDate?: plainDate;

  @doc("Date on which accreditation expires")
  expirationDate?: plainDate;

  @doc("Maximum number of CE credits a member may claim per activity from this provider")
  @minValue(1)
  maxCreditsPerActivity?: int32;
}

@doc("A continuing education credit cycle defining the period and credit requirements for a member")
model CreditCycle extends BaseEntity {

  @doc("ID of the member this cycle belongs to")
  personId: string;

  @doc("First day of the credit cycle")
  startDate: plainDate;

  @doc("Last day of the credit cycle")
  endDate: plainDate;

  @doc("Total CE credits required to complete this cycle")
  @minValue(0)
  requiredCredits: float64;

  @doc("CE credits earned so far in this cycle")
  @minValue(0)
  earnedCredits: float64;

  @doc("Credits carried over from a prior cycle (if policy allows)")
  @minValue(0)
  carryOverCredits?: float64;

  @doc("Current status of this credit cycle")
  status: CycleStatus;
}

@doc("A single CE credit entry awarded to a member for a specific activity")
model CreditEntry extends BaseEntity {

  @doc("ID of the member receiving the credit")
  personId: string;

  @doc("ID of the credit cycle this entry applies to")
  cycleId: string;

  @doc("Category of activity for which credit is awarded")
  activityType: CreditActivityType;

  @doc("ID of the specific activity record (event, course, publication, etc.) if available")
  @maxLength(100)
  activityId?: string;

  @doc("Human-readable name of the activity")
  @minLength(1)
  @maxLength(200)
  activityName: string;

  @doc("Number of CE credits awarded for this activity")
  @minValue(0)
  credits: float64;

  @doc("How the credit was recorded")
  provenance: CreditProvenance;

  @doc("Date on which the activity was completed and credit earned")
  earnedDate: plainDate;

  @doc("ID of the staff member or system that awarded the credits")
  @maxLength(100)
  awardedBy?: string;

  @doc("Timestamp when the credit entry was verified by association staff")
  verifiedAt?: utcDateTime;

  @doc("Subcategory used for reporting (e.g. ethics, clinical, leadership)")
  @maxLength(100)
  category?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a certification program")
model CertificationProgramCreateRequest {
  name: string;
  code: string;
  description?: string;
  requirements: CertRequirement[];
  validityPeriod: int32;
  recertificationRequired: boolean;
  status: CertProgramStatus;
}

@doc("Request to update a certification program")
model CertificationProgramUpdateRequest {
  name?: string;
  description?: string | null;
  requirements?: CertRequirement[];
  validityPeriod?: int32;
  recertificationRequired?: boolean;
  status?: CertProgramStatus;
}

@doc("Request to enroll a member in a certification program")
model CertificationEnrollmentCreateRequest {
  personId: string;
  programId: string;
}

@doc("Request to record an exam result for an enrollment")
model RecordExamResultRequest {
  examDate: plainDate;
  score?: float64;
  passingScore?: float64;
  passed: boolean;
}

@doc("Request to award certification to an enrollment")
model CertifyRequest {
  @doc("Official certificate number to assign")
  @minLength(1)
  @maxLength(100)
  certificationNumber: string;

  @doc("Date on which the certification expires")
  expiresAt?: plainDate;
}

@doc("Request to create or update an accredited provider")
model AccreditedProviderRequest {
  organizationId: string;
  organizationName: string;
  accreditationType: string;
  approvedActivities: string[];
  status: AccreditationStatus;
  approvedDate?: plainDate;
  expirationDate?: plainDate;
  maxCreditsPerActivity?: int32;
}

@doc("Request to create a credit cycle")
model CreditCycleCreateRequest {
  personId: string;
  startDate: plainDate;
  endDate?: plainDate;
  requiredCredits: float64;
  carryOverCredits?: float64;
}

@doc("Summary of a member's current credit cycle progress")
model CreditCycleSummary {
  @doc("Credit cycle details")
  cycle: CreditCycle;

  @doc("Breakdown of credits by activity type")
  breakdown: Record<unknown>;

  @doc("Credits still needed to complete the cycle")
  @minValue(0)
  creditsRemaining: float64;

  @doc("Whether the cycle is on track to be completed before its end date")
  onTrack: boolean;
}

@doc("Request to create a CE credit entry (immutable after creation)")
model CreditEntryCreateRequest {
  personId: string;
  cycleId: string;
  activityType: CreditActivityType;
  activityId?: string;
  activityName: string;
  credits: float64;
  provenance: CreditProvenance;
  earnedDate: plainDate;
  awardedBy?: string;
  category?: string;
}

@doc("Request to create multiple CE credit entries in a single call")
model BulkCreditEntryRequest {
  @doc("List of credit entries to create")
  entries: CreditEntryCreateRequest[];
}

@doc("Result of a bulk credit entry creation")
model BulkCreditEntryResult {
  @doc("Number of credit entries successfully created")
  created: int32;

  @doc("Any entries that failed validation")
  errors?: Record<unknown>[];
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/certification-programs")
@tag("Association:Member")
namespace Association.Member.Certification {
  @doc("CRUD and search for certification programs")
  interface CertificationProgramManagement {
    @doc("Create a certification program.")
    @operationId("createCertificationProgram")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCertificationProgram(
      @body body: CertificationProgramCreateRequest
    ): ApiCreatedResponse<CertificationProgram>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a certification program by ID.")
    @operationId("getCertificationProgram")
    @get
    @route("/{programId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getCertificationProgram(
      @path programId: string
    ): ApiOkResponse<CertificationProgram>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List certification programs.")
    @operationId("listCertificationPrograms")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listCertificationPrograms(
      ...PaginationQuery,
      @query status?: CertProgramStatus
    ): ApiOkResponse<PaginatedResponse<CertificationProgram>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a certification program.")
    @operationId("updateCertificationProgram")
    @patch(#{implicitOptionality: true})
    @route("/{programId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCertificationProgram(
      @path programId: string,
      @body updates: CertificationProgramUpdateRequest
    ): ApiOkResponse<CertificationProgram>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a certification program.")
    @operationId("deleteCertificationProgram")
    @delete
    @route("/{programId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCertificationProgram(
      @path programId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, exam recording, and certification award for enrollments")
  @route("/association/member/certification-enrollments")
  interface CertificationEnrollmentManagement {
    @doc("Enroll a member in a certification program.")
    @operationId("createCertificationEnrollment")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    createCertificationEnrollment(
      @body body: CertificationEnrollmentCreateRequest
    ): ApiCreatedResponse<CertificationEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a certification enrollment by ID.")
    @operationId("getCertificationEnrollment")
    @get
    @route("/{enrollmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getCertificationEnrollment(
      @path enrollmentId: string
    ): ApiOkResponse<CertificationEnrollment>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List certification enrollments.")
    @operationId("listCertificationEnrollments")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listCertificationEnrollments(
      ...PaginationQuery,
      @query personId?: string,
      @query programId?: string,
      @query status?: EnrollmentStatus
    ): ApiOkResponse<PaginatedResponse<CertificationEnrollment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a certification enrollment.")
    @operationId("updateCertificationEnrollment")
    @patch(#{implicitOptionality: true})
    @route("/{enrollmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCertificationEnrollment(
      @path enrollmentId: string,
      @body updates: CertificationEnrollmentCreateRequest
    ): ApiOkResponse<CertificationEnrollment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a certification enrollment.")
    @operationId("deleteCertificationEnrollment")
    @delete
    @route("/{enrollmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCertificationEnrollment(
      @path enrollmentId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Record an examination result for a certification enrollment.")
    @operationId("recordExamResult")
    @post
    @route("/{enrollmentId}/exam-results")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    recordExamResult(
      @path enrollmentId: string,
      @body body: RecordExamResultRequest
    ): ApiCreatedResponse<ExamResult>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Award certification to a passing enrollment.")
    @operationId("certifyEnrollment")
    @post
    @route("/{enrollmentId}/certify")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    certifyEnrollment(
      @path enrollmentId: string,
      @body body: CertifyRequest
    ): ApiOkResponse<CertificationEnrollment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, approval, and suspension of accredited CE providers")
  @route("/association/member/accredited-providers")
  interface AccreditedProviderManagement {
    @doc("Create an accredited CE provider record.")
    @operationId("createAccreditedProvider")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createAccreditedProvider(
      @body body: AccreditedProviderRequest
    ): ApiCreatedResponse<AccreditedProvider>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get an accredited provider by ID.")
    @operationId("getAccreditedProvider")
    @get
    @route("/{providerId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getAccreditedProvider(
      @path providerId: string
    ): ApiOkResponse<AccreditedProvider>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List accredited providers.")
    @operationId("listAccreditedProviders")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listAccreditedProviders(
      ...PaginationQuery,
      @query status?: AccreditationStatus
    ): ApiOkResponse<PaginatedResponse<AccreditedProvider>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an accredited provider record.")
    @operationId("updateAccreditedProvider")
    @patch(#{implicitOptionality: true})
    @route("/{providerId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateAccreditedProvider(
      @path providerId: string,
      @body updates: AccreditedProviderRequest
    ): ApiOkResponse<AccreditedProvider>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete an accredited provider record.")
    @operationId("deleteAccreditedProvider")
    @delete
    @route("/{providerId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteAccreditedProvider(
      @path providerId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Approve a provider's accreditation application.")
    @operationId("approveAccreditedProvider")
    @post
    @route("/{providerId}/approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    approveAccreditedProvider(
      @path providerId: string,
      @query approvedDate: plainDate,
      @query expirationDate: plainDate
    ): ApiOkResponse<AccreditedProvider>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Suspend a provider's accreditation.")
    @operationId("suspendAccreditedProvider")
    @post
    @route("/{providerId}/suspend")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    suspendAccreditedProvider(
      @path providerId: string,
      @query reason: string
    ): ApiOkResponse<AccreditedProvider>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and summary reporting for CE credit cycles")
  @route("/association/member/credit-cycles")
  interface CreditCycleManagement {
    @doc("Create a credit cycle for a member.")
    @operationId("createCreditCycle")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCreditCycle(
      @body body: CreditCycleCreateRequest
    ): ApiCreatedResponse<CreditCycle>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a credit cycle by ID.")
    @operationId("getCreditCycle")
    @get
    @route("/{cycleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getCreditCycle(
      @path cycleId: string
    ): ApiOkResponse<CreditCycle>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List credit cycles.")
    @operationId("listCreditCycles")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listCreditCycles(
      ...PaginationQuery,
      @query personId?: string,
      @query status?: CycleStatus
    ): ApiOkResponse<PaginatedResponse<CreditCycle>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a credit cycle.")
    @operationId("updateCreditCycle")
    @patch(#{implicitOptionality: true})
    @route("/{cycleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCreditCycle(
      @path cycleId: string,
      @body updates: CreditCycleCreateRequest
    ): ApiOkResponse<CreditCycle>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a credit cycle.")
    @operationId("deleteCreditCycle")
    @delete
    @route("/{cycleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCreditCycle(
      @path cycleId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Get a summary of a member's progress within a specific credit cycle.")
    @operationId("getCreditCycleSummary")
    @get
    @route("/{cycleId}/summary")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getCreditCycleSummary(
      @path cycleId: string
    ): ApiOkResponse<CreditCycleSummary>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Create, search, and bulk-create CE credit entries (immutable after creation)")
  @route("/association/member/credit-entries")
  interface CreditEntryManagement {
    @doc("Record a CE credit entry for a member. Immutable after creation.")
    @operationId("createCreditEntry")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCreditEntry(
      @body body: CreditEntryCreateRequest
    ): ApiCreatedResponse<CreditEntry>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a credit entry by ID.")
    @operationId("getCreditEntry")
    @get
    @route("/{entryId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getCreditEntry(
      @path entryId: string
    ): ApiOkResponse<CreditEntry>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search CE credit entries.")
    @operationId("listCreditEntries")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listCreditEntries(
      ...PaginationQuery,
      @query personId?: string,
      @query cycleId?: string,
      @query activityType?: CreditActivityType
    ): ApiOkResponse<PaginatedResponse<CreditEntry>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Bulk-create CE credit entries (e.g. from event attendance import).")
    @operationId("bulkCreateCreditEntries")
    @post
    @route("/bulk")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    bulkCreateCreditEntries(
      @body body: BulkCreditEntryRequest
    ): ApiOkResponse<BulkCreditEntryResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
