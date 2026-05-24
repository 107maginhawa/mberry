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
 * Association Member — Special Assessments
 *
 * One-time charges levied by officers (treasurer/president) alongside regular dues.
 * Supports draft/active/closed lifecycle, selective or all-member targeting,
 * and collection metrics tracking.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Who the special assessment applies to")
enum AssessmentAppliesTo {
  @doc("Applies to all active members")
  all: "all",

  @doc("Applies to selected members only")
  selected: "selected",
}

@doc("Lifecycle status of a special assessment")
enum AssessmentStatus {
  @doc("Draft — not yet applied to members")
  draft: "draft",

  @doc("Active — applied to members, invoices generated")
  active: "active",

  @doc("Closed — collection complete or manually closed")
  closed: "closed",
}

@doc("Payment status of an assessment target")
enum AssessmentTargetStatus {
  @doc("Payment pending")
  pending: "pending",

  @doc("Payment received")
  paid: "paid",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("A special assessment — a one-time charge created by an officer")
model SpecialAssessment extends BaseEntity {
  @doc("ID of the association organization")
  organizationId: string;

  @doc("Name of the special assessment")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Description of the assessment purpose")
  description?: string | null;

  @doc("Amount in minor currency units (e.g. cents)")
  @minValue(1)
  amount: int64;

  @doc("ISO 4217 currency code")
  @maxLength(3)
  currency: string;

  @doc("Due date for the assessment")
  dueDate: plainDate;

  @doc("Optional fund to allocate collected amounts")
  fundId?: string | null;

  @doc("Whether assessment applies to all members or selected members")
  appliesTo: AssessmentAppliesTo;

  @doc("Lifecycle status")
  status: AssessmentStatus;
}

@doc("A target member for a special assessment")
model SpecialAssessmentTarget extends BaseEntity {
  @doc("ID of the special assessment")
  assessmentId: string;

  @doc("ID of the target person")
  personId: string;

  @doc("ID of the generated invoice, if any")
  invoiceId?: string | null;

  @doc("Payment status")
  status: AssessmentTargetStatus;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a special assessment")
model SpecialAssessmentCreateRequest {
  @doc("Name of the special assessment")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Description of the assessment purpose")
  description?: string | null;

  @doc("Amount in minor currency units (e.g. cents)")
  @minValue(1)
  amount: int64;

  @doc("ISO 4217 currency code")
  @maxLength(3)
  currency?: string;

  @doc("Due date for the assessment")
  dueDate: plainDate;

  @doc("Optional fund ID to allocate collected amounts")
  fundId?: string | null;

  @doc("Whether assessment applies to all or selected members")
  appliesTo?: AssessmentAppliesTo;
}

@doc("Request to update a special assessment (draft status only)")
model SpecialAssessmentUpdateRequest {
  @doc("Name of the special assessment")
  @minLength(1)
  @maxLength(255)
  name?: string;

  @doc("Description of the assessment purpose")
  description?: string | null;

  @doc("Amount in minor currency units")
  @minValue(1)
  amount?: int64;

  @doc("ISO 4217 currency code")
  @maxLength(3)
  currency?: string;

  @doc("Due date for the assessment")
  dueDate?: plainDate;

  @doc("Optional fund ID")
  fundId?: string | null;

  @doc("Whether assessment applies to all or selected members")
  appliesTo?: AssessmentAppliesTo;
}

@doc("Request to apply a special assessment — generates invoices for target members")
model ApplySpecialAssessmentRequest {
  @doc("Optional list of person IDs when appliesTo is 'selected'")
  memberIds?: string[];
}

@doc("Result of applying a special assessment")
model ApplySpecialAssessmentResult {
  @doc("The updated assessment (now active)")
  assessment: SpecialAssessment;

  @doc("Number of invoices generated")
  invoicesGenerated: int32;
}

@doc("Collection metrics for a special assessment")
model SpecialAssessmentCollectionMetrics {
  @doc("Total number of targeted members")
  totalTargets: int32;

  @doc("Number of members who have paid")
  paidCount: int32;

  @doc("Number of members with pending payment")
  pendingCount: int32;

  @doc("Total amount expected (in minor currency units)")
  totalExpected: int64;

  @doc("Total amount collected (in minor currency units)")
  totalCollected: int64;

  @doc("Total amount outstanding (in minor currency units)")
  totalOutstanding: int64;
}

@doc("Special assessment with embedded collection metrics")
model SpecialAssessmentWithCollection extends SpecialAssessment {
  @doc("Collection summary metrics")
  collection?: SpecialAssessmentCollectionMetrics | null;
}

@doc("List response for special assessments with collection summaries")
model SpecialAssessmentListResponse {
  @doc("List of assessments with collection data")
  assessments: SpecialAssessmentWithCollection[];
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Member.SpecialAssessments {
  @doc("CRUD and lifecycle management for special assessments")
  interface SpecialAssessmentManagement {
    @doc("Create a special assessment in draft status. Officer auth required (treasurer/president).")
    @operationId("createSpecialAssessment")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createSpecialAssessment(
      @body body: SpecialAssessmentCreateRequest
    ): ApiCreatedResponse<SpecialAssessment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List special assessments for an organization with collection summaries.")
    @operationId("listSpecialAssessments")
    @get
    @route("/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listSpecialAssessments(
      @path orgId: string
    ): ApiOkResponse<SpecialAssessmentListResponse>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a special assessment. Only allowed while in draft status (BR-T8-001).")
    @operationId("updateSpecialAssessment")
    @put
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateSpecialAssessment(
      @path id: string,
      @body body: SpecialAssessmentUpdateRequest
    ): ApiOkResponse<SpecialAssessment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a special assessment.")
    @operationId("deleteSpecialAssessment")
    @delete
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteSpecialAssessment(
      @path id: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Apply a special assessment — transitions from draft to active, generates invoices for target members.")
    @operationId("applySpecialAssessment")
    @post
    @route("/{id}/apply")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    applySpecialAssessment(
      @path id: string,
      @body body: ApplySpecialAssessmentRequest
    ): ApiOkResponse<ApplySpecialAssessmentResult>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get collection metrics for a specific special assessment.")
    @operationId("getSpecialAssessmentCollection")
    @get
    @route("/{id}/collection")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getSpecialAssessmentCollection(
      @path id: string
    ): ApiOkResponse<SpecialAssessmentCollectionMetrics>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
