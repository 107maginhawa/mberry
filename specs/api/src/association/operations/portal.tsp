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
 * Domain 51: Member Portal & Self-Service
 *
 * Covers portal user account management, the in-portal message inbox,
 * and CE transcript generation and PDF download.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Status of a member portal user account")
enum PortalUserStatus {
  @doc("Registration is complete but email/account not yet verified")
  pending: "pending",

  @doc("Account is active and usable")
  active: "active",

  @doc("Account is locked due to failed authentication attempts or policy")
  locked: "locked",

  @doc("Account has been administratively deactivated")
  deactivated: "deactivated",
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("A member's self-service portal account")
model PortalUser extends BaseEntity {
  @doc("Tenant this portal user belongs to")
  organizationId: string;

  @doc("Linked person record")
  personId: string;

  @doc("Portal login email address")
  @format("email")
  email: string;

  @doc("Current portal account status")
  status: PortalUserStatus;

  @doc("UTC timestamp when the portal account was created")
  registeredAt: utcDateTime;

  @doc("UTC timestamp of the most recent successful login")
  lastLoginAt?: utcDateTime;

  @doc("Whether multi-factor authentication is enabled")
  mfaEnabled: boolean;

  @doc("UTC timestamp when the member accepted the current terms of service")
  termsAcceptedAt?: utcDateTime;
}

@doc("An inbox item linking a portal user to a system or direct message")
model PortalInbox extends BaseEntity {
  @doc("Tenant this inbox item belongs to")
  organizationId: string;

  @doc("Portal user who owns this inbox item")
  userId: string;

  @doc("Referenced message identifier (from the notifications or messaging system)")
  messageId: string;

  @doc("Whether the message has been read")
  read: boolean;

  @doc("UTC timestamp when the message was marked as read")
  readAt?: utcDateTime;

  @doc("Whether the message has been archived")
  archived: boolean;
}

// ---------------------------------------------------------------------------
// CE Transcript Value Objects (read-only projection, not persisted as entities)
// ---------------------------------------------------------------------------

@doc("Individual CE credit entry within a transcript cycle")
model TranscriptEntry {
  @doc("Name of the activity that awarded the credit")
  activityName: string;

  @doc("Number of CE credits earned")
  @minValue(0)
  credits: float64;

  @doc("Date the credit was earned")
  earnedDate: plainDate;

  @doc("Optional CE credit category or domain")
  @maxLength(100)
  category?: string;

  @doc("Source system or record that originated this credit entry (e.g., 'TrainingEnrollment:uuid')")
  provenance: string;
}

@doc("CE credit summary for a single compliance cycle")
model CycleTranscript {
  @doc("Compliance cycle identifier")
  cycleId: string;

  @doc("Human-readable period label (e.g., '2024-2026')")
  period: string;

  @doc("Total CE credits required in this cycle")
  @minValue(0)
  requiredCredits: float64;

  @doc("Total CE credits earned in this cycle")
  @minValue(0)
  earnedCredits: float64;

  @doc("Individual credit earning entries within this cycle")
  entries: TranscriptEntry[];
}

@doc("Complete CE transcript for a member across all cycles")
model CETranscript {
  @doc("Person whose transcript this is")
  personId: string;

  @doc("Ordered list of cycle transcripts (most recent first)")
  cycles: CycleTranscript[];
}

@doc("Reference to a generated transcript PDF")
model CETranscriptPdf {
  @doc("Signed download URL for the PDF (short-lived)")
  downloadUrl: string;

  @doc("UTC timestamp when the download URL expires")
  expiresAt: utcDateTime;

  @doc("Total size of the PDF in bytes")
  @minValue(0)
  sizeBytes: int32;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a portal user account")
model PortalUserCreateRequest {
  @doc("Linked person record")
  personId: string;

  @doc("Portal login email address")
  @format("email")
  email: string;
}

@doc("Request body for updating a portal user account")
model PortalUserUpdateRequest {
  @doc("Portal login email address")
  @format("email")
  email?: string;

  @doc("Portal account status")
  status?: PortalUserStatus;

  @doc("Whether MFA is enabled")
  mfaEnabled?: boolean;
}

@doc("Query parameters for portal user search")
model PortalUserSearchParams {
  ...PaginationQuery;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by account status")
  @query
  status?: PortalUserStatus;
}

@doc("Request body for marking an inbox item as read")
model MarkReadRequest {
  @doc("List of inbox item IDs to mark as read")
  ids: string[];
}

@doc("Request body for archiving inbox items")
model ArchiveRequest {
  @doc("List of inbox item IDs to archive")
  ids: string[];
}

@doc("Query parameters for inbox listing")
model InboxListParams {
  ...PaginationQuery;

  @doc("Filter by user")
  @query
  userId?: string;

  @doc("Filter by read status")
  @query
  read?: boolean;

  @doc("Filter by archived status")
  @query
  archived?: boolean;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/portal")
@tag("Association:Operations")
namespace Association.Operations.Portal {

  /**
   * Portal user account management.
   */
  @useAuth(bearerAuth)
  interface PortalUserManagement {
    @doc("Create a new portal user account.")
    @operationId("createPortalUser")
    @post
    @route("/users")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createPortalUser(
      @body body: PortalUserCreateRequest
    ): ApiCreatedResponse<PortalUser>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a portal user by ID.")
    @operationId("getPortalUser")
    @get
    @route("/users/{userId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getPortalUser(
      @path userId: string
    ): ApiOkResponse<PortalUser>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a portal user account.")
    @operationId("updatePortalUser")
    @patch(#{implicitOptionality: true})
    @route("/users/{userId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    updatePortalUser(
      @path userId: string,
      @body updates: PortalUserUpdateRequest
    ): ApiOkResponse<PortalUser>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate a portal user account.")
    @operationId("deletePortalUser")
    @delete
    @route("/users/{userId}")
    @extension("x-security-required-roles", #["association:admin"])
    deletePortalUser(
      @path userId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search portal users with filtering and pagination.")
    @operationId("searchPortalUsers")
    @get
    @route("/users")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchPortalUsers(
      ...PortalUserSearchParams
    ): ApiOkResponse<PaginatedResponse<PortalUser>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * In-portal message inbox management.
   */
  @useAuth(bearerAuth)
  interface PortalInboxManagement {
    @doc("List inbox items for a portal user.")
    @operationId("listInboxItems")
    @get
    @route("/inbox")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    listInboxItems(
      ...InboxListParams
    ): ApiOkResponse<PaginatedResponse<PortalInbox>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Mark one or more inbox items as read.")
    @operationId("markInboxItemsRead")
    @post
    @route("/inbox/mark-read")
    @extension("x-security-required-roles", #["association:member:owner"])
    markInboxItemsRead(
      @body body: MarkReadRequest
    ): ApiOkResponse<PaginatedResponse<PortalInbox>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Archive one or more inbox items.")
    @operationId("archiveInboxItems")
    @post
    @route("/inbox/archive")
    @extension("x-security-required-roles", #["association:member:owner"])
    archiveInboxItems(
      @body body: ArchiveRequest
    ): ApiOkResponse<PaginatedResponse<PortalInbox>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * CE transcript self-service — read-only projection built from credit ledger data.
   */
  @useAuth(bearerAuth)
  interface CETranscriptService {
    @doc("Get the complete CE transcript for a member.")
    @operationId("getCETranscript")
    @get
    @route("/transcript/{personId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getCETranscript(
      @path personId: string
    ): ApiOkResponse<CETranscript>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Generate and return a signed download URL for a PDF transcript.")
    @operationId("downloadCETranscriptPdf")
    @post
    @route("/transcript/{personId}/pdf")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    downloadCETranscriptPdf(
      @path personId: string
    ): ApiCreatedResponse<CETranscriptPdf>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
