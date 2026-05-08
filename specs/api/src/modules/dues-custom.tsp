import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dues Custom Module
 *
 * Officer-facing dashboard endpoint for dues summary.
 * Route: GET /dues/dashboard/:orgId — requires auth + officer role.
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Aggregated dues dashboard statistics for an organisation")
model DuesDashboardData {
  @doc("Total revenue collected in the current period")
  totalCollected: float64;

  @doc("Total outstanding (unpaid) dues amount")
  totalOutstanding: float64;

  @doc("Count of members with active (paid) dues")
  paidCount: int32;

  @doc("Count of members with unpaid dues")
  unpaidCount: int32;

  @doc("Count of members in the overdue grace period")
  overdueCount: int32;

  @doc("Number of upcoming activities/events for the org")
  upcomingActivities: int32;
}

// ---------------------------------------------------------------------------
// Namespace / Interface
// ---------------------------------------------------------------------------

@tag("Dues")
namespace DuesCustomModule {
  interface DuesCustomManagement {
    @doc("Get aggregated dues dashboard statistics for an organisation (treasurer/president only).")
    @operationId("getDuesDashboard")
    @get
    @route("/dues/dashboard/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getDuesDashboard(
      @path @doc("Organisation ID") orgId: UUID
    ): ApiOkResponse<{ data: DuesDashboardData }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
