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
 * Association Member Lifecycle — Domain 20: Dues, Accounts Receivable & Dunning
 *
 * Covers dues configuration, invoice generation, fund allocations, aging buckets,
 * dunning templates, and dunning event tracking.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a dues invoice")
enum DuesInvoiceStatus {
  @doc("Invoice has been generated but not yet sent")
  generated: "generated",

  @doc("Invoice has been sent to the member")
  sent: "sent",

  @doc("Invoice has been paid in full")
  paid: "paid",

  @doc("Invoice is past its due date and unpaid")
  overdue: "overdue",

  @doc("Invoice has been voided")
  cancelled: "cancelled",

  @doc("Balance has been written off as uncollectible")
  writtenOff: "writtenOff",
}

@doc("Status of a dues configuration record")
enum DuesConfigStatus {
  @doc("This configuration is currently in effect")
  active: "active",

  @doc("This configuration is no longer applied to new invoices")
  retired: "retired",
}

@doc("Status of a dunning template")
enum DunningTemplateStatus {
  @doc("Template is used in dunning runs")
  active: "active",

  @doc("Template is disabled and will not be used")
  inactive: "inactive",
}

@doc("Channel through which a dunning communication is delivered")
enum DunningChannel {
  @doc("Email delivery")
  email: "email",

  @doc("SMS delivery")
  sms: "sms",

  @doc("Physical letter delivery")
  letter: "letter",
}

// ---------------------------------------------------------------------------
// Value Models (non-entity, embedded)
// ---------------------------------------------------------------------------

@doc("Allocation of dues revenue to a named fund")
model FundAllocation {
  @doc("Name of the fund receiving the allocation")
  @minLength(1)
  @maxLength(100)
  fundName: string;

  @doc("Percentage of the dues amount allocated to this fund (0–100)")
  @minValue(0)
  @maxValue(100)
  percentage: float64;

  @doc("When true, this fund absorbs rounding differences to ensure allocations sum to the total")
  isLast: boolean;
}

@doc("Computed allocation of a specific invoice's revenue to a named fund")
model DuesInvoiceAllocation {
  @doc("Name of the fund receiving the allocation")
  @minLength(1)
  @maxLength(100)
  fundName: string;

  @doc("Exact monetary amount allocated to this fund for this invoice")
  @minValue(0)
  amount: float64;
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("Dues configuration defining amounts and fund allocations for a tier within an organization")
model DuesConfig extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the association organization this configuration applies to")
  organizationId: string;

  @doc("ID of the membership tier this configuration applies to")
  tierId: string;

  @doc("Annual dues amount in the specified currency")
  @minValue(0)
  annualAmount: float64;

  @doc("ISO 4217 currency code")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Number of days after the due date before membership lapses")
  @minValue(0)
  gracePeriodDays: int32;

  @doc("Fund allocation rules — percentages must sum to 100")
  fundAllocations: FundAllocation[];

  @doc("Date from which this configuration takes effect")
  effectiveDate: plainDate;

  @doc("Lifecycle status of this configuration")
  status: DuesConfigStatus;
}

@doc("Dues invoice issued to a member for a renewal period")
model DuesInvoice extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the membership this invoice was generated for")
  membershipId: string;

  @doc("ID of the member person")
  personId: string;

  @doc("ID of the association organization")
  organizationId: string;

  @doc("Human-readable invoice number")
  @minLength(1)
  @maxLength(50)
  invoiceNumber: string;

  @doc("Start of the period covered by this invoice")
  periodStart: plainDate;

  @doc("End of the period covered by this invoice")
  periodEnd: plainDate;

  @doc("Total invoiced amount")
  @minValue(0)
  totalAmount: float64;

  @doc("Breakdown of the total amount by fund")
  fundAllocations: DuesInvoiceAllocation[];

  @doc("Current payment status of this invoice")
  status: DuesInvoiceStatus;

  @doc("Timestamp when the invoice was generated")
  generatedAt: utcDateTime;

  @doc("Timestamp when the invoice was sent to the member")
  sentAt?: utcDateTime;

  @doc("Timestamp when payment was received")
  paidAt?: utcDateTime;

  @doc("ID of the payment transaction that settled this invoice")
  paymentId?: string;
}

@doc("Accounts-receivable aging snapshot for an organization as of a specific date")
model AgingBucket extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the association organization")
  organizationId: string;

  @doc("Date on which this aging snapshot was calculated")
  asOfDate: plainDate;

  @doc("Total outstanding balance for invoices not yet past due")
  @minValue(0)
  current: float64;

  @doc("Total outstanding balance for invoices 1–30 days past due")
  @minValue(0)
  thirtyDay: float64;

  @doc("Total outstanding balance for invoices 31–60 days past due")
  @minValue(0)
  sixtyDay: float64;

  @doc("Total outstanding balance for invoices 61–90 days past due")
  @minValue(0)
  ninetyDay: float64;

  @doc("Total outstanding balance for invoices more than 90 days past due")
  @minValue(0)
  overNinety: float64;

  @doc("Sum of all outstanding balances across all aging buckets")
  @minValue(0)
  totalOutstanding: float64;
}

