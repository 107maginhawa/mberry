import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Invite Module
 *
 * HMAC-signed invitation tokens for org member onboarding.
 * Officers create invites; prospective members validate then claim them.
 *
 * Endpoints:
 *   POST /invite                    — officer creates invite (auth + org context)
 *   GET  /invite/validate/{token}   — public token validation (no auth)
 *   POST /invite/claim/{token}      — authenticated user claims invite
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("Invitation type")
enum InviteType {
  @doc("Officer-sent individual invitation")
  invite: "invite",

  @doc("Bulk-imported member claiming their account")
  claim: "claim",
}

@doc("Invitation status")
enum InviteStatus {
  @doc("Awaiting claim")
  pending: "pending",

  @doc("Successfully claimed")
  claimed: "claimed",

  @doc("Past expiry date")
  expired: "expired",

  @doc("Revoked by officer")
  revoked: "revoked",
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Pre-populated data attached to an invitation for the claim flow")
model InviteMetadata {
  @doc("Pre-populated name from import")
  name?: string;

  @doc("Pre-populated license number from import")
  licenseNumber?: string;

  @doc("Membership category to assign on claim")
  membershipCategoryId?: string;

  @doc("Membership tier to assign on claim")
  membershipTierId?: string;
}

@doc("Request body for creating an invitation")
model CreateInviteRequest {
  @doc("Email address to send the invitation to")
  @format("email")
  email: string;

  @doc("Person ID if inviting an existing person")
  personId?: UUID;

  @doc("Invitation type — 'invite' for officer-sent, 'claim' for bulk import")
  type?: InviteType = InviteType.invite;

  @doc("Personalized message from the officer")
  @maxLength(1000)
  message?: string;

  @doc("Pre-populated data for the claim flow")
  metadata?: InviteMetadata;
}

@doc("Response after successfully creating an invitation")
model CreateInviteResponse {
  @doc("Invitation record ID")
  id: UUID;

  @doc("Raw invite token — shown only once, not stored server-side")
  token: string;

  @doc("Email the invitation was sent to")
  email: string;

  @doc("Invitation type")
  type: string;

  @doc("Token expiration timestamp")
  expiresAt: utcDateTime;

  @doc("Current invitation status")
  status: string;
}

@doc("Successful token validation response with pre-populated claim data")
model ValidateInviteResponse {
  @doc("Whether the token is valid")
  valid: boolean;

  @doc("Email associated with the invitation")
  email: string;

  @doc("Organization ID the invitation belongs to")
  orgId: UUID;

  @doc("Invitation type")
  type: string;

  @doc("Pre-populated data for the claim form")
  metadata?: InviteMetadata;

  @doc("Token expiration timestamp")
  expiresAt: utcDateTime;
}

@doc("Error response when an invitation is no longer claimable")
model InviteGoneResponse {
  @doc("Human-readable error message")
  error: string;

  @doc("Machine-readable error code: ALREADY_CLAIMED, REVOKED, or EXPIRED")
  code: "ALREADY_CLAIMED" | "REVOKED" | "EXPIRED";

  @doc("Organization ID — included for expired invites so user can re-request")
  orgId?: UUID;
}

@doc("Bulk import mode — 'preview' validates without persisting, 'import' creates invites")
enum BulkImportMode {
  @doc("Validate and report without persisting")
  preview: "preview",

