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
 * Association Member Lifecycle — Domains 35-37: CRM, Advocacy & Fundraising
 *
 * Covers prospect management and CRM activities, fundraising campaigns,
 * donation and pledge tracking, tax receipts, legislative advocacy,
 * action alerts, and PAC contribution compliance.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Source through which a prospect was acquired")
enum ProspectSource {
  @doc("Referred by an existing member")
  referral: "referral",

  @doc("Came through the association website")
  website: "website",

  @doc("Met at a conference, chapter meeting, or other event")
  event: "event",

  @doc("Result of an outbound marketing campaign")
  marketing: "marketing",

  @doc("Sourced from a purchased lead list")
  purchased: "purchased",
}

@doc("Lifecycle status of a prospect")
enum ProspectStatus {
  @doc("Prospect has been identified but not yet contacted")
  new: "new",

  @doc("Initial contact has been made")
  contacted: "contacted",

  @doc("Prospect has been assessed and is a good fit")
  qualified: "qualified",

  @doc("Prospect has converted to a member")
  converted: "converted",

  @doc("Prospect is no longer being pursued")
  lost: "lost",
}

@doc("Type of CRM activity recorded against a prospect")
enum ProspectActivityType {
  @doc("Phone call")
  call: "call",

  @doc("Email correspondence")
  email: "email",

  @doc("In-person or virtual meeting")
  meeting: "meeting",

  @doc("Event attendance or participation")
  event: "event",

  @doc("Internal note recorded by staff")
  note: "note",
}

@doc("Type of fundraising campaign")
enum FundraisingCampaignType {
  @doc("Campaign designed to raise monetary donations")
  fundraising: "fundraising",

  @doc("Campaign to attract new members")
  membershipDrive: "membershipDrive",

  @doc("Campaign to promote an event")
  eventPromotion: "eventPromotion",

  @doc("Campaign to promote a legislative or policy position")
  advocacy: "advocacy",

  @doc("General awareness or brand campaign")
  awareness: "awareness",
}

@doc("Lifecycle status of a campaign")
enum CampaignStatus {
  @doc("Campaign is being planned and is not yet live")
  draft: "draft",

  @doc("Campaign is live and accepting responses")
  active: "active",

  @doc("Campaign has been temporarily paused")
  paused: "paused",

  @doc("Campaign has concluded")
  completed: "completed",
}

@doc("Type of donation")
enum DonationType {
  @doc("Single one-time donation")
  oneTime: "oneTime",

  @doc("Ongoing recurring donation")
  recurring: "recurring",

  @doc("Pledge of future donation(s)")
  pledge: "pledge",

  @doc("Non-cash in-kind donation")
  inKind: "inKind",
}

@doc("Whether the donor is an individual or an organization")
enum DonorType {
  individual: "individual",
  organization: "organization",
}

@doc("Frequency of pledge installments")
enum PledgeFrequency {
  monthly: "monthly",
  quarterly: "quarterly",
  annual: "annual",
  oneTime: "oneTime",
}

@doc("Lifecycle status of a pledge")
enum PledgeStatus {
  @doc("Pledge is active and installments are expected")
  active: "active",

  @doc("All pledge installments have been fulfilled")
  completed: "completed",

  @doc("Pledgor has defaulted on installment payments")
  defaulted: "defaulted",

  @doc("Pledge has been cancelled")
  cancelled: "cancelled",
}

@doc("Status of a legislative issue being tracked")
enum LegislativeIssueStatus {
  @doc("Issue is being actively monitored and acted upon")
  active: "active",

  @doc("Issue is being observed but requires no immediate action")
  monitoring: "monitoring",

  @doc("Issue has been resolved")
  resolved: "resolved",

  @doc("Issue has been archived")
  archived: "archived",
}

@doc("Status of an action alert")
enum ActionAlertStatus {
  @doc("Alert is being drafted")
  draft: "draft",

  @doc("Alert is live and accepting member responses")
  active: "active",

  @doc("Alert campaign has concluded")
  closed: "closed",
}