@doc("Template used to generate dunning communications at a specific collection stage")
model DunningTemplate extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("Display name of this template")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Collection stage (1 = earliest reminder, 5 = final notice)")
  @minValue(1)
  @maxValue(5)
  stage: int32;

  @doc("Number of days after the due date when this stage is triggered")
  @minValue(0)
  daysAfterDue: int32;

  @doc("Communication channel for this template")
  channel: DunningChannel;

  @doc("Subject line for email channel communications")
  @maxLength(200)
  subject?: string;

  @doc("Body content of the dunning communication (supports template variables)")
  @minLength(1)
  body: string;

  @doc("Whether this template is active in dunning runs")
  status: DunningTemplateStatus;
}

@doc("Record of a dunning communication sent to a member")
model DunningEvent extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the membership this dunning event targets")
  membershipId: string;

  @doc("ID of the member person")
  personId: string;

  @doc("ID of the dunning template used")
  templateId: string;

  @doc("Collection stage at which this event was sent")
  @minValue(1)
  @maxValue(5)
  stage: int32;

  @doc("Timestamp when the dunning communication was dispatched")
  sentAt: utcDateTime;

  @doc("Channel through which the communication was sent")
  channel: DunningChannel;

  @doc("Delivery status reported by the downstream channel provider")
  @maxLength(100)
  deliveryStatus?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a dues configuration")
model DuesConfigCreateRequest {
  organizationId: string;
  tierId: string;
  annualAmount: float64;
  currency: string;
  gracePeriodDays: int32;
  fundAllocations: FundAllocation[];
  effectiveDate: plainDate;
  status: DuesConfigStatus;
}

@doc("Request to update a dues configuration")
model DuesConfigUpdateRequest {
  annualAmount?: float64;
  gracePeriodDays?: int32;
  fundAllocations?: FundAllocation[];
  effectiveDate?: plainDate;
  status?: DuesConfigStatus;
}

@doc("Request to generate dues invoices for all eligible members in an organization")
model GenerateInvoicesRequest {
  @doc("ID of the organization for which to generate invoices")
  organizationId: string;

  @doc("Renewal period start date")
  periodStart: plainDate;

  @doc("Renewal period end date")
  periodEnd: plainDate;
}

@doc("Request to mark a dues invoice as paid")
model MarkInvoicePaidRequest {
  @doc("ID of the payment transaction")
  paymentId: string;

  @doc("Timestamp when payment was received")
  paidAt: utcDateTime;
}

@doc("Request to create a dunning template")
model DunningTemplateCreateRequest {
  name: string;
  stage: int32;
  daysAfterDue: int32;
  channel: DunningChannel;
  subject?: string;
  body: string;
  status: DunningTemplateStatus;
}

@doc("Request to update a dunning template")
model DunningTemplateUpdateRequest {
  name?: string;
  daysAfterDue?: int32;
  channel?: DunningChannel;
  subject?: string | null;
  body?: string;
  status?: DunningTemplateStatus;
}

@doc("Request to execute a dunning run for an organization")
model RunDunningRequest {
  @doc("ID of the organization for which to run dunning")
  organizationId: string;

  @doc("Dry-run mode — evaluate which members would be contacted but do not send")
  dryRun?: boolean;
}

