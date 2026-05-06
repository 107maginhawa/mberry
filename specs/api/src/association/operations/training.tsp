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
 * Domains 39-40: Training & Learning Management
 *
 * Covers instructor-led training sessions (live and virtual) and
 * self-paced online courses including modules, enrollments, and quiz attempts.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Delivery format of an instructor-led training session")
enum TrainingType {
  @doc("Classroom-based seminar")
  seminar: "seminar",

  @doc("Hands-on workshop")
  workshop: "workshop",

  @doc("Live online webinar")
  webinar: "webinar",

  @doc("Asynchronous, learner-paced content")
  selfPaced: "self_paced",

  @doc("Practical lab or hands-on session")
  handson: "hands_on",
}

@doc("Lifecycle status of a training offering")
enum TrainingStatus {
  @doc("Draft — not yet visible to members")
  draft: "draft",

  @doc("Published — visible, registration not yet open")
  published: "published",

  @doc("Registration is open")
  registrationOpen: "registration_open",

  @doc("Training is currently in progress")
  inProgress: "in_progress",

  @doc("Training has concluded")
  completed: "completed",

  @doc("Training has been cancelled")
  cancelled: "cancelled",
}

@doc("Enrollment status for a training session")
enum TrainingEnrollmentStatus {
  @doc("Enrolled and awaiting the session to begin")
  enrolled: "enrolled",

  @doc("Session is in progress for this learner")
  inProgress: "in_progress",

  @doc("Learner has completed the training")
  completed: "completed",

  @doc("Learner withdrew before completion")
  withdrawn: "withdrawn",

  @doc("Learner did not attend")
  noShow: "no_show",
}

@doc("Lifecycle status of an online course")
enum CourseStatus {
  @doc("Draft — authoring in progress")
  draft: "draft",

  @doc("Published and available for enrollment")
  published: "published",

  @doc("Course is retired and no longer available")
  retired: "retired",
}

@doc("Type of content within a course module")
enum ModuleType {
  @doc("Video lecture or recording")
  video: "video",

  @doc("Reading material or document")
  reading: "reading",

  @doc("Knowledge-check quiz")
  quiz: "quiz",

  @doc("Practical assignment or project")
  assignment: "assignment",
}

@doc("Enrollment status for an online course")
enum CourseEnrollmentStatus {
  @doc("Enrolled but not yet started")
  enrolled: "enrolled",

  @doc("Learner has started the course")
  inProgress: "in_progress",

  @doc("All required modules completed")
  completed: "completed",

  @doc("Learner dropped the course")
  dropped: "dropped",
}

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