@doc("Status of a PAC contribution record")
enum PACContributionStatus {
  @doc("Contribution has been received")
  received: "received",

  @doc("Contribution has been acknowledged to the contributor")
  acknowledged: "acknowledged",

  @doc("Contribution has been included in a regulatory report")
  reported: "reported",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("A prospective member being tracked in the CRM")
model Prospect extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("Full name of the prospect")
  @minLength(1)
  @maxLength(200)
  name: string;

  @doc("Prospect's email address")
  @format("email")
  email?: string;

  @doc("Prospect's phone number")
  @maxLength(50)
  phone?: string;

  @doc("Channel through which the prospect was acquired")
  source: ProspectSource;

  @doc("Current engagement status of the prospect")
  status: ProspectStatus;

  @doc("ID of the staff member assigned to this prospect")
  assignedTo?: string;

  @doc("Internal notes about the prospect")
  @maxLength(5000)
  notes?: string;

  @doc("ID of the membership record created when this prospect converted")
  convertedToMembershipId?: string;
}

@doc("A CRM activity recorded against a prospect")
model ProspectActivity extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the prospect this activity is associated with")
  prospectId: string;

  @doc("Type of activity")
  activityType: ProspectActivityType;

  @doc("Description of the activity and its outcome")
  @minLength(1)
  @maxLength(5000)
  description: string;

  @doc("ID of the staff member who performed the activity")
  performedBy: string;

  @doc("Timestamp when the activity took place")
  performedAt: utcDateTime;
}

@doc("A fundraising or membership-drive campaign")
model Campaign extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("Display name of the campaign")
  @minLength(1)
  @maxLength(150)
  name: string;

  @doc("Type of campaign")
  type: FundraisingCampaignType;

  @doc("Monetary fundraising goal (null for non-monetary campaigns)")
  @minValue(0)
  goal?: int64;

  @doc("Amount raised to date (updated by the donation processing pipeline)")
  @minValue(0)
  raised?: int64;

  @doc("Date on which the campaign starts")
  startDate: plainDate;

  @doc("Date on which the campaign ends (null for open-ended campaigns)")
  endDate?: plainDate;

  @doc("Current status of the campaign")
  status: CampaignStatus;

  @doc("Description of the intended audience segment for targeting")
  @maxLength(1000)
  targetAudience?: string;
}

@doc("A monetary or in-kind donation made to the association")
model Donation extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the donor (person or organization)")
  donorId: string;

  @doc("Whether the donor is an individual or an organization")
  donorType: DonorType;

  @doc("ID of the campaign this donation is credited to (null for unrestricted donations)")
  campaignId?: string;

  @doc("Donation amount")
  @minValue(0)
  amount: int64;

  @doc("ISO 4217 currency code")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Date on which the donation was made")
  donationDate: plainDate;

  @doc("Type of donation")
  type: DonationType;

  @doc("ID of the payment transaction record")
  paymentId?: string;

  @doc("Whether this donation qualifies for a tax deduction under applicable law")
  taxDeductible: boolean;

  @doc("Tax receipt number issued for this donation")
  @maxLength(100)
  receiptNumber?: string;

  @doc("Whether the donor has requested anonymity in public acknowledgements")
  anonymous: boolean;
}

@doc("A pledge by a donor to make one or more future donations")
model Pledge extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the pledging donor")
  donorId: string;

  @doc("ID of the campaign this pledge supports")
  campaignId?: string;

  @doc("Total committed pledge amount")
  @minValue(0)
  totalAmount: int64;

  @doc("Amount of the pledge already paid")
  @minValue(0)
  paidAmount: int64;

  @doc("Frequency of pledge installments")
  frequency: PledgeFrequency;

  @doc("Date on which the pledge period begins")
  startDate: plainDate;

  @doc("Date on which the pledge period ends (null for open-ended pledges)")
  endDate?: plainDate;

  @doc("Current status of the pledge")
  status: PledgeStatus;
}

