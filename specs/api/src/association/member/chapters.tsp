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
 * Association Member Lifecycle — Domain 21: Chapter Affiliations
 *
 * Covers chapter affiliation records, inter-chapter transfer workflows,
 * and dues royalty splits between the national organization and chapters.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a chapter affiliation record")
enum AffiliationStatus {
  @doc("Member is actively affiliated with the chapter")
  active: "active",

  @doc("Member has transferred to another chapter")
  transferred: "transferred",

  @doc("Member has voluntarily withdrawn from the chapter")
  withdrawn: "withdrawn",
}

@doc("Status of an inter-chapter affiliation transfer request")
enum TransferStatus {
  @doc("Transfer has been requested by the member")
  requested: "requested",

  @doc("Waiting for the source chapter to approve the outgoing transfer")
  pendingSourceApproval: "pendingSourceApproval",

  @doc("Waiting for the target chapter to approve the incoming transfer")
  pendingTargetApproval: "pendingTargetApproval",

  @doc("Both chapters have approved; transfer is scheduled for completion")
  approved: "approved",

  @doc("Transfer has been denied by one or both chapters")
  denied: "denied",

  @doc("Transfer has been completed and the member's primary affiliation updated")
  completed: "completed",

  @doc("Transfer was cancelled before completion")
  cancelled: "cancelled",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("Affiliation between a person and a chapter within the association")
model ChapterAffiliation extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the affiliated member")
  personId: string;

  @doc("ID of the chapter the member is affiliated with")
  chapterId: string;

  @doc("Whether this is the member's primary (home) chapter")
  isPrimary: boolean;

  @doc("Timestamp when the affiliation began")
  affiliatedAt: utcDateTime;

  @doc("ID of the chapter the member transferred from, if applicable")
  transferredFrom?: string;

  @doc("Current status of this affiliation")
  status: AffiliationStatus;
}

@doc("Request to transfer a member's primary chapter affiliation from one chapter to another")
model AffiliationTransfer extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the member requesting the transfer")
  personId: string;

  @doc("ID of the chapter the member is leaving")
  fromChapterId: string;

  @doc("ID of the chapter the member is joining")
  toChapterId: string;

  @doc("Timestamp when the transfer was requested")
  requestedAt: utcDateTime;

  @doc("ID of the person who initiated the request (may differ from personId for admin-initiated transfers)")
  requestedBy: string;

  @doc("ID of the source chapter officer who approved the outgoing transfer")
  approvedBySource?: string;

  @doc("ID of the target chapter officer who approved the incoming transfer")
  approvedByTarget?: string;

  @doc("Current status of the transfer workflow")
  status: TransferStatus;

  @doc("Timestamp when the transfer was fully completed")
  completedAt?: utcDateTime;
}

@doc("Royalty split configuration defining how dues revenue is divided between the national organization and a chapter")
model RoyaltySplit extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the membership this split applies to")
  membershipId: string;

  @doc("ID of the national organization receiving its share")
  nationalOrgId: string;

  @doc("ID of the chapter receiving its share")
  chapterId: string;

  @doc("Percentage of dues revenue retained by the national organization (0–100)")
  @minValue(0)
  @maxValue(100)
  splitPercentNational: float64;

  @doc("Percentage of dues revenue distributed to the chapter (0–100); must complement splitPercentNational to total 100")
  @minValue(0)
  @maxValue(100)
  splitPercentChapter: float64;

  @doc("Date from which this split configuration takes effect")
  effectiveDate: plainDate;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a chapter affiliation")
model ChapterAffiliationCreateRequest {
  personId: string;
  chapterId: string;
  isPrimary: boolean;
  affiliatedAt: utcDateTime;
  transferredFrom?: string;
}

@doc("Request to update a chapter affiliation")
model ChapterAffiliationUpdateRequest {
  isPrimary?: boolean;
  status?: AffiliationStatus;
}

@doc("Request to create an affiliation transfer")
model AffiliationTransferCreateRequest {
  personId: string;
  fromChapterId: string;
  toChapterId: string;
}

@doc("Request to approve or deny a transfer at a specific chapter")
model TransferDecisionRequest {
  @doc("ID of the officer making the decision")
  officerId: string;

  @doc("Optional reason for the decision")
  @maxLength(1000)
  reason?: string;
}

@doc("Request to create or update a royalty split")
model RoyaltySplitCreateRequest {
  membershipId: string;
  nationalOrgId: string;
  chapterId: string;
  splitPercentNational: float64;
  splitPercentChapter: float64;
  effectiveDate: plainDate;
}

