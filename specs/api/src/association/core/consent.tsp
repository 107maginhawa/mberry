import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "./primitives.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Domain 13 — Consent & Preferences
 *
 * Governs the association's legal and regulatory obligations around member
 * consent: versioned consent templates, auditable per-person consent records
 * (with withdrawal support), and GDPR/data-privacy deletion requests.
 */
namespace Association.Core.Consent;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Category of consent being captured.")
enum ConsentCategory {
  @doc("General terms of service acceptance.")
  termsOfService: "termsOfService",

  @doc("Privacy policy acknowledgement.")
  privacyPolicy: "privacyPolicy",

  @doc("Opt-in to marketing and promotional communications.")
  marketingCommunications: "marketingCommunications",

  @doc("Permission to share personal data with partner organisations.")
  dataSharing: "dataSharing",

  @doc("Permission to pass data to named third-party systems.")
  thirdPartyAccess: "thirdPartyAccess",

  @doc("Permission to photograph or record the member at events.")
  photographRelease: "photographRelease",

  @doc("Acknowledgement of the association's code of conduct.")
  codeOfConduct: "codeOfConduct",
}

@doc("Lifecycle status of a consent template.")
enum ConsentTemplateStatus {
  @doc("Under construction; not yet visible to members.")
  draft: "draft",

  @doc("Live and being presented to members.")
  published: "published",

  @doc("Replaced by a newer version; no longer presented.")
  superseded: "superseded",
}

@doc("The person's decision on a consent request.")
enum ConsentDecision {
  @doc("Person gave explicit consent.")
  accepted: "accepted",

  @doc("Person explicitly declined consent.")
  declined: "declined",

  @doc("Person previously accepted but has since withdrawn their consent.")
  withdrawn: "withdrawn",
}

@doc("Processing status of a data deletion request.")
enum DeletionStatus {
  @doc("Request received and acknowledged.")
  received: "received",

  @doc("Identity of the requester is being verified.")
  verifying: "verifying",

  @doc("Data erasure is actively in progress.")
  processing: "processing",

  @doc("All applicable data has been erased.")
  completed: "completed",

  @doc("Request was denied (e.g. legal retention obligations).")
  denied: "denied",
}

// ---------------------------------------------------------------------------
// Core entity models
// ---------------------------------------------------------------------------

@doc("A versioned legal template presented to members for their consent decision.")
model ConsentTemplate extends AssociationBaseEntity {
  @doc("Display title shown to the member (e.g. 'Terms of Service — v3.2').")
  title: string;

  @doc("Full legal body text of the consent document.")
  body: string;

  @doc("Semantic version of this template (e.g. '3.2', '2024-10').")
  templateVersion: string;

  @doc("Category of consent this template represents.")
  category: ConsentCategory;

  @doc("Lifecycle status.")
  status: ConsentTemplateStatus;

  @doc("Timestamp at which this template was published and made live.")
  publishedAt?: utcDateTime;

  @doc("ID of the newer template that supersedes this one (if any).")
  supersededBy?: string;
}

@doc("An auditable record of a person's consent decision for a specific template version.")
model ConsentRecord extends AssociationBaseEntity {
  @doc("Person who made the decision.")
  personId: string;

  @doc("Consent template the decision relates to.")
  templateId: string;

  @doc("Exact version of the template at the time of the decision (immutable).")
  templateVersion: string;

  @doc("The person's decision.")
  decision: ConsentDecision;

  @doc("Timestamp at which the decision was recorded.")
  recordedAt: utcDateTime;

  @doc("IP address from which the decision was submitted (for legal proof of consent).")
  ipAddress?: string;

  @doc("Device / user-agent string at the time of consent (for legal proof).")
  deviceInfo?: string;

  @doc("Timestamp at which a previously accepted consent was withdrawn.")
  withdrawnAt?: utcDateTime;

  @doc("Reason provided by the member when withdrawing consent.")
  withdrawnReason?: string;
}

