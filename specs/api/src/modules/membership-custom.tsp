import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Membership Custom Module
 *
 * Officer-facing dashboard endpoints for membership management.
 * Routes under /membership — require auth + officer role.
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Organisation profile as returned by the membership module")
model OrgProfile {
  @doc("Organisation ID")
  id: UUID;

  @doc("Organisation display name")
  name: string;

  @doc("URL-safe slug")
  slug?: string;

  @doc("Organisation type")
  orgType?: string;

  @doc("Geographic region")
  region?: string;

  @doc("Contact email")
  contactEmail?: string;

  @doc("Website URL")
  website?: string;

  @doc("Lifecycle status")
  status?: string;

  @doc("Timestamp of last update")
  updatedAt?: utcDateTime;
}

@doc("Request body for updating an organisation profile")
model MembershipUpdateOrgProfileRequest {
  @doc("Organisation display name")
  @maxLength(255)
  name?: string;

  @doc("Contact email")
  contactEmail?: string;

  @doc("Website URL")
  website?: string;

  @doc("Geographic region")
  region?: string;
}

@doc("A member record with joined person details for officer dashboards")
model MemberSummary {
  @doc("Membership record ID")
  id: UUID;

  @doc("Person ID")
  personId: UUID;

  @doc("First name from the person record")
  firstName?: string;

  @doc("Last name from the person record")
  lastName?: string;

  @doc("Current membership status")
  status: string;

  @doc("Member number assigned by the organisation")
  memberNumber?: string;

  @doc("Date when dues expire")
  duesExpiryDate?: utcDateTime;

  @doc("Membership category ID")
  categoryId?: UUID;
}

@doc("A membership application record")
model MembershipApplicationSummary {
  @doc("Application record ID")
  id: UUID;

  @doc("Person ID of the applicant")
  personId: UUID;

  @doc("Organisation the application is for")
  organizationId: UUID;

  @doc("Application status")
  status: string;

  @doc("Date the application was submitted")
  createdAt?: utcDateTime;

  @doc("Date the application was last updated")
  updatedAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Namespace / Interface
// ---------------------------------------------------------------------------

@tag("Membership")
namespace MembershipCustomModule {
  interface MembershipCustomManagement {
    @doc("Get organisation profile for the specified org.")
    @operationId("getOrgProfile")
    @get
    @route("/membership/org-profile/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getOrgProfile(
      @path @doc("Organisation ID") organizationId: UUID
    ): ApiOkResponse<OrgProfile>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("Update organisation profile (president only).")
    @operationId("updateOrgProfile")
    @put
    @route("/membership/org-profile/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateOrgProfile(
      @path @doc("Organisation ID") organizationId: UUID,
      @body updates: MembershipUpdateOrgProfileRequest
    ): ApiOkResponse<OrgProfile>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("List all members of an organisation with person details (officer dashboard).")
    @operationId("listOrgMembers")
    @get
    @route("/membership/members/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listOrgMembers(
      @path @doc("Organisation ID") organizationId: UUID
    ): ApiOkResponse<{ data: MemberSummary[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List membership applications for an organisation with optional status filter (officer dashboard).")
    @operationId("listOrgApplications")
    @get
    @route("/membership/applications/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listOrgApplications(
      @path @doc("Organisation ID") organizationId: UUID,
      @query @doc("Filter by application status") status?: string
    ): ApiOkResponse<{ data: MembershipApplicationSummary[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