@doc("Request to update a royalty split")
model RoyaltySplitUpdateRequest {
  splitPercentNational?: float64;
  splitPercentChapter?: float64;
  effectiveDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Member.Chapters {
  @doc("CRUD, search, and primary-chapter management for chapter affiliations")
  interface ChapterAffiliationManagement {
    @doc("Create a new chapter affiliation.")
    @operationId("createChapterAffiliation")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createChapterAffiliation(
      @body body: ChapterAffiliationCreateRequest
    ): ApiCreatedResponse<ChapterAffiliation>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a chapter affiliation by ID.")
    @operationId("getChapterAffiliation")
    @get
    @route("/{affiliationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getChapterAffiliation(
      @path affiliationId: string
    ): ApiOkResponse<ChapterAffiliation>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List chapter affiliations with optional filters.")
    @operationId("listChapterAffiliations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "chapter:officer"])
    listChapterAffiliations(
      ...PaginationQuery,
      @query personId?: string,
      @query chapterId?: string,
      @query status?: AffiliationStatus
    ): ApiOkResponse<PaginatedResponse<ChapterAffiliation>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a chapter affiliation record.")
    @operationId("updateChapterAffiliation")
    @patch(#{implicitOptionality: true})
    @route("/{affiliationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateChapterAffiliation(
      @path affiliationId: string,
      @body updates: ChapterAffiliationUpdateRequest
    ): ApiOkResponse<ChapterAffiliation>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a chapter affiliation record.")
    @operationId("deleteChapterAffiliation")
    @delete
    @route("/{affiliationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteChapterAffiliation(
      @path affiliationId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Set the specified affiliation as the member's primary chapter.")
    @operationId("setPrimaryChapterAffiliation")
    @post
    @route("/{affiliationId}/set-primary")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    setPrimaryChapterAffiliation(
      @path affiliationId: string
    ): ApiOkResponse<ChapterAffiliation>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("Create, search, approve, deny, and complete inter-chapter affiliation transfers")
  interface AffiliationTransferManagement {
    @doc("Submit a new affiliation transfer request.")
    @operationId("createAffiliationTransfer")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    createAffiliationTransfer(
      @body body: AffiliationTransferCreateRequest
    ): ApiCreatedResponse<AffiliationTransfer>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get an affiliation transfer by ID.")
    @operationId("getAffiliationTransfer")
    @get
    @route("/{transferId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "chapter:officer"])
    getAffiliationTransfer(
      @path transferId: string
    ): ApiOkResponse<AffiliationTransfer>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List affiliation transfers with optional filters.")
    @operationId("listAffiliationTransfers")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "chapter:officer"])
    listAffiliationTransfers(
      ...PaginationQuery,
      @query personId?: string,
      @query fromChapterId?: string,
      @query toChapterId?: string,
      @query status?: TransferStatus
    ): ApiOkResponse<PaginatedResponse<AffiliationTransfer>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Source chapter approves the outgoing transfer.")
    @operationId("approveTransferBySource")
    @post
    @route("/{transferId}/approve-source")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "chapter:officer"])
    approveTransferBySource(
      @path transferId: string,
      @body body: TransferDecisionRequest
    ): ApiOkResponse<AffiliationTransfer>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Target chapter approves the incoming transfer.")
    @operationId("approveTransferByTarget")
    @post
    @route("/{transferId}/approve-target")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "chapter:officer"])
    approveTransferByTarget(
      @path transferId: string,
      @body body: TransferDecisionRequest
    ): ApiOkResponse<AffiliationTransfer>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Deny a transfer request.")
    @operationId("denyAffiliationTransfer")
    @post
    @route("/{transferId}/deny")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "chapter:officer"])
    denyAffiliationTransfer(
      @path transferId: string,
      @body body: TransferDecisionRequest
    ): ApiOkResponse<AffiliationTransfer>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Complete an approved transfer, updating affiliation records.")
    @operationId("completeAffiliationTransfer")
    @post
    @route("/{transferId}/complete")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    completeAffiliationTransfer(
      @path transferId: string
    ): ApiOkResponse<AffiliationTransfer>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD and search for dues royalty splits between national and chapter")
  interface RoyaltySplitManagement {
    @doc("Create a new royalty split configuration.")
    @operationId("createRoyaltySplit")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createRoyaltySplit(
      @body body: RoyaltySplitCreateRequest
    ): ApiCreatedResponse<RoyaltySplit>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a royalty split by ID.")
    @operationId("getRoyaltySplit")
    @get
    @route("/{royaltySplitId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getRoyaltySplit(
      @path royaltySplitId: string
    ): ApiOkResponse<RoyaltySplit>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List royalty splits with optional filters.")
    @operationId("listRoyaltySplits")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listRoyaltySplits(
      ...PaginationQuery,
      @query membershipId?: string,
      @query chapterId?: string
    ): ApiOkResponse<PaginatedResponse<RoyaltySplit>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a royalty split configuration.")
    @operationId("updateRoyaltySplit")
    @patch(#{implicitOptionality: true})
    @route("/{royaltySplitId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateRoyaltySplit(
      @path royaltySplitId: string,
      @body updates: RoyaltySplitUpdateRequest
    ): ApiOkResponse<RoyaltySplit>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a royalty split configuration.")
    @operationId("deleteRoyaltySplit")
    @delete
    @route("/{royaltySplitId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteRoyaltySplit(
      @path royaltySplitId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }
}