  @doc("Persist invitations and issue tokens")
  commit: "import",
}

@doc("Request body for bulk-importing members from CSV")
model BulkImportRequest {
  @doc("Organization to import members into")
  orgId: UUID;

  @doc("Raw CSV content. Expected header columns: email, name, licenseNumber. multipart/form-data is not supported by the codegen pipeline, so CSV is passed inline as a string.")
  @maxLength(1048576)
  csvContent: string;

  @doc("Operation mode — 'preview' to validate only, 'import' to persist")
  mode?: BulkImportMode = BulkImportMode.preview;
}

@doc("A single parsed CSV row with validation outcome")
model BulkImportPreviewRow {
  @doc("1-based row number in the source CSV (excluding header)")
  row: int32;

  @doc("Parsed email address")
  email?: string;

  @doc("Parsed name")
  name?: string;

  @doc("Parsed license number")
  licenseNumber?: string;

  @doc("Row status: valid, invalid, or duplicate")
  status: "valid" | "invalid" | "duplicate";

  @doc("Reason the row is invalid or duplicate")
  reason?: string;
}

@doc("Response for a bulk import in preview mode")
model BulkImportPreviewResponse {
  @doc("Total data rows parsed (excluding header)")
  totalRows: int32;

  @doc("Count of rows that would be imported")
  validRows: int32;

  @doc("Count of rows failing validation")
  invalidRows: int32;

  @doc("Count of rows skipped as duplicates")
  duplicateRows: int32;

  @doc("Per-row preview details")
  preview: BulkImportPreviewRow[];

  @doc("Aggregate error messages")
  errors: string[];
}

@doc("Response for a bulk import in import mode")
model BulkImportResultResponse {
  @doc("Identifier for this import batch")
  importId: UUID;

  @doc("Count of invitations created")
  imported: int32;

  @doc("Count of rows skipped (invalid or duplicate)")
  skipped: int32;

  @doc("Count of invitation tokens issued/sent")
  invitationsSent: int32;
}

@doc("Bulk import response — shape depends on requested mode")
model BulkImportResponse {
  @doc("Echoes the mode the import ran in")
  mode: string;

  @doc("Preview results (present when mode=preview)")
  previewResult?: BulkImportPreviewResponse;

  @doc("Import results (present when mode=import)")
  importResult?: BulkImportResultResponse;
}

@doc("Response after successfully claiming an invitation")
model ClaimInviteResponse {
  @doc("Whether the claim was successful")
  claimed: boolean;

  @doc("Organization the user was invited to")
  organizationId: UUID;

  @doc("Pre-populated data from the invitation")
  metadata?: InviteMetadata;

  @doc("Membership outcome — 'joined' if auto-joined, 'pendingApproval' if org requires approval")
  membershipStatus?: "joined" | "pendingApproval";

  @doc("Membership ID if auto-joined")
  membershipId?: UUID;
}

// ---------------------------------------------------------------------------
// 410 Gone HTTP response model
// ---------------------------------------------------------------------------

@doc("Resource is gone — invitation already claimed, revoked, or expired")
model ApiGoneResponse {
  @statusCode statusCode: 410;

  @doc("Gone error details")
  @body body: InviteGoneResponse;
}

// ---------------------------------------------------------------------------
// Namespace / Interfaces
// ---------------------------------------------------------------------------

namespace InviteModule {

  @doc("Officer-facing invite management (requires authentication + org context)")
  interface InviteManagement {

    @doc("Create an invitation token for a prospective member. Requires officer auth and org context.")
    @operationId("createInvite")
    @post
    @route("/invite")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer"])
    @extension("x-audit", #{ action: "create", resourceType: "invitation" })
    createInvite(
      @body body: CreateInviteRequest
    ): ApiCreatedResponse<CreateInviteResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Bulk-import members from CSV. Preview mode validates and reports duplicates without persisting; import mode creates invitations and issues claim tokens. Requires officer auth and org context.")
    @operationId("bulkImportMembers")
    @post
    @route("/invitations/bulk-import")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["officer"])
    @extension("x-audit", #{ action: "create", resourceType: "invitation" })
    bulkImportMembers(
      @body body: BulkImportRequest
    ): ApiOkResponse<BulkImportResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Public and authenticated invite token endpoints")
  interface InviteTokenEndpoints {

    @doc("Validate an invite token without claiming it. Public endpoint — no auth required. Returns pre-populated data for the claim form.")
    @operationId("validateInvite")
    @get
    @route("/invite/validate/{token}")
    validateInvite(
      @path token: string
    ): ApiOkResponse<ValidateInviteResponse>
      | ApiGoneResponse
      | ApiNotFoundResponse;

    @doc("Claim an invitation token, activating the user's membership. User must be authenticated.")
    @operationId("claimInvite")
    @post
    @route("/invite/claim/{token}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "complete", resourceType: "invitation" })
    claimInvite(
      @path token: string
    ): ApiOkResponse<ClaimInviteResponse>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiGoneResponse;
  }
}
