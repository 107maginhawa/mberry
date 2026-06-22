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

@doc("Per-chapter comparative metrics row for the chapter comparison list (S10 row 2)")
model ChapterComparisonItem {
  @doc("Chapter organization ID")
  organizationId: string;

  @doc("Chapter display name")
  organizationName?: string;

  @doc("Total member count")
  totalMembers: int32;

  @doc("Active (paid) member count")
  activeMembers: int32;

  @doc("Active members as a percentage of total (0-100)")
  activePercentage: float64;

  @doc("Dues collection rate as a percentage (0-100)")
  collectionRate: float64;

  @doc("Credit (CPD) compliance as a percentage (0-100)")
  creditCompliance: float64;

  @doc("Total dues revenue in cents")
  totalRevenueCents: int32;

  @doc("Events held in the period")
  eventCount: int32;

  @doc("Trainings held in the period")
  trainingCount: int32;

  @doc("True when the chapter has fewer than 5 members; individual metrics are suppressed (M14-R2)")
  isSuppressed: boolean;
}

@doc("Cursor pagination metadata for national dashboard list endpoints")
model NationalListMeta {
  @doc("Opaque cursor for the next page; null when no further pages")
  cursor: string | null;

  @doc("Whether more results exist beyond this page")
  hasMore: boolean;

  @doc("Total matching record count")
  total: int32 | null;
}

@doc("Paginated chapter comparison list response")
model ChapterComparisonListResponse {
  @doc("Chapter comparison rows")
  data: ChapterComparisonItem[];

  @doc("Pagination metadata")
  meta: NationalListMeta;
}

@doc("Member status distribution for a chapter drill-down")
model MemberStatusBreakdown {
  active: int32;
  grace: int32;
  lapsed: int32;
  suspended: int32;
}

@doc("Credit compliance distribution for a chapter drill-down")
model CreditComplianceBreakdown {
  @doc("Members meeting credit requirements")
  compliant: int32;

  @doc("Members not meeting credit requirements")
  nonCompliant: int32;

  @doc("Members exempt from credit requirements")
  exempt: int32;
}

@doc("Detailed metrics for a single chapter (WF-085 drill-down)")
model ChapterDrilldownResponse {
  @doc("Chapter organization ID")
  organizationId: string;

  @doc("Chapter display name")
  organizationName?: string;

  @doc("Total member count")
  totalMembers: int32;

  @doc("Active member count")
  activeMembers: int32;

  @doc("Active members as a percentage of total (0-100)")
  activePercentage: float64;

  @doc("Member status distribution")
  memberStatusBreakdown: MemberStatusBreakdown;

  @doc("Dues collection rate as a percentage (0-100)")
  collectionRate: float64;

  @doc("Total dues revenue in cents")
  totalRevenueCents: int32;

  @doc("Credit (CPD) compliance as a percentage (0-100)")
  creditCompliance: float64;

  @doc("Credit compliance distribution")
  creditComplianceBreakdown: CreditComplianceBreakdown;

  @doc("Events held in the period")
  eventCount: int32;

  @doc("Trainings held in the period")
  trainingCount: int32;

  @doc("Snapshot month (YYYY-MM)")
  snapshotMonth: string;

  @doc("True when the chapter has fewer than 5 members (M14-R2)")
  isSuppressed: boolean;
}

@doc("Platform-wide per-association summary row (S10 row 5)")
model PlatformAssociationSummary {
  @doc("Association ID")
  associationId: string;

  @doc("Association display name")
  associationName?: string;

  @doc("Number of chapters in the association")
  chapterCount: int32;

  @doc("Total member count across all chapters")
  totalMembers: int32;

  @doc("Active member count across all chapters")
  activeMembers: int32;

  @doc("Dues collection rate as a percentage (0-100)")
  collectionRate: float64;

  @doc("Credit (CPD) compliance as a percentage (0-100)")
  creditCompliance: float64;

  @doc("Total dues revenue in cents")
  totalRevenueCents: int32;
}