@doc("A tax receipt issued to a donor for one or more donations")
model TaxReceipt extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the donation this receipt covers (null for consolidated annual receipts)")
  donationId?: string;

  @doc("ID of the donor")
  donorId: string;

  @doc("Unique receipt number")
  @minLength(1)
  @maxLength(100)
  receiptNumber: string;

  @doc("Fiscal year to which this receipt applies")
  @minValue(2000)
  fiscalYear: int32;

  @doc("Total receiptable amount")
  @minValue(0)
  amount: int64;

  @doc("Timestamp when the receipt was issued")
  issuedAt: utcDateTime;

  @doc("ID of the staff member who issued the receipt")
  issuedBy: string;
}

@doc("A legislative or policy issue being tracked by the association's advocacy program")
model LegislativeIssue extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("Title of the legislative issue or bill")
  @minLength(1)
  @maxLength(200)
  title: string;

  @doc("Description of the issue and the association's position")
  @minLength(1)
  @maxLength(10000)
  description: string;

  @doc("Current tracking status of the issue")
  status: LegislativeIssueStatus;

  @doc("Jurisdiction (e.g. federal, state name, province) where the issue applies")
  @maxLength(100)
  jurisdiction?: string;

  @doc("Date on which the issue was first identified")
  issueDate: plainDate;

  @doc("Date on which the issue was resolved")
  resolvedDate?: plainDate;
}

@doc("An action alert sent to members to mobilize advocacy responses")
model ActionAlert extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the legislative issue this alert relates to")
  issueId: string;

  @doc("Title of the action alert")
  @minLength(1)
  @maxLength(200)
  title: string;

  @doc("The specific action members are being asked to take")
  @minLength(1)
  @maxLength(5000)
  callToAction: string;

  @doc("Description of the intended audience segment for targeting")
  @maxLength(1000)
  targetAudience?: string;

  @doc("Timestamp when the alert was sent to members")
  sentAt?: utcDateTime;

  @doc("Number of member responses received")
  @minValue(0)
  responsesCount?: int32;

  @doc("Current status of the action alert")
  status: ActionAlertStatus;
}

@doc("A political action committee contribution record")
model PACContribution extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the contributor (person or organization)")
  contributorId: string;

  @doc("Contribution amount")
  @minValue(0)
  amount: int64;

  @doc("Date on which the contribution was made")
  contributionDate: plainDate;

  @doc("Contributor's employer name (required for regulatory reporting)")
  @maxLength(200)
  employerName?: string;

  @doc("Contributor's occupation (required for regulatory reporting)")
  @maxLength(100)
  occupation?: string;

  @doc("Current regulatory status of this contribution record")
  status: PACContributionStatus;

  @doc("Reporting period label for regulatory filing (e.g. 'Q1 2026')")
  @maxLength(50)
  reportingPeriod?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a prospect")
model ProspectCreateRequest {
  name: string;
  email?: string;
  phone?: string;
  source: ProspectSource;
  assignedTo?: string;
  notes?: string;
}

@doc("Request to update a prospect")
model ProspectUpdateRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  source?: ProspectSource;
  status?: ProspectStatus;
  assignedTo?: string | null;
  notes?: string | null;
}

@doc("Request to convert a prospect to a member")
model ConvertProspectRequest {
  @doc("ID of the membership tier to assign upon conversion")
  tierId: string;

  @doc("ID of the association organization the prospect is joining")
  organizationId: string;

  @doc("Start date for the resulting membership")
  membershipStartDate: plainDate;
}

@doc("Request to record a CRM activity against a prospect")
model ProspectActivityCreateRequest {
  prospectId: string;
  activityType: ProspectActivityType;
  description: string;
  performedBy: string;
  performedAt: utcDateTime;
}

@doc("Request to create or update a campaign")
model CampaignRequest {
  name: string;
  type: FundraisingCampaignType;
  goal?: int64;
  startDate: plainDate;
  endDate?: plainDate;
  status: CampaignStatus;
  targetAudience?: string;
}

