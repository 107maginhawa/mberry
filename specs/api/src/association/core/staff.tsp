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
 * Domain 6 — Staff Workforce Management
 *
 * Manages staff members who operate the association backend: their roles,
 * employment type, lifecycle status, and the invitation flow used to
 * onboard new staff without requiring a pre-existing person record.
 */
namespace Association.Core.Staff;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Functional role of a staff member within the association.")
enum StaffRole {
  @doc("Full system administrator.")
  admin: "admin",

  @doc("Event or program coordinator.")
  coordinator: "coordinator",

  @doc("Accountant with billing and financial access.")
  accountant: "accountant",

  @doc("Executive officer (e.g. CEO, ED).")
  executive: "executive",

  @doc("General support staff.")
  support: "support",

  @doc("Custom role defined per-tenant.")
  custom: "custom",
}

@doc("Nature of the employment relationship.")
enum EmploymentType {
  @doc("Permanent full-time employee.")
  fullTime: "fullTime",

  @doc("Permanent part-time employee.")
  partTime: "partTime",

  @doc("Fixed-term contractor.")
  contract: "contract",

  @doc("Unpaid volunteer with staff-level access.")
  volunteer: "volunteer",
}

@doc("Lifecycle status of a staff member record.")
enum StaffStatus {
  @doc("Invitation sent but not yet accepted.")
  invited: "invited",

  @doc("Actively employed and able to log in.")
  active: "active",

  @doc("Currently on approved leave.")
  onLeave: "onLeave",

  @doc("Employment ended; access revoked.")
  terminated: "terminated",
}

@doc("Status of an outstanding staff invitation.")
enum InvitationStatus {
  @doc("Awaiting the invitee's action.")
  pending: "pending",

  @doc("Invitation was accepted and the staff record activated.")
  accepted: "accepted",

  @doc("Invitation passed its expiry timestamp without being accepted.")
  expired: "expired",

  @doc("Invitation was manually revoked by an administrator.")
  revoked: "revoked",
}

// ---------------------------------------------------------------------------
// Core models
// ---------------------------------------------------------------------------

@doc("A staff member attached to the association's operational team.")
model StaffMember extends AssociationBaseEntity {
  @doc("Person record this staff member maps to.")
  personId: string;

  @doc("Organisation this staff member primarily belongs to (HQ or chapter).")
  organizationId: string;

  @doc("Functional role governing access permissions.")
  role: StaffRole;

  @doc("Job title as it appears on communications and the staff directory.")
  title?: string;

  @doc("Nature of the employment relationship.")
  employmentType: EmploymentType;

  @doc("Date on which the staff member started (or will start) in this role.")
  startDate: plainDate;

  @doc("Date on which the staff member's tenure ends. Omit for indefinite employment.")
  endDate?: plainDate;

  @doc("Current lifecycle status.")
  status: StaffStatus;

  @doc("One-time token included in the invitation email, valid until invitationExpiresAt.")
  invitationToken?: string;

  @doc("Expiry timestamp of the invitation token.")
  invitationExpiresAt?: utcDateTime;
}

@doc("A pending invitation for a new staff member.")
model StaffInvitation extends AssociationBaseEntity {
  @doc("Email address the invitation was sent to.")
  email: string;

  @doc("Role that will be assigned upon acceptance.")
  role: StaffRole;

  @doc("Staff member ID of the person who sent this invitation.")
  invitedBy: string;

  @doc("Secure one-time token embedded in the invitation link.")
  token: string;

  @doc("Timestamp after which the token is no longer valid.")
  expiresAt: utcDateTime;

  @doc("Current status of the invitation.")
  status: InvitationStatus;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a new staff member record directly (without invitation flow).")
model StaffMemberCreateRequest {
  @doc("Person record to attach.")
  personId: string;

  @doc("Organisation this staff member belongs to.")
  organizationId: string;

  @doc("Functional role.")
  role: StaffRole;

  @doc("Job title.")
  title?: string;

  @doc("Employment type.")
  employmentType: EmploymentType;

  @doc("Start date.")
  startDate: plainDate;

  @doc("End date (optional).")
  endDate?: plainDate;
}

@doc("Partial update payload for a staff member record.")
model StaffMemberUpdateRequest {
  @doc("Functional role.")
  role?: StaffRole;

  @doc("Job title — pass null to clear.")
  title?: string | null;

  @doc("Employment type.")
  employmentType?: EmploymentType;

  @doc("Start date.")
  startDate?: plainDate;

  @doc("End date — pass null to clear.")
  endDate?: plainDate | null;

  @doc("Current status.")
  status?: StaffStatus;
}

@doc("Request body to issue a staff invitation.")
model StaffInviteRequest {
  @doc("Email address to send the invitation to.")
  email: string;

  @doc("Role to assign upon acceptance.")
  role: StaffRole;

  @doc("Organisation the invitee will belong to.")
  organizationId: string;

  @doc("Optional job title pre-filled on acceptance.")
  title?: string;

  @doc("Employment type.")
  employmentType: EmploymentType;

  @doc("Planned start date.")
  startDate: plainDate;
}

@doc("Query parameters for searching staff members.")
model StaffMemberSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by organisation.")
  @query
  organizationId?: string;

  @doc("Filter by role.")
  @query
  role?: StaffRole;

  @doc("Filter by employment type.")
  @query
  employmentType?: EmploymentType;

  @doc("Filter by status.")
  @query
  status?: StaffStatus;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@route("/association/staff")
@tag("Staff")
namespace StaffManagement {
  interface StaffManagement {
    @doc("Create a staff member record directly.")
    @operationId("createStaffMember")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive"])
    createStaffMember(
      @body body: StaffMemberCreateRequest
    ): ApiCreatedResponse<StaffMember>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a staff member by ID.")
    @operationId("getStaffMember")
    @get
    @route("/{staffMemberId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "coordinator", "support"])
    getStaffMember(
      @path staffMemberId: string
    ): ApiOkResponse<StaffMember>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a staff member record.")
    @operationId("updateStaffMember")
    @patch(#{implicitOptionality: true})
    @route("/{staffMemberId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive"])
    updateStaffMember(
      @path staffMemberId: string,
      @body updates: StaffMemberUpdateRequest
    ): ApiOkResponse<StaffMember>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete (hard-delete) a staff member record.")
    @operationId("deleteStaffMember")
    @delete
    @route("/{staffMemberId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteStaffMember(
      @path staffMemberId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search / list staff members.")
    @operationId("searchStaffMembers")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "coordinator"])
    searchStaffMembers(
      ...StaffMemberSearchParams
    ): ApiOkResponse<PaginatedResponse<StaffMember>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Send a staff invitation to an email address.")
    @operationId("inviteStaffMember")
    @post
    @route("/invitations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive"])
    inviteStaffMember(
      @body body: StaffInviteRequest
    ): ApiCreatedResponse<StaffInvitation>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Deactivate (terminate) a staff member, revoking their access.")
    @operationId("deactivateStaffMember")
    @post
    @route("/{staffMemberId}/deactivate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive"])
    deactivateStaffMember(
      @path staffMemberId: string
    ): ApiOkResponse<StaffMember>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