@doc("Platform-wide summary list response (platform admin only)")
model PlatformSummaryListResponse {
  @doc("Per-association summaries")
  data: PlatformAssociationSummary[];

  @doc("Pagination metadata")
  meta: NationalListMeta;
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

  @doc("When the committee was dissolved (status='completed'), if applicable (BR-39)")
  dissolvedAt?: utcDateTime;
}

@doc("Committee detail with member list")
model CommitteeDetail extends CommitteeSummary {
  @doc("Description of the committee's purpose")
  description?: string;

  @doc("Committee member list")
  members?: Record<unknown>[];
}

@doc("Request to dissolve (complete) a committee — BR-39")
model DissolveCommitteeRequest {
  @doc("Optional reason recorded on the committee's dissolution record")
  @maxLength(2000)
  reason?: string;
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
    @extension("x-audit", #{ action: "create", resourceType: "national_dashboard_view" })
    getNationalDashboard(
      @path associationId: string,
      @doc("Snapshot month in YYYY-MM format (defaults to current month)")
      @query snapshotMonth?: string,
    ): ApiOkResponse<{ data: NationalDashboardResponse }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List chapters with comparative metrics for benchmarking (S10 row 2, WF-084). Small chapters (<5 members) are suppressed (M14-R2). Accessible to platform admins and designated national officers (BR-36).")
    @operationId("listNationalChapters")
    @get
    @route("/admin/national/chapters")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin", "national_officer"])
    @extension("x-audit", #{ action: "read", resourceType: "national_chapter_comparison", eventType: "data-access" })
    listNationalChapters(
      @doc("Association to query. Required for platform admins; inferred from grant for national officers")
      @query associationId?: string,
      @doc("Snapshot month in YYYY-MM format (defaults to current month)")
      @query snapshotMonth?: string,
      @doc("Sort field: totalMembers, collectionRate, creditCompliance, prefix with - for descending. Default -totalMembers")
      @query sort?: string,
      @doc("Items per page (1-100, default 20)")
      @query limit?: int32,
      @doc("Offset for pagination (default 0)")
      @query offset?: int32,
    ): ApiOkResponse<ChapterComparisonListResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get detailed metrics for a single chapter (S10 row 3, WF-085 drill-down). Includes member status and credit compliance breakdowns. Accessible to platform admins and designated national officers (BR-36).")
    @operationId("getNationalChapterDetail")
    @get
    @route("/admin/national/chapters/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin", "national_officer"])
    @extension("x-audit", #{ action: "read", resourceType: "national_chapter_detail", eventType: "data-access" })
    getNationalChapterDetail(
      @path organizationId: string,
      @doc("Association the chapter belongs to. Required for platform admins; inferred from grant for national officers")
      @query associationId?: string,
      @doc("Snapshot month in YYYY-MM format (defaults to current month)")
      @query snapshotMonth?: string,
    ): ApiOkResponse<{ data: ChapterDrilldownResponse }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Get platform-wide analytics across all associations (S10 row 5). Platform admin only.")
    @operationId("getPlatformSummary")
    @get
    @route("/admin/national/platform")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    @extension("x-audit", #{ action: "read", resourceType: "platform_summary", eventType: "data-access" })
    getPlatformSummary(
      @doc("Snapshot month in YYYY-MM format (defaults to current month)")
      @query snapshotMonth?: string,
      @doc("Sort field: totalMembers, collectionRate, prefix with - for descending. Default -totalMembers")
      @query sort?: string,
      @doc("Items per page (1-100, default 20)")
      @query limit?: int32,
      @doc("Offset for pagination (default 0)")
      @query offset?: int32,
    ): ApiOkResponse<PlatformSummaryListResponse>
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

    @doc("Dissolve (complete) a committee — BR-39. Sets status to completed, stamps dissolvedAt/dissolvedBy/dissolutionReason, and deactivates member access while RETAINING all committee data (members, tasks, history). Re-dissolving an already-completed committee returns 409. Platform admin only.")
    @operationId("dissolveCommittee")
    @post
    @route("/admin/committees/{id}/dissolve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    @extension("x-audit", #{ action: "complete", resourceType: "committee" })
    dissolveCommittee(
      @path id: string,
      @body body: DissolveCommitteeRequest,
    ): ApiOkResponse<{ data: CommitteeDetail }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