@doc("Result summary of a dunning run")
model DunningRunResult {
  @doc("Number of members evaluated")
  evaluated: int32;

  @doc("Number of dunning events sent (or would be sent in dry-run)")
  sent: int32;

  @doc("Whether this was a dry run")
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/dues-configs")
@tag("Association:Member")
namespace Association.Member.Dues {
  @doc("CRUD and search for dues configurations")
  interface DuesConfigManagement {
    @doc("Create a new dues configuration.")
    @operationId("createDuesConfig")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createDuesConfig(
      @body body: DuesConfigCreateRequest
    ): ApiCreatedResponse<DuesConfig>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a dues configuration by ID.")
    @operationId("getDuesConfig")
    @get
    @route("/{duesConfigId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getDuesConfig(
      @path duesConfigId: string
    ): ApiOkResponse<DuesConfig>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List dues configurations.")
    @operationId("listDuesConfigs")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDuesConfigs(
      ...PaginationQuery,
      @query organizationId?: string,
      @query tierId?: string
    ): ApiOkResponse<PaginatedResponse<DuesConfig>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a dues configuration.")
    @operationId("updateDuesConfig")
    @patch(#{implicitOptionality: true})
    @route("/{duesConfigId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateDuesConfig(
      @path duesConfigId: string,
      @body updates: DuesConfigUpdateRequest
    ): ApiOkResponse<DuesConfig>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a dues configuration.")
    @operationId("deleteDuesConfig")
    @delete
    @route("/{duesConfigId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteDuesConfig(
      @path duesConfigId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and payment lifecycle for dues invoices")
  @route("/association/member/dues-invoices")
  interface DuesInvoiceManagement {
    @doc("Create a dues invoice manually.")
    @operationId("createDuesInvoice")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createDuesInvoice(
      @body body: DuesInvoice
    ): ApiCreatedResponse<DuesInvoice>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a dues invoice by ID.")
    @operationId("getDuesInvoice")
    @get
    @route("/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getDuesInvoice(
      @path invoiceId: string
    ): ApiOkResponse<DuesInvoice>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List dues invoices with optional filters.")
    @operationId("listDuesInvoices")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDuesInvoices(
      ...PaginationQuery,
      @query organizationId?: string,
      @query membershipId?: string,
      @query status?: DuesInvoiceStatus
    ): ApiOkResponse<PaginatedResponse<DuesInvoice>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a dues invoice.")
    @operationId("updateDuesInvoice")
    @patch(#{implicitOptionality: true})
    @route("/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateDuesInvoice(
      @path invoiceId: string,
      @body updates: DuesInvoice
    ): ApiOkResponse<DuesInvoice>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a dues invoice.")
    @operationId("deleteDuesInvoice")
    @delete
    @route("/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteDuesInvoice(
      @path invoiceId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Generate dues invoices in bulk for all eligible members in an organization.")
    @operationId("generateDuesInvoicesForOrg")
    @post
    @route("/generate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    generateDuesInvoicesForOrg(
      @body body: GenerateInvoicesRequest
    ): ApiOkResponse<PaginatedResponse<DuesInvoice>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Mark a dues invoice as paid.")
    @operationId("markDuesInvoicePaid")
    @post
    @route("/{invoiceId}/mark-paid")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    markDuesInvoicePaid(
      @path invoiceId: string,
      @body body: MarkInvoicePaidRequest
    ): ApiOkResponse<DuesInvoice>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("Retrieve and recalculate AR aging buckets")
  @route("/association/member/aging-buckets")
  interface AgingBucketService {
    @doc("Get the most recent aging bucket snapshot for an organization.")
    @operationId("getAgingBucket")
    @get
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getAgingBucket(
      @path organizationId: string
    ): ApiOkResponse<AgingBucket>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Recalculate the aging bucket for an organization as of today.")
    @operationId("recalculateAgingBucket")
    @post
    @route("/{organizationId}/recalculate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    recalculateAgingBucket(
      @path organizationId: string
    ): ApiOkResponse<AgingBucket>
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and execution of dunning templates and runs")
  @route("/association/member/dunning")
  interface DunningManagement {
    @doc("Create a new dunning template.")
    @operationId("createDunningTemplate")
    @post
    @route("/templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createDunningTemplate(
      @body body: DunningTemplateCreateRequest
    ): ApiCreatedResponse<DunningTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a dunning template by ID.")
    @operationId("getDunningTemplate")
    @get
    @route("/templates/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getDunningTemplate(
      @path templateId: string
    ): ApiOkResponse<DunningTemplate>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List dunning templates.")
    @operationId("listDunningTemplates")
    @get
    @route("/templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDunningTemplates(
      ...PaginationQuery,
      @query stage?: int32
    ): ApiOkResponse<PaginatedResponse<DunningTemplate>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a dunning template.")
    @operationId("updateDunningTemplate")
    @patch(#{implicitOptionality: true})
    @route("/templates/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateDunningTemplate(
      @path templateId: string,
      @body updates: DunningTemplateUpdateRequest
    ): ApiOkResponse<DunningTemplate>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a dunning template.")
    @operationId("deleteDunningTemplate")
    @delete
    @route("/templates/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteDunningTemplate(
      @path templateId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Search dunning events sent to members.")
    @operationId("listDunningEvents")
    @get
    @route("/events")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDunningEvents(
      ...PaginationQuery,
      @query membershipId?: string,
      @query stage?: int32
    ): ApiOkResponse<PaginatedResponse<DunningEvent>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Execute a dunning run for an organization, sending stage-appropriate communications.")
    @operationId("runDunning")
    @post
    @route("/run")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    runDunning(
      @body body: RunDunningRequest
    ): ApiOkResponse<DunningRunResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
