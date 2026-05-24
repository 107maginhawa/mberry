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

@doc("Paginated list of public organisations with metadata")
model PublicOrgListResponse {
  @doc("Array of public organisation profiles")
  data: PublicOrganization[];

  @doc("Pagination metadata")
  meta: {
    @doc("Total matching organisations")
    total: int32;

    @doc("Applied page size")
    limit: int32;

    @doc("Applied offset")
    offset: int32;
  };
}

@doc("Chapter-level aggregate metrics for the national dashboard")
model ChapterMetrics {
  @doc("Organization (chapter) ID")
  orgId: string;

  @doc("Chapter display name")
  chapterName?: string;

  @doc("Total members in the chapter")
  totalMembers: int32;

  @doc("Active (paid) members")
  activeMembers: int32;

  @doc("Members in grace period")
  graceMembers: int32;

  @doc("Lapsed members")
  lapsedMembers: int32;

  @doc("Suspended members")
  suspendedMembers: int32;

  @doc("Dues collection rate (0-1)")
  collectionRate: float64;

  @doc("Total dues collected in the period")
  totalCollected: float64;

  @doc("Total dues expected in the period")
  totalExpected: float64;

  @doc("CPD compliance rate (0-1)")
  cpdComplianceRate: float64;

  @doc("Average credits per member")
  avgCreditsPerMember: float64;

  @doc("Activity count in the last 90 days")
  activityCount90d: int32;
}

@doc("National dashboard response with cross-chapter aggregates")
model NationalDashboardResponse {
  @doc("Association ID")
  associationId: string;

  @doc("Snapshot month (YYYY-MM)")
  snapshotMonth: string;

  @doc("Association-level aggregate metrics")
  aggregate: Record<unknown>;

  @doc("Per-chapter metrics (small chapters anonymised)")
  chapters: ChapterMetrics[];
}

@doc("Committee summary for cross-org committee listing")
model CommitteeSummary {
  @doc("Committee ID")
  id: string;

  @doc("Committee name")
  name: string;

  @doc("Organization ID")
  organizationId?: string;

  @doc("Committee type or category")
  type?: string;

  @doc("Number of members in the committee")
  memberCount?: int32;

  @doc("Committee status")
  status?: string;
}

@doc("Committee detail with member list")
model CommitteeDetail extends CommitteeSummary {
  @doc("Description of the committee's purpose")
  description?: string;

  @doc("Committee member list")
  members?: Record<unknown>[];
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

    @doc("List all active public organisations with optional search. No authentication required.")
    @operationId("listPublicOrgs")
    @get
    @route("/public/orgs")
    listPublicOrgs(
      @doc("Search term to filter organisation names")
      @query search?: string,

      @doc("Page size (1-100, default 25)")
      @query limit?: int32,

      @doc("Offset for pagination (default 0)")
      @query offset?: int32,
    ): ApiOkResponse<PublicOrgListResponse>;
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

  @doc("National dashboard and cross-org committee endpoints for platform admins and designated national officers")
  interface AdminDashboardEndpoints {

    @doc("Get cross-chapter aggregate metrics for a national association dashboard. Accessible to platform admins and designated national officers only (BR-36). Small chapters (<5 members) are anonymised.")
    @operationId("getNationalDashboard")
    @get
    @route("/admin/national-dashboard/{associationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin", "national_officer"])
    getNationalDashboard(
      @path associationId: string,
      @doc("Snapshot month in YYYY-MM format (defaults to current month)")
      @query snapshotMonth?: string,
    ): ApiOkResponse<{ data: NationalDashboardResponse }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List all committees across all organisations. Platform admin only.")
    @operationId("listAllCommittees")
    @get
    @route("/admin/committees")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    listAllCommittees(
      @doc("Page size (1-500, default 100)")
      @query limit?: int32,
      @doc("Offset for pagination (default 0)")
      @query offset?: int32,
    ): ApiOkResponse<{ data: CommitteeSummary[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a committee by ID with full detail including members.")
    @operationId("getCommittee")
    @get
    @route("/admin/committees/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    getCommittee(
      @path id: string,
    ): ApiOkResponse<{ data: CommitteeDetail }>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
