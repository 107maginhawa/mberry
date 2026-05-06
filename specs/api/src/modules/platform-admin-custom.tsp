import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Platform Admin Custom Module
 *
 * Custom endpoints not generated from standard CRUD scaffolding:
 *   GET /public/org/:slug   — public org lookup (no auth)
 *   GET /admin/me/role      — platform admin identity (requires platform_admin)
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Public organisation profile returned from the slug lookup")
model PublicOrganization {
  @doc("Organisation ID")
  id: UUID;

  @doc("Organisation display name")
  name: string;

  @doc("URL-safe slug used to identify the organisation publicly")
  slug: string;

  @doc("Organisation type: chapter, society, national, or clinic")
  orgType: string;

  @doc("Geographic region")
  region?: string;

  @doc("Public contact email")
  contactEmail?: string;

  @doc("Lifecycle status of the organisation")
  status: string;

  @doc("Name of the parent association")
  associationName?: string;

  @doc("Count of active members (publicly visible)")
  memberCount: int32;
}

@doc("Platform admin identity response")
model AdminRoleResponse {
  @doc("Platform admin role: super, support, or analyst")
  role: string;

  @doc("Email address of the platform admin")
  email: string;

  @doc("Display name of the platform admin")
  name: string;
}

// ---------------------------------------------------------------------------
// Namespace / Interfaces
// ---------------------------------------------------------------------------

namespace PlatformAdminCustomModule {
  interface PublicEndpoints {

    @doc("Look up an organisation by its public slug. No authentication required.")
    @operationId("getOrganizationBySlug")
    @get
    @route("/public/org/{slug}")
    getOrganizationBySlug(
      @path slug: string
    ): ApiOkResponse<PublicOrganization>
      | ApiNotFoundResponse;
  }

  interface AdminIdentityEndpoints {

    @doc("Get the authenticated platform admin's role and identity. Requires platform_admin auth.")
    @operationId("getAdminRole")
    @get
    @route("/admin/me/role")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    getAdminRole(): ApiOkResponse<AdminRoleResponse>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