@doc("Request to create a donation record")
model DonationCreateRequest {
  donorId: string;
  donorType: DonorType;
  campaignId?: string;
  amount: int64;
  currency: string;
  donationDate: plainDate;
  type: DonationType;
  paymentId?: string;
  taxDeductible: boolean;
  anonymous: boolean;
}

@doc("Request to issue a tax receipt for a donation")
model IssueReceiptRequest {
  @doc("Fiscal year for the receipt")
  @minValue(2000)
  fiscalYear: int32;
}

@doc("Request to create a pledge")
model PledgeCreateRequest {
  donorId: string;
  campaignId?: string;
  totalAmount: int64;
  frequency: PledgeFrequency;
  startDate: plainDate;
  endDate?: plainDate;
}

@doc("Request to record a pledge payment installment")
model RecordPledgePaymentRequest {
  @doc("Amount paid in this installment")
  @minValue(0)
  amount: int64;

  @doc("ID of the payment transaction")
  paymentId: string;

  @doc("Date of the installment payment")
  paymentDate: plainDate;
}

@doc("Request to create a tax receipt record directly")
model TaxReceiptCreateRequest {
  donationId?: string;
  donorId: string;
  receiptNumber: string;
  fiscalYear: int32;
  amount: int64;
  issuedAt: utcDateTime;
  issuedBy: string;
}

@doc("Request to create or update a legislative issue")
model LegislativeIssueRequest {
  title: string;
  description: string;
  status: LegislativeIssueStatus;
  jurisdiction?: string;
  issueDate: plainDate;
  resolvedDate?: plainDate;
}

@doc("Request to create or update an action alert")
model ActionAlertRequest {
  issueId: string;
  title: string;
  callToAction: string;
  targetAudience?: string;
  status: ActionAlertStatus;
}

@doc("Request to send an action alert to members")
model SendActionAlertRequest {
  @doc("Override target audience for this send (null uses alert's targetAudience)")
  targetAudienceOverride?: string;
}

