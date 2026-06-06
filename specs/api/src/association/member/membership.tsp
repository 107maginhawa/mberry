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
 * Association Member Lifecycle — Domains 18-19: Individual & Group Memberships
 *
 * Covers membership tiers, categories, individual and institutional memberships,
 * membership applications, renewal cycles, and seat allocations.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a membership record. Computed from duesExpiryDate and stored for query performance.")
enum MembershipStatus {
  @doc("Payment has not yet been received for a new or renewing membership")
  pendingPayment: "pendingPayment",

  @doc("Membership is in good standing")
  active: "active",

  @doc("Membership has passed its expiry date but is within the grace period")
  gracePeriod: "gracePeriod",

  @doc("Membership has lapsed; dues were never paid after grace period")
  lapsed: "lapsed",

  @doc("Membership has fully expired with no path to reinstatement")
  expired: "expired",

  @doc("Membership has been administratively suspended")
  suspended: "suspended",

  @doc("Membership has been permanently removed by an administrator")
  removed: "removed",

  @doc("Member has voluntarily resigned from the association")
  resigned: "resigned",

  @doc("Member is deceased; membership closed upon death notification")
  deceased: "deceased",

  @doc("Member has been expelled by the association")
  expelled: "expelled",
}

@doc("Status of a membership application")
enum ApplicationStatus {
  @doc("Application has been received and is awaiting review")
  submitted: "submitted",

  @doc("Application is being actively reviewed")
  underReview: "underReview",

  @doc("Application has been approved")
  approved: "approved",

  @doc("Application has been denied")
  denied: "denied",

  @doc("Applicant has been placed on a waiting list")
  waitlisted: "waitlisted",
}

@doc("Status of a renewal cycle")
enum RenewalStatus {
  @doc("Renewal period has opened but no invoice has been generated")
  pending: "pending",

  @doc("Invoice has been generated and sent to the member")
  invoiced: "invoiced",

  @doc("Dues have been paid for this renewal period")
  paid: "paid",

  @doc("Payment was not received before the due date")
  overdue: "overdue",

  @doc("Membership lapsed due to non-payment")
  lapsed: "lapsed",
}

@doc("Status of an individual seat within an institutional membership")
enum SeatStatus {
  @doc("Seat is actively assigned to a person")
  active: "active",

  @doc("Seat has been revoked")
  revoked: "revoked",
}

// ---------------------------------------------------------------------------
// Value Models (non-entity)
// ---------------------------------------------------------------------------

@doc("Tier eligibility status")
enum TierStatus {
  @doc("Tier is available for new memberships")
  active: "active",