@doc("A single module within an online course")
model CourseModule {
  @doc("Module display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Optional module content or instructions")
  content?: string;

  @doc("Display order within the course (0-based)")
  @minValue(0)
  order: int32;

  @doc("Content format of this module")
  type: ModuleType;

  @doc("Estimated time to complete in minutes")
  @minValue(1)
  durationMinutes?: int32;

  @doc("Whether completion of this module is required to finish the course")
  required: boolean;
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("An instructor-led training event with CE credit tracking")
model Training extends BaseEntity {

  @doc("Display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Delivery format")
  type: TrainingType;

  @doc("UTC start date and time")
  startDate: utcDateTime;

  @doc("UTC end date and time; null for self-paced with no fixed end")
  endDate?: utcDateTime;

  @doc("Physical venue or address")
  @maxLength(500)
  location?: string;

  @doc("URL for virtual or hybrid attendance")
  virtualUrl?: string;

  @doc("Maximum number of enrollees")
  @minValue(1)
  capacity?: int32;

  @doc("CE credits awarded upon completion")
  @minValue(0)
  creditAmount: float64;

  @doc("CE credit category or domain")
  @maxLength(100)
  creditCategory?: string;

  @doc("Identifier of the accreditation body that approved this training")
  accreditedProviderId?: string;

  @doc("Lead instructor name or identifier")
  @maxLength(255)
  instructor?: string;

  @doc("Full description and learning objectives")
  description?: string;

  @doc("Current lifecycle status")
  status: TrainingStatus;

  @doc("Registration fee")
  @minValue(0)
  registrationFee?: int64;
}

@doc("Enrollment of a person in an instructor-led training session")
model TrainingEnrollment extends BaseEntity {

  @doc("Training session enrolled in")
  trainingId: string;

  @doc("Enrolled person")
  personId: string;

  @doc("UTC timestamp of enrollment")
  enrolledAt: utcDateTime;

  @doc("Current enrollment status")
  status: TrainingEnrollmentStatus;

  @doc("UTC timestamp when the learner completed the training")
  completedAt?: utcDateTime;

  @doc("Whether CE credit has been awarded for this enrollment")
  creditAwarded: boolean;

  @doc("Reference to the CE credit ledger entry if credit was awarded")
  creditEntryId?: string;
}

@doc("A self-paced online course composed of ordered modules")
model Course extends BaseEntity {

  @doc("Course display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Course overview and learning objectives")
  description?: string;

  @doc("Ordered list of course modules")
  modules: CourseModule[];

  @doc("Total estimated time to complete in hours")
  @minValue(0)
  estimatedHours?: float64;

  @doc("CE credits awarded upon course completion")
  @minValue(0)
  creditAmount?: float64;

  @doc("Current lifecycle status")
  status: CourseStatus;

  @doc("Author name or identifier")
  @maxLength(255)
  author?: string;
}

@doc("A learner's enrollment and progress record for an online course")
model CourseEnrollment extends BaseEntity {

  @doc("Course enrolled in")
  courseId: string;

  @doc("Enrolled person")
  personId: string;

  @doc("UTC timestamp when enrollment was created")
  enrolledAt: utcDateTime;

  @doc("Completion percentage from 0 to 100")
  @minValue(0)
  @maxValue(100)
  progress: float64;

  @doc("Number of modules the learner has completed")
  @minValue(0)
  completedModules: int32;

  @doc("Total number of modules in the course at enrollment time")
  @minValue(0)
  totalModules: int32;

  @doc("UTC timestamp when all required modules were completed")
  completedAt?: utcDateTime;

  @doc("Current enrollment status")
  status: CourseEnrollmentStatus;
}

@doc("A quiz attempt record for a specific module within a course")
model QuizAttempt extends BaseEntity {

  @doc("Course containing the quiz module")
  courseId: string;

  @doc("Zero-based index of the module within the course")
  @minValue(0)
  moduleIndex: int32;

  @doc("Person who attempted the quiz")
  personId: string;

  @doc("Sequential attempt number for this person on this module (1 = first)")
  @minValue(1)
  attemptNumber: int32;

  @doc("Raw score achieved (e.g., 85.5 for 85.5%)")
  @minValue(0)
  score: float64;

  @doc("Minimum score required to pass")
  @minValue(0)
  passingScore: float64;

  @doc("Whether the attempt score met or exceeded the passing threshold")
  passed: boolean;

  @doc("UTC timestamp when the attempt was submitted")
  attemptedAt: utcDateTime;

  @doc("Map of question identifiers to submitted answer values")
  answers?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a training session")
model TrainingCreateRequest {
  @doc("Display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Delivery format")
  type: TrainingType;

  @doc("UTC start date and time")
  startDate: utcDateTime;

  @doc("UTC end date and time")
  endDate?: utcDateTime;

  @doc("Physical venue or address")
  location?: string;

  @doc("Virtual attendance URL")
  virtualUrl?: string;

  @doc("Maximum enrollment capacity")
  @minValue(1)
  capacity?: int32;

  @doc("CE credits awarded")
  @minValue(0)
  creditAmount: float64;

  @doc("CE credit category")
  creditCategory?: string;

  @doc("Accreditation provider identifier")
  accreditedProviderId?: string;

  @doc("Lead instructor")
  instructor?: string;

  @doc("Full description")
  description?: string;

  @doc("Registration fee")
  @minValue(0)
  registrationFee?: int64;
}

@doc("Request body for updating a training session")
model TrainingUpdateRequest {
  @doc("Display title")
  @minLength(1)
  @maxLength(255)
  title?: string;

  @doc("Delivery format")
  type?: TrainingType;

  @doc("UTC start date and time")
  startDate?: utcDateTime;

  @doc("UTC end date and time")
  endDate?: utcDateTime | null;

  @doc("Physical venue or address")
  location?: string | null;

  @doc("Virtual attendance URL")
  virtualUrl?: string | null;

  @doc("Maximum enrollment capacity")
  @minValue(1)
  capacity?: int32 | null;

  @doc("CE credits awarded")
  @minValue(0)
  creditAmount?: float64;

  @doc("CE credit category")
  creditCategory?: string | null;

  @doc("Accreditation provider identifier")
  accreditedProviderId?: string | null;

  @doc("Lead instructor")
  instructor?: string | null;

  @doc("Full description")
  description?: string | null;

  @doc("Registration fee")
  @minValue(0)
  registrationFee?: int64 | null;
}

@doc("Query parameters for training search")
model TrainingSearchParams {
  ...PaginationQuery;

  @doc("Filter by owning organization")
  @query
  organizationId?: string;

  @doc("Filter by delivery format")
  @query
  type?: TrainingType;

  @doc("Filter by status")
  @query
  status?: TrainingStatus;

  @doc("Filter by start date lower bound")
  @query
  startDateFrom?: utcDateTime;

  @doc("Filter by start date upper bound")
  @query
  startDateTo?: utcDateTime;
}

@doc("Request body for enrolling in a training session")
model TrainingEnrollmentCreateRequest {
  @doc("Training to enroll in")
  trainingId: string;

  @doc("Person to enroll")
  personId: string;
}

@doc("Request body for marking a training enrollment as completed")
model TrainingEnrollmentCompleteRequest {
  @doc("UTC timestamp of completion")
  completedAt: utcDateTime;

  @doc("Whether to immediately award CE credit")
  awardCredit: boolean;
}

@doc("Query parameters for enrollment search")
model TrainingEnrollmentSearchParams {
  ...PaginationQuery;

  @doc("Filter by training session")
  @query
  trainingId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by enrollment status")
  @query
  status?: TrainingEnrollmentStatus;
}

@doc("Request body for creating an online course")
model CourseCreateRequest {
  @doc("Course display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Course overview")
  description?: string;

  @doc("Ordered list of course modules")
  modules: CourseModule[];

  @doc("Estimated hours to complete")
  @minValue(0)
  estimatedHours?: float64;

  @doc("CE credits awarded on completion")
  @minValue(0)
  creditAmount?: float64;

  @doc("Author name or identifier")
  author?: string;
}

@doc("Request body for updating a course progress record")
model CourseProgressUpdateRequest {
  @doc("Updated completion percentage (0-100)")
  @minValue(0)
  @maxValue(100)
  progress: float64;

  @doc("Updated count of completed modules")
  @minValue(0)
  completedModules: int32;
}

@doc("Request body for submitting a quiz attempt")
model QuizAttemptCreateRequest {
  @doc("Course containing the module")
  courseId: string;

  @doc("Zero-based module index")
  @minValue(0)
  moduleIndex: int32;

  @doc("Person submitting the attempt")
  personId: string;

  @doc("Map of question IDs to submitted answers")
  answers: Record<unknown>;
}

@doc("Query parameters for quiz attempt search")
model QuizAttemptSearchParams {
  ...PaginationQuery;

  @doc("Filter by course")
  @query
  courseId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter to only passed attempts")
  @query
  passed?: boolean;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Operations.Training {

  /**
   * Instructor-led training session management.
   */
  @useAuth(bearerAuth)
  interface TrainingManagement {
    @doc("Create a new training session.")
    @operationId("createTraining")
    @post
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createTraining(
      @body body: TrainingCreateRequest
    ): ApiCreatedResponse<Training>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a training session by ID.")
    @operationId("getTraining")
    @get
    @route("/{trainingId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getTraining(
      @path trainingId: string
    ): ApiOkResponse<Training>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an existing training session.")
    @operationId("updateTraining")
    @patch(#{implicitOptionality: true})
    @route("/{trainingId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateTraining(
      @path trainingId: string,
      @body updates: TrainingUpdateRequest
    ): ApiOkResponse<Training>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a training session.")
    @operationId("deleteTraining")
    @delete
    @route("/{trainingId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteTraining(
      @path trainingId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search training sessions with filtering and pagination.")
    @operationId("searchTrainings")
    @get
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchTrainings(
      ...TrainingSearchParams
    ): ApiOkResponse<PaginatedResponse<Training>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Publish a training session making it visible for registration.")
    @operationId("publishTraining")
    @post
    @route("/{trainingId}/publish")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    publishTraining(
      @path trainingId: string
    ): ApiOkResponse<Training>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Training enrollment management.
   */
  @useAuth(bearerAuth)
  interface TrainingEnrollmentManagement {
    @doc("Enroll a person in a training session.")
    @operationId("createTrainingEnrollment")
    @post
    @route("/enrollments")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    createTrainingEnrollment(
      @body body: TrainingEnrollmentCreateRequest
    ): ApiCreatedResponse<TrainingEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a training enrollment by ID.")
    @operationId("getTrainingEnrollment")
    @get
    @route("/enrollments/{enrollmentId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getTrainingEnrollment(
      @path enrollmentId: string
    ): ApiOkResponse<TrainingEnrollment>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a training enrollment record.")
    @operationId("updateTrainingEnrollment")
    @patch(#{implicitOptionality: true})
    @route("/enrollments/{enrollmentId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateTrainingEnrollment(
      @path enrollmentId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<TrainingEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a training enrollment.")
    @operationId("deleteTrainingEnrollment")
    @delete
    @route("/enrollments/{enrollmentId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteTrainingEnrollment(
      @path enrollmentId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search training enrollments with filtering and pagination.")
    @operationId("searchTrainingEnrollments")
    @get
    @route("/enrollments")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchTrainingEnrollments(
      ...TrainingEnrollmentSearchParams
    ): ApiOkResponse<PaginatedResponse<TrainingEnrollment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Mark a training enrollment as completed and optionally award CE credit.")
    @operationId("completeTrainingEnrollment")
    @post
    @route("/enrollments/{enrollmentId}/complete")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    completeTrainingEnrollment(
      @path enrollmentId: string,
      @body body: TrainingEnrollmentCompleteRequest
    ): ApiOkResponse<TrainingEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Online course catalog management.
   */
  @useAuth(bearerAuth)
  interface CourseManagement {
    @doc("Create a new online course.")
    @operationId("createCourse")
    @post
    @route("/courses")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createCourse(
      @body body: CourseCreateRequest
    ): ApiCreatedResponse<Course>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a course by ID.")
    @operationId("getCourse")
    @get
    @route("/courses/{courseId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getCourse(
      @path courseId: string
    ): ApiOkResponse<Course>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a course.")
    @operationId("updateCourse")
    @patch(#{implicitOptionality: true})
    @route("/courses/{courseId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateCourse(
      @path courseId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Course>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a course.")
    @operationId("deleteCourse")
    @delete
    @route("/courses/{courseId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteCourse(
      @path courseId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search courses with filtering and pagination.")
    @operationId("searchCourses")
    @get
    @route("/courses")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchCourses(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Course>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Course enrollment and progress tracking.
   */
  @useAuth(bearerAuth)
  interface CourseEnrollmentManagement {
    @doc("Enroll a person in an online course.")
    @operationId("createCourseEnrollment")
    @post
    @route("/courses/enrollments")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    createCourseEnrollment(
      @body body: Record<unknown>
    ): ApiCreatedResponse<CourseEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a course enrollment by ID.")
    @operationId("getCourseEnrollment")
    @get
    @route("/courses/enrollments/{enrollmentId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getCourseEnrollment(
      @path enrollmentId: string
    ): ApiOkResponse<CourseEnrollment>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a course enrollment record.")
    @operationId("updateCourseEnrollment")
    @patch(#{implicitOptionality: true})
    @route("/courses/enrollments/{enrollmentId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateCourseEnrollment(
      @path enrollmentId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<CourseEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a course enrollment.")
    @operationId("deleteCourseEnrollment")
    @delete
    @route("/courses/enrollments/{enrollmentId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteCourseEnrollment(
      @path enrollmentId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search course enrollments with filtering and pagination.")
    @operationId("searchCourseEnrollments")
    @get
    @route("/courses/enrollments")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchCourseEnrollments(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<CourseEnrollment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update learner progress on an enrolled course.")
    @operationId("updateCourseProgress")
    @post
    @route("/courses/enrollments/{enrollmentId}/progress")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    updateCourseProgress(
      @path enrollmentId: string,
      @body body: CourseProgressUpdateRequest
    ): ApiOkResponse<CourseEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Quiz attempt management.
   */
  @useAuth(bearerAuth)
  interface QuizAttemptManagement {
    @doc("Submit a new quiz attempt for a course module.")
    @operationId("createQuizAttempt")
    @post
    @route("/courses/quiz-attempts")
    @extension("x-security-required-roles", #["association:member:owner"])
    createQuizAttempt(
      @body body: QuizAttemptCreateRequest
    ): ApiCreatedResponse<QuizAttempt>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search quiz attempts with filtering and pagination.")
    @operationId("searchQuizAttempts")
    @get
    @route("/courses/quiz-attempts")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    searchQuizAttempts(
      ...QuizAttemptSearchParams
    ): ApiOkResponse<PaginatedResponse<QuizAttempt>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Member-facing and officer lifecycle operations for hand-wired training routes.
   * Covers operations not addressed by TrainingManagement CRUD interfaces.
   */
  @useAuth(bearerAuth)
  interface TrainingLifecycleService {
    @doc("List training sessions the authenticated member is enrolled in.")
    @operationId("listMyCustomTrainings")
    @get
    @route("/my")
    @extension("x-security-required-roles", #["association:member"])
    listMyCustomTrainings(
      @query organizationId?: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Training>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Self-enroll the authenticated member in a training session.")
    @operationId("enrollInCustomTraining")
    @post
    @route("/{trainingId}/enroll")
    @extension("x-security-required-roles", #["association:member"])
    enrollInCustomTraining(
      @path trainingId: string,
      @query organizationId: string
    ): ApiCreatedResponse<TrainingEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Cancel a training session.")
    @operationId("cancelCustomTraining")
    @post
    @route("/{trainingId}/cancel")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    cancelCustomTraining(
      @path trainingId: string,
      @query organizationId: string
    ): ApiOkResponse<Training>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Mark a training session as completed and award CE credits to enrolled members.")
    @operationId("completeCustomTraining")
    @post
    @route("/{trainingId}/complete")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    completeCustomTraining(
      @path trainingId: string,
      @query organizationId: string,
      @body body: TrainingEnrollmentCompleteRequest
    ): ApiOkResponse<Training>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Check in a participant at a training session.")
    @operationId("checkInCustomTraining")
    @post
    @route("/{trainingId}/check-in")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    checkInCustomTraining(
      @path trainingId: string,
      @query organizationId: string
    ): ApiOkResponse<TrainingEnrollment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("List all enrollments for a specific training session.")
    @operationId("listCustomTrainingEnrollments")
    @get
    @route("/{trainingId}/enrollments")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listCustomTrainingEnrollments(
      @path trainingId: string,
      @query organizationId: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<TrainingEnrollment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
