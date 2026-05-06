import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Association Member — CPD Credits, Credit Compliance & Officer Terms
 *
 * Covers the officer-level credit compliance report and the org-scoped
 * officer term lookup — both custom routes that bypass the OpenAPI-generated
 * router and are wired directly in app.ts.
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A single member row in a credit compliance report")
model ComplianceRow {
  @doc("Person ID")
  personId: UUID;

  @doc("First name")
  firstName: string;

  @doc("Last name")
  lastName?: string;

  @doc("Member number assigned by the organisation")
  memberNumber?: string;

  @doc("Current membership status")
  membershipStatus: string;

  @doc("Total CPD credits earned this cycle")
  earned: int32;

  @doc("Credits required to be compliant this cycle")
  required: int32;

  @doc("Credits still needed to reach compliance")
  remaining: int32;

  @doc("Compliance status derived from earned vs required")
  complianceStatus: ComplianceStatus;
}

@doc("CPD compliance status")
enum ComplianceStatus {
  @doc("Member has met or exceeded the required credit count")
  compliant: "compliant",

  @doc("Member has earned at least 50% of required credits but not yet compliant")
  atRisk: "at_risk",

  @doc("Member has earned less than 50% of required credits")
  nonCompliant: "non_compliant",
}

@doc("Summary totals for a credit compliance report")
model ComplianceSummary {
  @doc("Number of members who are compliant")
  compliant: int32;

  @doc("Number of members who are at risk")
  atRisk: int32;

  @doc("Number of members who are non-compliant")
  nonCompliant: int32;

  @doc("Total active/grace-period members in the compliance report")
  total: int32;

  @doc("Required CPD credit count used for the compliance threshold")
  requiredCredits: int32;
}

@doc("Credit compliance report response")
model CreditComplianceReport {
  @doc("Per-member compliance rows")
  data: ComplianceRow[];

  @doc("Aggregated compliance summary")
  summary: ComplianceSummary;
}

@doc("An officer term record enriched with position title and person name")
model OfficerTermRecord {
  @doc("Officer term ID")
  id: UUID;

  @doc("Position ID")
  positionId: UUID;

  @doc("Position title")
  positionTitle: string;

  @doc("Person ID of the officer")
  personId: UUID;

  @doc("Full name of the officer")
  personName: string;

  @doc("Term status")
  status: string;

  @doc("Term start date")
  startDate?: utcDateTime;

  @doc("Term end date")
  endDate?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Namespace / Interfaces
// ---------------------------------------------------------------------------

namespace Association.Member.Credits {
  interface CreditComplianceManagement {
    @doc("Generate a CPD credit compliance report for all active members in the specified organisation. Officers only.")
    @operationId("getCreditCompliance")
    @get
    @route("/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getCreditCompliance(
      @path @doc("Organisation ID to generate the compliance report for") orgId: UUID
    ): ApiOkResponse<CreditComplianceReport>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  interface OfficerTermsManagement {
    @doc("List all officer terms for the specified organisation (enriched with position title and person name).")
    @operationId("listOfficerTerms")
    @get
    @route("/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listOfficerTerms(
      @path @doc("Organisation ID to list officer terms for") orgId: UUID
    ): ApiOkResponse<{ data: OfficerTermRecord[] }>
      | ApiUnauthorizedResponse;
  }
}