@doc("Request to create a PAC contribution record")
model PACContributionCreateRequest {
  contributorId: string;
  amount: int64;
  contributionDate: plainDate;
  employerName?: string;
  occupation?: string;
  reportingPeriod?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/prospects")
@tag("Association:Member")
namespace Association.Member.Fundraising {
  @doc("CRUD, search, and conversion of membership prospects")
  interface ProspectManagement {
    @doc("Create a new prospect record.")
    @operationId("createProspect")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createProspect(
      @body body: ProspectCreateRequest
    ): ApiCreatedResponse<Prospect>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a prospect by ID.")
    @operationId("getProspect")
    @get
    @route("/{prospectId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getProspect(
      @path prospectId: string
    ): ApiOkResponse<Prospect>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List prospects with optional filters.")
    @operationId("listProspects")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listProspects(
      ...PaginationQuery,
      @query source?: ProspectSource,
      @query status?: ProspectStatus,
      @query assignedTo?: string
    ): ApiOkResponse<PaginatedResponse<Prospect>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a prospect record.")
    @operationId("updateProspect")
    @patch(#{implicitOptionality: true})
    @route("/{prospectId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateProspect(
      @path prospectId: string,
      @body updates: ProspectUpdateRequest
    ): ApiOkResponse<Prospect>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a prospect record.")
    @operationId("deleteProspect")
    @delete
    @route("/{prospectId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteProspect(
      @path prospectId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Convert a prospect to a full member.")
    @operationId("convertProspect")
    @post
    @route("/{prospectId}/convert")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    convertProspect(
      @path prospectId: string,
      @body body: ConvertProspectRequest
    ): ApiOkResponse<Prospect>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Record a CRM activity against a prospect.")
    @operationId("createProspectActivity")
    @post
    @route("/{prospectId}/activities")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createProspectActivity(
      @path prospectId: string,
      @body body: ProspectActivityCreateRequest
    ): ApiCreatedResponse<ProspectActivity>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("List CRM activities for a prospect.")
    @operationId("listProspectActivities")
    @get
    @route("/{prospectId}/activities")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listProspectActivities(
      @path prospectId: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<ProspectActivity>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD and search for fundraising and membership campaigns")
  @route("/association/member/campaigns")
  interface CampaignManagement {
    @doc("Create a campaign.")
    @operationId("createCampaign")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCampaign(
      @body body: CampaignRequest
    ): ApiCreatedResponse<Campaign>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a campaign by ID.")
    @operationId("getCampaign")
    @get
    @route("/{campaignId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getCampaign(
      @path campaignId: string
    ): ApiOkResponse<Campaign>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List campaigns with optional filters.")
    @operationId("listCampaigns")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listCampaigns(
      ...PaginationQuery,
      @query type?: CampaignType,
      @query status?: CampaignStatus
    ): ApiOkResponse<PaginatedResponse<Campaign>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a campaign.")
    @operationId("updateCampaign")
    @patch(#{implicitOptionality: true})
    @route("/{campaignId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCampaign(
      @path campaignId: string,
      @body updates: CampaignRequest
    ): ApiOkResponse<Campaign>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a campaign.")
    @operationId("deleteCampaign")
    @delete
    @route("/{campaignId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCampaign(
      @path campaignId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and tax receipt issuance for donations")
  @route("/association/member/donations")
  interface DonationManagement {
    @doc("Create a donation record.")
    @operationId("createDonation")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createDonation(
      @body body: DonationCreateRequest
    ): ApiCreatedResponse<Donation>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a donation by ID.")
    @operationId("getDonation")
    @get
    @route("/{donationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getDonation(
      @path donationId: string
    ): ApiOkResponse<Donation>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List donations with optional filters.")
    @operationId("listDonations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDonations(
      ...PaginationQuery,
      @query donorId?: string,
      @query campaignId?: string,
      @query type?: DonationType
    ): ApiOkResponse<PaginatedResponse<Donation>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a donation record.")
    @operationId("updateDonation")
    @patch(#{implicitOptionality: true})
    @route("/{donationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateDonation(
      @path donationId: string,
      @body updates: DonationCreateRequest
    ): ApiOkResponse<Donation>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a donation record.")
    @operationId("deleteDonation")
    @delete
    @route("/{donationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteDonation(
      @path donationId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Issue a tax receipt for a donation.")
    @operationId("issueDonationReceipt")
    @post
    @route("/{donationId}/issue-receipt")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    issueDonationReceipt(
      @path donationId: string,
      @body body: IssueReceiptRequest
    ): ApiCreatedResponse<TaxReceipt>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and installment recording for donor pledges")
  @route("/association/member/pledges")
  interface PledgeManagement {
    @doc("Create a pledge.")
    @operationId("createPledge")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createPledge(
      @body body: PledgeCreateRequest
    ): ApiCreatedResponse<Pledge>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a pledge by ID.")
    @operationId("getPledge")
    @get
    @route("/{pledgeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getPledge(
      @path pledgeId: string
    ): ApiOkResponse<Pledge>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List pledges with optional filters.")
    @operationId("listPledges")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listPledges(
      ...PaginationQuery,
      @query donorId?: string,
      @query campaignId?: string,
      @query status?: PledgeStatus
    ): ApiOkResponse<PaginatedResponse<Pledge>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a pledge record.")
    @operationId("updatePledge")
    @patch(#{implicitOptionality: true})
    @route("/{pledgeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updatePledge(
      @path pledgeId: string,
      @body updates: PledgeCreateRequest
    ): ApiOkResponse<Pledge>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a pledge record.")
    @operationId("deletePledge")
    @delete
    @route("/{pledgeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deletePledge(
      @path pledgeId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Record a pledge payment installment.")
    @operationId("recordPledgePayment")
    @post
    @route("/{pledgeId}/record-payment")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    recordPledgePayment(
      @path pledgeId: string,
      @body body: RecordPledgePaymentRequest
    ): ApiOkResponse<Pledge>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("Create and search tax receipts")
  @route("/association/member/tax-receipts")
  interface TaxReceiptManagement {
    @doc("Create a tax receipt record.")
    @operationId("createTaxReceipt")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createTaxReceipt(
      @body body: TaxReceiptCreateRequest
    ): ApiCreatedResponse<TaxReceipt>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a tax receipt by ID.")
    @operationId("getTaxReceipt")
    @get
    @route("/{receiptId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getTaxReceipt(
      @path receiptId: string
    ): ApiOkResponse<TaxReceipt>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search tax receipts with optional filters.")
    @operationId("listTaxReceipts")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listTaxReceipts(
      ...PaginationQuery,
      @query donorId?: string,
      @query fiscalYear?: int32
    ): ApiOkResponse<PaginatedResponse<TaxReceipt>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD and search for legislative issues under active advocacy tracking")
  @route("/association/member/legislative-issues")
  interface LegislativeIssueManagement {
    @doc("Create a legislative issue.")
    @operationId("createLegislativeIssue")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createLegislativeIssue(
      @body body: LegislativeIssueRequest
    ): ApiCreatedResponse<LegislativeIssue>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a legislative issue by ID.")
    @operationId("getLegislativeIssue")
    @get
    @route("/{issueId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getLegislativeIssue(
      @path issueId: string
    ): ApiOkResponse<LegislativeIssue>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List legislative issues with optional filters.")
    @operationId("listLegislativeIssues")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listLegislativeIssues(
      ...PaginationQuery,
      @query status?: string,
      @query jurisdiction?: string
    ): ApiOkResponse<PaginatedResponse<LegislativeIssue>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a legislative issue.")
    @operationId("updateLegislativeIssue")
    @patch(#{implicitOptionality: true})
    @route("/{issueId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateLegislativeIssue(
      @path issueId: string,
      @body updates: LegislativeIssueRequest
    ): ApiOkResponse<LegislativeIssue>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a legislative issue.")
    @operationId("deleteLegislativeIssue")
    @delete
    @route("/{issueId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteLegislativeIssue(
      @path issueId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and distribution of advocacy action alerts")
  @route("/association/member/action-alerts")
  interface ActionAlertManagement {
    @doc("Create an action alert.")
    @operationId("createActionAlert")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createActionAlert(
      @body body: ActionAlertRequest
    ): ApiCreatedResponse<ActionAlert>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an action alert by ID.")
    @operationId("getActionAlert")
    @get
    @route("/{alertId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getActionAlert(
      @path alertId: string
    ): ApiOkResponse<ActionAlert>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List action alerts with optional filters.")
    @operationId("listActionAlerts")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listActionAlerts(
      ...PaginationQuery,
      @query issueId?: string,
      @query status?: ActionAlertStatus
    ): ApiOkResponse<PaginatedResponse<ActionAlert>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an action alert.")
    @operationId("updateActionAlert")
    @patch(#{implicitOptionality: true})
    @route("/{alertId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateActionAlert(
      @path alertId: string,
      @body updates: ActionAlertRequest
    ): ApiOkResponse<ActionAlert>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete an action alert.")
    @operationId("deleteActionAlert")
    @delete
    @route("/{alertId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteActionAlert(
      @path alertId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Send an action alert to the target member audience.")
    @operationId("sendActionAlert")
    @post
    @route("/{alertId}/send")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    sendActionAlert(
      @path alertId: string,
      @body body: SendActionAlertRequest
    ): ApiOkResponse<ActionAlert>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("Create and search PAC contribution records for regulatory compliance")
  @route("/association/member/pac-contributions")
  interface PACContributionManagement {
    @doc("Record a new PAC contribution.")
    @operationId("createPACContribution")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createPACContribution(
      @body body: PACContributionCreateRequest
    ): ApiCreatedResponse<PACContribution>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a PAC contribution by ID.")
    @operationId("getPACContribution")
    @get
    @route("/{contributionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getPACContribution(
      @path contributionId: string
    ): ApiOkResponse<PACContribution>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search PAC contributions with optional filters.")
    @operationId("listPACContributions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listPACContributions(
      ...PaginationQuery,
      @query contributorId?: string,
      @query status?: PACContributionStatus,
      @query reportingPeriod?: string
    ): ApiOkResponse<PaginatedResponse<PACContribution>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