  @doc("Tier is no longer offered for new memberships")
  retired: "retired",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("Membership tier defining fee structure and benefits")
model MembershipTier extends BaseEntity {

  @doc("Display name of the tier")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Unique code used in integrations and reporting")
  @minLength(1)
  @maxLength(30)
  @pattern("^[A-Z0-9_-]+$")
  code: string;

  @doc("Human-readable description of the tier")
  @maxLength(1000)
  description?: string;

  @doc("Annual dues amount in the specified currency")
  @minValue(0)
  annualFee: int64;

  @doc("ISO 4217 currency code for the annual fee")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("List of benefits available to members in this tier")
  benefits?: string[];

  @doc("Maximum number of members permitted at this tier (null = unlimited)")
  @minValue(1)
  maxMembers?: int32;

  @doc("Lifecycle status of this tier")
  status: TierStatus;
}

@doc("Membership category grouping tiers for reporting and eligibility")
model MembershipCategory extends BaseEntity {

  @doc("Display name of the category")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Description of the category and its intended use")
  @maxLength(1000)
  description?: string;

  @doc("IDs of the tiers that belong to this category")
  applicableTiers: string[];
}

@doc("Individual membership record linking a person to an organization and tier")
model Membership extends BaseEntity {

  @doc("ID of the person holding this membership")
  personId: string;

  @doc("ID of the association organization")
  organizationId: string;

  @doc("ID of the membership tier")
  tierId: string;

  @doc("Optional membership category")
  categoryId?: string;

  @doc("Human-readable member number assigned to this membership")
  @maxLength(50)
  memberNumber?: string;

  @doc("Date on which membership benefits began")
  startDate: plainDate;

  @doc("Date on which current dues period expires")
  duesExpiryDate: plainDate;

  @doc("Number of days after duesExpiryDate before membership lapses")
  @minValue(0)
  gracePeriodDays: int32 = 30;

  @doc("Computed lifecycle status stored for query performance")
  status: MembershipStatus;

  @doc("Timestamp when the person first joined the association")
  joinedAt: utcDateTime;

  @doc("Timestamp of removal, if applicable")
  removedAt?: utcDateTime;

  @doc("Reason provided for removal")
  @maxLength(500)
  removalReason?: string;

  @doc("Internal note about this membership")
  @maxLength(2000)
  note?: string;
}

@doc("Application submitted by a prospective member")
model MembershipApplication extends BaseEntity {

  @doc("ID of the person submitting the application")
  personId: string;

  @doc("ID of the association organization being applied to")
  organizationId: string;

  @doc("ID of the requested membership tier")
  tierId: string;

  @doc("Date the application was submitted")
  applicationDate: plainDate;

  @doc("Current review status of the application")
  status: ApplicationStatus;

  @doc("ID of the staff member who reviewed the application")
  reviewedBy?: string;

  @doc("Timestamp of the review decision")
  reviewedAt?: utcDateTime;

  @doc("Reason provided when an application is denied")
  @maxLength(2000)
  denialReason?: string;
}

@doc("A single renewal period within a membership lifecycle")
model RenewalCycle extends BaseEntity {

  @doc("ID of the membership this cycle belongs to")
  membershipId: string;

  @doc("Start of the renewal period")
  periodStart: plainDate;

  @doc("End of the renewal period")
  periodEnd: plainDate;

  @doc("ID of the dues invoice generated for this cycle")
  invoiceId?: string;

  @doc("Date on which dues were paid")
  paidDate?: plainDate;

  @doc("Status of this renewal cycle")
  status: RenewalStatus;
}

@doc("Institutional (organizational) membership granting seat allocations to individuals")
model InstitutionalMembership extends BaseEntity {

  @doc("ID of the member institution")
  organizationId: string;

  @doc("ID of the parent association organization")
  parentOrganizationId: string;

  @doc("ID of the membership tier purchased by the institution")
  tierId: string;

  @doc("Total number of individual seats included in this membership")
  @minValue(1)
  totalSeats: int32;

  @doc("Number of seats currently allocated to individuals")
  @minValue(0)
  usedSeats: int32;

  @doc("ID of the primary contact person at the institution")
  primaryContactId: string;

  @doc("ID of the billing contact person at the institution")
  billingContactId?: string;

  @doc("Date on which institutional membership benefits began")
  startDate: plainDate;

  @doc("Date on which the current dues period expires")
  duesExpiryDate: plainDate;

  @doc("Lifecycle status of this institutional membership")
  status: MembershipStatus;
}

@doc("Allocation of one institutional membership seat to an individual")
model SeatAllocation extends BaseEntity {

  @doc("ID of the institutional membership from which this seat is drawn")
  institutionalMembershipId: string;

  @doc("ID of the person receiving the seat")
  personId: string;

  @doc("ID of the staff member who performed the allocation")
  allocatedBy: string;

  @doc("Timestamp when the seat was allocated")
  allocatedAt: utcDateTime;

  @doc("Timestamp when the seat was revoked, if applicable")
  revokedAt?: utcDateTime;

  @doc("Current status of this seat allocation")
  status: SeatStatus;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a new membership tier")
model MembershipTierCreateRequest {
  name: string;
  code: string;
  description?: string;
  annualFee: int64;
  currency: string;
  benefits?: string[];
  maxMembers?: int32;
  status: TierStatus;
}

@doc("Request to update an existing membership tier")
model MembershipTierUpdateRequest {
  name?: string;
  description?: string | null;
  annualFee?: int64;
  benefits?: string[] | null;
  maxMembers?: int32 | null;
  status?: TierStatus;
}

@doc("Request to create a new membership")
model MembershipCreateRequest {
  personId: string;
  organizationId: string;
  tierId: string;
  categoryId?: string;
  memberNumber?: string;
  startDate: plainDate;
  duesExpiryDate: plainDate;
  gracePeriodDays?: int32;
  note?: string;
}

@doc("Request to update an existing membership")
model MembershipUpdateRequest {
  tierId?: string;
  categoryId?: string | null;
  memberNumber?: string | null;
  duesExpiryDate?: plainDate;
  gracePeriodDays?: int32;
  note?: string | null;
}

@doc("Request to terminate a membership")
model MembershipTerminateRequest {
  @doc("Reason for terminating the membership")
  @minLength(1)
  @maxLength(500)
  terminationReason: string;
}

@doc("Request to record a member's voluntary resignation")
model MembershipResignRequest {
  @doc("Reason for resignation")
  @maxLength(500)
  terminationReason?: string;
}

@doc("Request to record a member's death")
model MembershipDeceasedRequest {
  @doc("Date of death")
  dateOfDeath: plainDate;

  @doc("Optional notes")
  @maxLength(500)
  terminationReason?: string;
}

@doc("Request to create a membership application")
model MembershipApplicationCreateRequest {
  personId: string;
  organizationId: string;
  tierId: string;
  applicationDate: plainDate;
}

@doc("Request to deny a membership application")
model MembershipApplicationDenyRequest {
  @doc("Reason for denying the application")
  @minLength(1)
  @maxLength(2000)
  denialReason: string;
}

@doc("Request to create an institutional membership")
model InstitutionalMembershipCreateRequest {
  organizationId: string;
  parentOrganizationId: string;
  tierId: string;
  totalSeats: int32;
  primaryContactId: string;
  billingContactId?: string;
  startDate: plainDate;
  duesExpiryDate: plainDate;
}

@doc("Request to allocate a seat within an institutional membership")
model SeatAllocationRequest {
  @doc("ID of the person to receive the seat")
  personId: string;
}

// ---------------------------------------------------------------------------
// Roster, Category, and Org-Profile Models
// ---------------------------------------------------------------------------

@doc("A member in the organization roster, combining membership and person details")
model RosterMember extends BaseEntity {
  @doc("ID of the association organization")
  organizationId: string;

  @doc("ID of the person")
  personId: string;

  @doc("ID of the membership tier")
  tierId: string;

  @doc("Optional membership category ID")
  categoryId?: string;

  @doc("Human-readable member number or license number")
  @maxLength(50)
  memberNumber?: string;

  @doc("Date on which membership benefits began")
  startDate: plainDate;

  @doc("Date on which current dues period expires")
  duesExpiryDate: plainDate;

  @doc("Lifecycle status of this membership")
  status: MembershipStatus;

  @doc("Timestamp when the person first joined the association")
  joinedAt: utcDateTime;

  @doc("Number of days after duesExpiryDate before membership lapses")
  @minValue(0)
  gracePeriodDays: int32;

  @doc("Internal note about this membership")
  @maxLength(2000)
  note?: string;
}

@doc("Officer-enriched view of a roster member, including dues and training compliance data")
model OfficerRosterMember extends RosterMember {
  @doc("First name of the person (from person JOIN)")
  firstName?: string;

  @doc("Last name of the person (from person JOIN)")
  lastName?: string;

  @doc("Full name of the person (from person JOIN)")
  name?: string;

  @doc("Email address of the person (from person JOIN)")
  email?: string;

  @doc("Name of the membership category (from category JOIN)")
  categoryName?: string;

  @doc("Status of the latest dues invoice for this member; null if no invoice exists")
  duesInvoiceStatus?: string;

  @doc("Total CPD credits earned by this member in the current cycle")
  @minValue(0)
  creditsEarned: int32;

  @doc("Whether the member meets the 40-credit CPD threshold for the current cycle")
  trainingCompliant: boolean;
}

@doc("A single failure entry in a bulk approve operation")
model BulkApproveFailure {
  @doc("ID of the application that failed to approve")
  id: string;

  @doc("Human-readable reason for the failure")
  reason: string;
}

@doc("Request body for bulk-approving membership applications")
model BulkApproveApplicationsRequest {
  @doc("IDs of applications to approve in a single batch")
  applicationIds: string[];
}

@doc("Response from a bulk approve operation with partial-success semantics")
model BulkApproveApplicationsResponse {
  @doc("IDs of applications successfully approved")
  succeeded: string[];

  @doc("Applications that failed to approve, with reasons")
  failed: BulkApproveFailure[];
}

@doc("Request to add a new member to the organization roster")
model AddMemberRequest {
  @doc("ID of the person to add as a member")
  personId: string;

  @doc("ID of the membership tier")
  tierId: string;

  @doc("Optional membership category ID")
  categoryId?: string;

  @doc("Human-readable member number or license number")
  @maxLength(50)
  memberNumber?: string;

  @doc("Date on which membership begins")
  startDate?: plainDate;

  @doc("Date on which current dues period expires")
  duesExpiryDate?: plainDate;

  @doc("Grace period days before lapse (default 30)")
  @minValue(0)
  gracePeriodDays?: int32;

  @doc("Internal note about this membership")
  @maxLength(2000)
  note?: string;
}

@doc("Request to update an existing roster member")
model UpdateMemberRequest {
  @doc("ID of the membership tier")
  tierId?: string;

  @doc("Optional membership category ID")
  categoryId?: string | null;

  @doc("Human-readable member number")
  @maxLength(50)
  memberNumber?: string | null;

  @doc("Date on which current dues period expires")
  duesExpiryDate?: plainDate;

  @doc("Grace period days before lapse")
  @minValue(0)
  gracePeriodDays?: int32;

  @doc("Lifecycle status")
  status?: MembershipStatus;

  @doc("Internal note about this membership")
  @maxLength(2000)
  note?: string | null;
}

@doc("Request to import multiple members from an external source")
model ImportMembersRequest {
  @doc("ID of the organization to import members into")
  organizationId: string;

  @doc("Array of member records to import")
  members: AddMemberRequest[];
}

@doc("Result of a bulk member import operation")
model ImportResult {
  @doc("Number of records successfully imported")
  imported: int32;

  @doc("Number of records skipped due to duplicates")
  skipped: int32;

  @doc("Number of records that failed validation")
  failed: int32;

  @doc("Validation errors for failed records, indexed by position")
  errors: string[];
}

@doc("Request to create or update a membership category")
model UpsertCategoryRequest {
  @doc("Display name of the category")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Description of the category")
  @maxLength(1000)
  description?: string;

  @doc("IDs of the tiers that belong to this category")
  applicableTiers: string[];
}

@doc("Profile of an association organization")
model OrganizationProfile {
  @doc("ID of the organization")
  id: string;

  @doc("Display name of the organization")
  @minLength(1)
  @maxLength(200)
  name: string;

  @doc("URL-safe unique slug for the organization")
  @maxLength(100)
  slug: string;

  @doc("Primary contact email address")
  @maxLength(254)
  contactEmail: string;

  @doc("Geographic region or province")
  @maxLength(100)
  region?: string;

  @doc("Organization type classification")
  @maxLength(50)
  orgType?: string;

  @doc("Lifecycle status of the organization")
  @maxLength(50)
  status: string;

  @doc("Human-readable description of the organization")
  @maxLength(2000)
  description?: string;

  @doc("URL of the organization logo image")
  @maxLength(500)
  logoUrl?: string;

  @doc("Contact phone number")
  @maxLength(30)
  phone?: string;

  @doc("Physical address")
  @maxLength(500)
  address?: string;

  @doc("Website URL")
  @maxLength(500)
  website?: string;

  @doc("Founding date of the organization")
  foundingDate?: plainDate;
}

@doc("Request to update an organization profile")
model UpdateOrgProfileRequest {
  @doc("Display name")
  @maxLength(200)
  name?: string;

  @doc("Primary contact email")
  @maxLength(254)
  contactEmail?: string;

  @doc("Geographic region")
  @maxLength(100)
  region?: string;

  @doc("Human-readable description")
  @maxLength(2000)
  description?: string;

  @doc("URL of the organization logo")
  @maxLength(500)
  logoUrl?: string;

  @doc("Contact phone number")
  @maxLength(30)
  phone?: string;

  @doc("Physical address")
  @maxLength(500)
  address?: string;

  @doc("Website URL")
  @maxLength(500)
  website?: string;

  @doc("Founding date")
  foundingDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/tiers")
@tag("Association:Member")
namespace Association.Member.Membership {
  @doc("CRUD operations for membership tiers")
  interface MembershipTierManagement {
    @doc("Create a new membership tier.")
    @operationId("createMembershipTier")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "membership-tier" })
    createMembershipTier(
      @body body: MembershipTierCreateRequest
    ): ApiCreatedResponse<MembershipTier>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a membership tier by ID.")
    @operationId("getMembershipTier")
    @get
    @route("/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member", "association:admin"])
    getMembershipTier(
      @path tierId: string
    ): ApiOkResponse<MembershipTier>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List all membership tiers.")
    @operationId("listMembershipTiers")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member", "association:admin"])
    listMembershipTiers(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<MembershipTier>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a membership tier.")
    @operationId("updateMembershipTier")
    @patch(#{implicitOptionality: true})
    @route("/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "membership-tier" })
    updateMembershipTier(
      @path tierId: string,
      @body updates: MembershipTierUpdateRequest
    ): ApiOkResponse<MembershipTier>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a membership tier.")
    @operationId("deleteMembershipTier")
    @delete
    @route("/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "delete", resourceType: "membership-tier" })
    deleteMembershipTier(
      @path tierId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and lifecycle operations for individual memberships")
  interface MembershipManagement {
    @doc("Create a new membership.")
    @operationId("createMembership")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "membership" })
    createMembership(
      @body body: MembershipCreateRequest
    ): ApiCreatedResponse<Membership>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a membership by ID.")
    @operationId("getMembership")
    @get
    @route("/{membershipId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    getMembership(
      @path membershipId: string
    ): ApiOkResponse<Membership>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List memberships with optional filters.")
    @operationId("listMemberships")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listMemberships(
      ...PaginationQuery,
      @query organizationId?: string,
      @query tierId?: string,
      @query status?: MembershipStatus
    ): ApiOkResponse<PaginatedResponse<Membership>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a membership record.")
    @operationId("updateMembership")
    @patch(#{implicitOptionality: true})
    @route("/{membershipId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "membership" })
    updateMembership(
      @path membershipId: string,
      @body updates: MembershipUpdateRequest
    ): ApiOkResponse<Membership>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a membership record.")
    @operationId("deleteMembership")
    @delete
    @route("/{membershipId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "delete", resourceType: "membership" })
    deleteMembership(
      @path membershipId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Renew a membership by extending its dues expiry date.")
    @operationId("renewMembership")
    @post
    @route("/{membershipId}/renew")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "renew", resourceType: "membership" })
    renewMembership(
      @path membershipId: string
    ): ApiOkResponse<Membership>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Terminate a membership permanently.")
    @operationId("terminateMembership")
    @post
    @route("/{membershipId}/terminate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "terminate", resourceType: "membership" })
    terminateMembership(
      @path membershipId: string,
      @body body: MembershipTerminateRequest
    ): ApiOkResponse<Membership>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Record a member's voluntary resignation.")
    @operationId("resignMembership")
    @post
    @route("/{membershipId}/resign")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "resign", resourceType: "membership" })
    resignMembership(
      @path membershipId: string,
      @body body: MembershipResignRequest
    ): ApiOkResponse<Membership>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Record a member's death.")
    @operationId("deceaseMembership")
    @post
    @route("/{membershipId}/deceased")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "deceased", resourceType: "membership" })
    deceaseMembership(
      @path membershipId: string,
      @body body: MembershipDeceasedRequest
    ): ApiOkResponse<Membership>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Reinstate a suspended or lapsed membership.")
    @operationId("reinstateMembership")
    @post
    @route("/{membershipId}/reinstate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "reinstate", resourceType: "membership" })
    reinstateMembership(
      @path membershipId: string
    ): ApiOkResponse<Membership>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and review workflow for membership applications")
  interface MembershipApplicationManagement {
    @doc("Submit a new membership application.")
    @operationId("createMembershipApplication")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @extension("x-audit", #{ action: "create", resourceType: "membership-application" })
    createMembershipApplication(
      @body body: MembershipApplicationCreateRequest
    ): ApiCreatedResponse<MembershipApplication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a membership application by ID.")
    @operationId("getMembershipApplication")
    @get
    @route("/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "user:owner"])
    getMembershipApplication(
      @path applicationId: string
    ): ApiOkResponse<MembershipApplication>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List membership applications with optional filters.")
    @operationId("listMembershipApplications")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listMembershipApplications(
      ...PaginationQuery,
      @query organizationId?: string,
      @query status?: ApplicationStatus
    ): ApiOkResponse<PaginatedResponse<MembershipApplication>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a membership application.")
    @operationId("updateMembershipApplication")
    @patch(#{implicitOptionality: true})
    @route("/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "membership-application" })
    updateMembershipApplication(
      @path applicationId: string,
      @body updates: MembershipApplicationCreateRequest
    ): ApiOkResponse<MembershipApplication>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a membership application.")
    @operationId("deleteMembershipApplication")
    @delete
    @route("/{applicationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "delete", resourceType: "membership-application" })
    deleteMembershipApplication(
      @path applicationId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Approve a membership application and create a membership.")
    @operationId("approveMembershipApplication")
    @post
    @route("/{applicationId}/approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "approve", resourceType: "membership-application" })
    approveMembershipApplication(
      @path applicationId: string
    ): ApiOkResponse<MembershipApplication>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Deny a membership application with a reason.")
    @operationId("denyMembershipApplication")
    @post
    @route("/{applicationId}/deny")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "deny", resourceType: "membership-application" })
    denyMembershipApplication(
      @path applicationId: string,
      @body body: MembershipApplicationDenyRequest
    ): ApiOkResponse<MembershipApplication>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Bulk approve membership applications with partial-success semantics.")
    @operationId("bulkApproveMembershipApplications")
    @post
    @route("/bulk-approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "approve", resourceType: "membership-application" })
    bulkApproveMembershipApplications(
      @body body: BulkApproveApplicationsRequest
    ): ApiOkResponse<BulkApproveApplicationsResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD and search for institutional memberships")
  interface InstitutionalMembershipManagement {
    @doc("Create a new institutional membership.")
    @operationId("createInstitutionalMembership")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "institutionalMembership" })
    createInstitutionalMembership(
      @body body: InstitutionalMembershipCreateRequest
    ): ApiCreatedResponse<InstitutionalMembership>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get an institutional membership by ID.")
    @operationId("getInstitutionalMembership")
    @get
    @route("/{institutionalMembershipId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "institution:owner"])
    getInstitutionalMembership(
      @path institutionalMembershipId: string
    ): ApiOkResponse<InstitutionalMembership>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List institutional memberships.")
    @operationId("listInstitutionalMemberships")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listInstitutionalMemberships(
      ...PaginationQuery,
      @query organizationId?: string,
      @query status?: MembershipStatus
    ): ApiOkResponse<PaginatedResponse<InstitutionalMembership>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an institutional membership.")
    @operationId("updateInstitutionalMembership")
    @patch(#{implicitOptionality: true})
    @route("/{institutionalMembershipId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "institutionalMembership" })
    updateInstitutionalMembership(
      @path institutionalMembershipId: string,
      @body updates: InstitutionalMembershipCreateRequest
    ): ApiOkResponse<InstitutionalMembership>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete an institutional membership.")
    @operationId("deleteInstitutionalMembership")
    @delete
    @route("/{institutionalMembershipId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "delete", resourceType: "institutionalMembership" })
    deleteInstitutionalMembership(
      @path institutionalMembershipId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("Seat allocation management within institutional memberships")
  interface SeatAllocationManagement {
    @doc("Allocate a seat to an individual within an institutional membership.")
    @operationId("allocateSeat")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "institution:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "seat_allocation" })
    allocateSeat(
      @path institutionalMembershipId: string,
      @body body: SeatAllocationRequest
    ): ApiCreatedResponse<SeatAllocation>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Revoke a seat allocation.")
    @operationId("revokeSeat")
    @post
    @route("/{seatAllocationId}/revoke")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "institution:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "seat_allocation" })
    revokeSeat(
      @path institutionalMembershipId: string,
      @path seatAllocationId: string
    ): ApiOkResponse<SeatAllocation>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("List seat allocations for an institutional membership.")
    @operationId("listSeatAllocations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "institution:admin"])
    listSeatAllocations(
      @path institutionalMembershipId: string,
      ...PaginationQuery,
      @query status?: SeatStatus
    ): ApiOkResponse<PaginatedResponse<SeatAllocation>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Manage the member roster for an organization (CRUD + bulk import)")
  interface MemberRosterManagement {
    @doc("List all members in the organization roster.")
    @operationId("listRosterMembers")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listRosterMembers(
      ...PaginationQuery,
      @query organizationId: string,
      @query status?: MembershipStatus,
      @query categoryId?: string,
      @query search?: string,
      @query duesStatus?: string,
      @query trainingCompliant?: boolean
    ): ApiOkResponse<PaginatedResponse<OfficerRosterMember>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a specific member in the organization roster by membership ID.")
    @operationId("getRosterMember")
    @get
    @route("/{memberId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getRosterMember(
      @path memberId: string,
      @query organizationId: string
    ): ApiOkResponse<RosterMember>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Add a new member to the organization roster.")
    @operationId("addRosterMember")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "roster-member" })
    addRosterMember(
      @body body: AddMemberRequest
    ): ApiCreatedResponse<RosterMember>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Update a roster member's details.")
    @operationId("updateRosterMember")
    @put
    @route("/{memberId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "roster-member" })
    updateRosterMember(
      @path memberId: string,
      @body body: UpdateMemberRequest
    ): ApiOkResponse<RosterMember>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Bulk import members from an external source.")
    @operationId("importRosterMembers")
    @post
    @route("/import")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "roster-import" })
    importRosterMembers(
      @body body: ImportMembersRequest
    ): ApiOkResponse<ImportResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Manage membership categories for an organization")
  interface MembershipCategoryManagement {
    @doc("List all membership categories for an organization.")
    @operationId("listMembershipCategories")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listMembershipCategories(
      ...PaginationQuery,
      @query organizationId: string
    ): ApiOkResponse<PaginatedResponse<MembershipCategory>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Create or update a membership category for an organization.")
    @operationId("upsertMembershipCategory")
    @put
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    upsertMembershipCategory(
      @path organizationId: string,
      @body body: UpsertCategoryRequest
    ): ApiOkResponse<MembershipCategory>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Manage the public-facing profile of an association organization")
  interface OrganizationProfileManagement {
    @doc("Get the profile of an association organization.")
    @operationId("getOrganizationProfile")
    @get
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getOrganizationProfile(
      @path organizationId: string
    ): ApiOkResponse<OrganizationProfile>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update the profile of an association organization.")
    @operationId("updateOrganizationProfile")
    @put
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "organization-profile" })
    updateOrganizationProfile(
      @path organizationId: string,
      @body body: UpdateOrgProfileRequest
    ): ApiOkResponse<OrganizationProfile>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }
}