@doc("A formal request by a member to have their personal data erased (GDPR right to erasure).")
model DataDeletionRequest extends AssociationBaseEntity {
  @doc("Person requesting erasure of their data.")
  personId: string;

  @doc("Timestamp at which the request was submitted.")
  requestedAt: utcDateTime;

  @doc("Optional reason provided by the member.")
  reason?: string;

  @doc("Current processing status.")
  status: DeletionStatus;

  @doc("Timestamp at which the erasure was fully completed.")
  completedAt?: utcDateTime;

  @doc("Explanation provided when the request was denied.")
  deniedReason?: string;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a consent template.")
model ConsentTemplateCreateRequest {
  @doc("Display title.")
  title: string;

  @doc("Legal body text.")
  body: string;

  @doc("Semantic version string.")
  templateVersion: string;

  @doc("Consent category.")
  category: ConsentCategory;
}

@doc("Partial update for a consent template (only drafts may be updated).")
model ConsentTemplateUpdateRequest {
  @doc("Display title.")
  title?: string;

  @doc("Legal body text.")
  body?: string;

  @doc("Semantic version string.")
  version?: string;
}

@doc("Request body to record a consent decision.")
model ConsentRecordCreateRequest {
  @doc("Person making the decision.")
  personId: string;

  @doc("Template the decision relates to.")
  templateId: string;

  @doc("The decision (accepted or declined; withdrawn is set via the withdraw endpoint).")
  decision: ConsentDecision;

  @doc("IP address of the submission (captured server-side if not provided).")
  ipAddress?: string;

  @doc("Device / user-agent string of the submission.")
  deviceInfo?: string;
}

@doc("Request body to withdraw a previously accepted consent.")
model ConsentWithdrawRequest {
  @doc("Optional reason for withdrawal.")
  reason?: string;
}

@doc("Request body to submit a data deletion request.")
model DataDeletionRequestCreateRequest {
  @doc("Person requesting erasure.")
  personId: string;

  @doc("Optional reason.")
  reason?: string;
}

@doc("Query parameters for searching consent templates.")
model ConsentTemplateSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by category.")
  @query
  category?: ConsentCategory;

  @doc("Filter by status.")
  @query
  status?: ConsentTemplateStatus;
}

@doc("Query parameters for searching consent records.")
model ConsentRecordSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by person ID.")
  @query
  personId?: string;

  @doc("Filter by template ID.")
  @query
  templateId?: string;

  @doc("Filter by decision.")
  @query
  decision?: ConsentDecision;

  @doc("Records created on or after this timestamp.")
  @query
  recordedAfter?: utcDateTime;
}

@doc("Query parameters for searching deletion requests.")
model DataDeletionRequestSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by person ID.")
  @query
  personId?: string;

  @doc("Filter by status.")
  @query
  status?: DeletionStatus;

  @doc("Requests submitted on or after this date.")
  @query
  requestedAfter?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/consent-templates")
@tag("Consent")
namespace ConsentTemplateManagement {
  interface ConsentTemplateManagement {
    @doc("Create a consent template.")
    @operationId("createConsentTemplate")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    createConsentTemplate(
      @body body: ConsentTemplateCreateRequest
    ): ApiCreatedResponse<ConsentTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a consent template by ID.")
    @operationId("getConsentTemplate")
    @get
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    getConsentTemplate(
      @path templateId: string
    ): ApiOkResponse<ConsentTemplate>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a draft consent template.")
    @operationId("updateConsentTemplate")
    @patch(#{implicitOptionality: true})
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    updateConsentTemplate(
      @path templateId: string,
      @body updates: ConsentTemplateUpdateRequest
    ): ApiOkResponse<ConsentTemplate>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a draft consent template.")
    @operationId("deleteConsentTemplate")
    @delete
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteConsentTemplate(
      @path templateId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list consent templates.")
    @operationId("searchConsentTemplates")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    searchConsentTemplates(
      ...ConsentTemplateSearchParams
    ): ApiOkResponse<PaginatedResponse<ConsentTemplate>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Publish a consent template, making it live for members.")
    @operationId("publishConsentTemplate")
    @post
    @route("/{templateId}/publish")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    publishConsentTemplate(
      @path templateId: string
    ): ApiOkResponse<ConsentTemplate>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/consent-records")
@tag("Consent")
namespace ConsentRecordManagement {
  interface ConsentRecordManagement {
    @doc("Record a consent decision from a person.")
    @operationId("createConsentRecord")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner", "system"])
    createConsentRecord(
      @body body: ConsentRecordCreateRequest
    ): ApiCreatedResponse<ConsentRecord>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list consent records.")
    @operationId("searchConsentRecords")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    searchConsentRecords(
      ...ConsentRecordSearchParams
    ): ApiOkResponse<PaginatedResponse<ConsentRecord>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Withdraw a previously accepted consent record.")
    @operationId("withdrawConsentRecord")
    @post
    @route("/{recordId}/withdraw")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner"])
    withdrawConsentRecord(
      @path recordId: string,
      @body body: ConsentWithdrawRequest
    ): ApiOkResponse<ConsentRecord>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/data-deletion-requests")
@tag("Consent")
namespace DataDeletionRequestManagement {
  interface DataDeletionRequestManagement {
    @doc("Submit a data deletion (right-to-erasure) request.")
    @operationId("createDataDeletionRequest")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner"])
    createDataDeletionRequest(
      @body body: DataDeletionRequestCreateRequest
    ): ApiCreatedResponse<DataDeletionRequest>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Search and list data deletion requests.")
    @operationId("searchDataDeletionRequests")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    searchDataDeletionRequests(
      ...DataDeletionRequestSearchParams
    ): ApiOkResponse<PaginatedResponse<DataDeletionRequest>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the current status of a data deletion request.")
    @operationId("getDataDeletionRequestStatus")
    @get
    @route("/{requestId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner"])
    getDataDeletionRequestStatus(
      @path requestId: string
    ): ApiOkResponse<DataDeletionRequest>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
