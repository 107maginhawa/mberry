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
  amount: int64;
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("Dues configuration defining amounts and fund allocations for a tier within an organization")
model DuesConfig extends BaseEntity {

  @doc("ID of the association organization this configuration applies to")
  organizationId: string;

  @doc("ID of the membership tier this configuration applies to")
  tierId: string;

  @doc("Annual dues amount in the specified currency")
  @minValue(0)
  annualAmount: int64;

  @doc("ISO 4217 currency code")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Number of days after the due date before membership lapses")
  @minValue(0)
  @maxValue(90)
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
  totalAmount: int64;

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

  @doc("ID of the association organization")
  organizationId: string;

  @doc("Date on which this aging snapshot was calculated")
  asOfDate: plainDate;

  @doc("Total outstanding balance for invoices not yet past due")
  @minValue(0)
  current: int64;

  @doc("Total outstanding balance for invoices 1–30 days past due")
  @minValue(0)
  thirtyDay: int64;

  @doc("Total outstanding balance for invoices 31–60 days past due")
  @minValue(0)
  sixtyDay: int64;

  @doc("Total outstanding balance for invoices 61–90 days past due")
  @minValue(0)
  ninetyDay: int64;

  @doc("Total outstanding balance for invoices more than 90 days past due")
  @minValue(0)
  overNinety: int64;

  @doc("Sum of all outstanding balances across all aging buckets")
  @minValue(0)
  totalOutstanding: int64;
}

@doc("Template used to generate dunning communications at a specific collection stage")
model DunningTemplate extends BaseEntity {

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
  annualAmount: int64;
  currency: string;
  @minValue(0)
  @maxValue(90)
  gracePeriodDays: int32;
  fundAllocations: FundAllocation[];
  effectiveDate: plainDate;
  status: DuesConfigStatus;
}

@doc("Request to update a dues configuration")
model DuesConfigUpdateRequest {
  annualAmount?: int64;
  @doc("ISO 4217 currency code")
  currency?: string;
  @doc("Billing cadence for dues (org-level config)")
  billingFrequency?: "annual" | "semi-annual" | "quarterly";
  @minValue(0)
  @maxValue(90)
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
// Payment, Gateway, and Reporting Models
// ---------------------------------------------------------------------------

@doc("Payment method for dues")
enum DuesPaymentMethod {
  online: "online",
  cash: "cash",
  check: "check",
  bankTransfer: "bankTransfer",
  gcash: "gcash",
  other: "other",
}

@doc("Status of a dues payment")
enum DuesPaymentStatus {
  pending: "pending",
  completed: "completed",
  failed: "failed",
  refunded: "refunded",
  partiallyRefunded: "partiallyRefunded",
  expired: "expired",

  @doc("Payment proof submitted by member, awaiting officer review")
  submitted: "submitted",

  @doc("Payment proof is being reviewed by an officer")
  underReview: "underReview",

  @doc("Payment proof confirmed by officer — funds allocated, expiry extended")
  confirmed: "confirmed",

  @doc("Payment proof rejected by officer")
  rejected: "rejected",
}

@doc("Payment gateway provider")
enum GatewayProvider {
  paymongo: "paymongo",
  stripe: "stripe",
}

@doc("A recorded dues payment from a member")
model DuesPayment extends BaseEntity {
  @doc("ID of the association organization")
  organizationId: string;

  @doc("ID of the member person")
  personId: string;

  @doc("ID of the related invoice, if any")
  invoiceId?: string;

  @doc("Human-readable receipt number")
  @minLength(1)
  @maxLength(50)
  receiptNumber: string;

  @doc("Payment amount in minor currency units")
  @minValue(0)
  amount: int64;

  @doc("ISO 4217 currency code")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Payment method used")
  paymentMethod: DuesPaymentMethod;

  @doc("External reference number from the payment provider")
  @maxLength(100)
  referenceNumber?: string;

  @doc("Lifecycle status of this payment")
  status: DuesPaymentStatus;

  @doc("ID of the staff member who recorded this payment")
  recordedBy?: string;

  @doc("Date from which the membership was extended")
  membershipExtendedFrom?: plainDate;

  @doc("Date to which the membership was extended")
  membershipExtendedTo?: plainDate;

  @doc("Timestamp when payment was received")
  paidAt?: utcDateTime;

  @doc("Amount already refunded in minor currency units")
  @minValue(0)
  refundedAmount: int64;

  @doc("Breakdown of this payment's amount by fund (populated after settlement)")
  fundAllocations?: DuesInvoiceAllocation[];

  @doc("Proof of payment details (populated for proof-based submissions)")
  proof?: DuesPaymentProof;

  @doc("Reason for rejection by officer (populated when status is rejected)")
  @maxLength(500)
  rejectionReason?: string;
}

@doc("Request to record a manual dues payment")
model RecordPaymentRequest {
  @doc("ID of the organization")
  organizationId: string;

  @doc("ID of the member person")
  personId: string;

  @doc("Optional invoice to link this payment to")
  invoiceId?: string;

  @doc("Payment amount in minor currency units")
  @minValue(1)
  amount: int64;

  @doc("ISO 4217 currency code")
  currency: string;

  @doc("Payment method")
  paymentMethod: DuesPaymentMethod;

  @doc("External reference number")
  referenceNumber?: string;

  @doc("Timestamp when payment was received")
  paidAt?: utcDateTime;
}

@doc("Request to refund a dues payment")
model DuesRefundRequest {
  @doc("Amount to refund in minor currency units; omit for full refund")
  @minValue(1)
  amount?: int64;

  @doc("Reason for the refund")
  @maxLength(500)
  reason?: string;
}

@doc("Gateway configuration for a payment provider")
model GatewayConfig extends BaseEntity {
  @doc("ID of the association organization")
  organizationId: string;

  @doc("Payment gateway provider")
  provider: GatewayProvider;

  @doc("Public key for the payment provider")
  @minLength(1)
  @maxLength(255)
  publicKey: string;

  @doc("Whether the gateway connection has been tested and confirmed")
  connected: boolean;

  @doc("Timestamp of the most recent connection test")
  lastTestAt?: utcDateTime;
}

@doc("Request to configure or update a payment gateway")
model GatewayConfigRequest {
  @doc("Payment gateway provider")
  provider: GatewayProvider;

  @doc("Public key for the payment provider")
  @minLength(1)
  @maxLength(255)
  publicKey: string;

  @doc("Secret key for the payment provider (write-only; never returned)")
  @minLength(1)
  secretKey: string;

  @doc("Webhook signing secret for the payment provider (write-only; never returned). Optional — keys can be set first, webhook later.")
  webhookSecret?: string;
}

@doc("Result of a gateway connection test")
model GatewayTestResult {
  @doc("Whether the connection test succeeded")
  success: boolean;

  @doc("Human-readable message from the test")
  @maxLength(500)
  message: string;

  @doc("Timestamp when the test was performed")
  testedAt: utcDateTime;
}

@doc("A dues fund allocation pool for an organization")
model DuesFund extends BaseEntity {
  @doc("ID of the association organization")
  organizationId: string;

  @doc("Name of the fund")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Percentage of each payment allocated to this fund")
  percentage: float64;

  @doc("Sort order for display")
  sortOrder: int32;

  @doc("Whether this fund is currently active")
  active: boolean;
}

@doc("Request to upsert dues fund allocations for an organization")
model UpsertFundsRequest {
  @doc("Full replacement list of fund allocations (percentages must sum to 100)")
  funds: FundAllocation[];
}

@doc("Financial dashboard statistics for an organization")
model FinancialDashboard {
  @doc("Total amount collected from completed payments")
  totalCollected: int64;

  @doc("Total outstanding amount from pending payments")
  totalOutstanding: int64;

  @doc("Number of pending payment records")
  pendingCount: int32;

  @doc("Number of completed payment records")
  completedCount: int32;

  @doc("Total number of payment records")
  totalCount: int32;

  @doc("Percentage of payments that have been completed (0–100)")
  collectionRate: int32;

  @doc("Whether a payment gateway is configured for this organization")
  gatewayConfigured: boolean;

  @doc("Number of memberships expiring this month")
  expiringThisMonth: int32;
}

enum DuesReportType {
  collection: "collection",
  fund_breakdown: "fund_breakdown",
  dues_status: "dues_status",
  aging: "aging",
}

@doc("Dues collection report entry grouped by month and payment method")
model DuesReportEntry {
  @doc("Year-month string in YYYY-MM format")
  month?: string;

  @doc("Payment method for this group")
  method?: DuesPaymentMethod;

  @doc("Number of payments in this group")
  count?: int32;

  @doc("Total amount collected in this group (minor currency units)")
  total?: int64;

  @doc("Fund ID (fund_breakdown type)")
  fundId?: string;

  @doc("Fund name (fund_breakdown type)")
  fundName?: string;

  @doc("Fund percentage (fund_breakdown type)")
  percentage?: float64;

  @doc("Total allocated amount (fund_breakdown type)")
  totalAllocated?: int64;

  @doc("Total reversals amount (fund_breakdown type)")
  totalReversals?: int64;

  @doc("Net total after reversals (fund_breakdown type)")
  netTotal?: int64;

  @doc("Person ID (dues_status and aging types)")
  personId?: string;

  @doc("Total paid amount (dues_status type)")
  totalPaid?: int64;

  @doc("Last payment date (dues_status type)")
  lastPaymentDate?: string;

  @doc("Number of payments (dues_status type)")
  paymentCount?: int32;

  @doc("Payment amount (aging type)")
  amount?: int64;

  @doc("Days pending (aging type)")
  daysPending?: int32;
}

@doc("Summary statistics for a dues report")
model DuesReportSummary {
  @doc("Total collected amount (collection type)")
  totalCollected?: int64;

  @doc("Number of rows (collection type)")
  rowCount?: int32;

  @doc("Number of funds (fund_breakdown type)")
  fundCount?: int32;

  @doc("Number of members (dues_status type)")
  memberCount?: int32;

  @doc("Number of overdue payments (aging type)")
  totalOverdue?: int32;
}

@doc("Dues report response with data entries and summary")
model DuesReportResponse {
  @doc("Report data entries")
  data: DuesReportEntry[];

  @doc("Summary statistics")
  summary: DuesReportSummary;

  @doc("Report metadata")
  meta: {
    @doc("Report type")
    type: DuesReportType;

    @doc("Date range start")
    from: string;

    @doc("Date range end")
    to: string;
  };
}

// ---------------------------------------------------------------------------
// Proof Upload Models
// ---------------------------------------------------------------------------

@doc("Proof of payment attached to a dues payment submission")
model DuesPaymentProof {
  @doc("ID of the associated payment")
  paymentId: string;

  @doc("Storage key referencing the uploaded proof file")
  @minLength(1)
  @maxLength(500)
  storageKey: string;

  @doc("Original file name of the uploaded proof")
  @minLength(1)
  @maxLength(255)
  fileName: string;

  @doc("MIME type of the uploaded proof (image/jpeg, image/png, application/pdf)")
  @minLength(1)
  @maxLength(100)
  mimeType: string;

  @doc("Timestamp when the proof was uploaded")
  uploadedAt: utcDateTime;
}

@doc("Request for a member to submit a dues payment with proof of transfer")
model SubmitPaymentProofRequest {
  @doc("ID of the invoice being paid")
  invoiceId: string;

  @doc("Payment amount in minor currency units")
  @minValue(1)
  amount: int64;

  @doc("ISO 4217 currency code")
  currency: string;

  @doc("Payment method used (bankTransfer, gcash)")
  paymentMethod: DuesPaymentMethod;

  @doc("External reference number (e.g. GCash ref, bank transfer ref)")
  @maxLength(100)
  referenceNumber?: string;

  @doc("Storage key of the uploaded proof file (from storage upload)")
  @minLength(1)
  @maxLength(500)
  proofStorageKey: string;

  @doc("Original file name of the proof")
  @minLength(1)
  @maxLength(255)
  proofFileName: string;

  @doc("MIME type of the proof file")
  @minLength(1)
  @maxLength(100)
  proofMimeType: string;
}

@doc("Request for an officer to confirm a submitted payment proof")
model ConfirmPaymentProofRequest {
  @doc("Optional note from the officer")
  @maxLength(500)
  note?: string;
}

@doc("Request for an officer to reject a submitted payment proof")
model RejectPaymentProofRequest {
  @doc("Reason for rejection — shown to the member")
  @minLength(1)
  @maxLength(500)
  reason: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Member.Dues {
  @doc("CRUD and search for dues configurations")
  interface DuesConfigManagement {
    @doc("Create a new dues configuration.")
    @operationId("createDuesConfig")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "dues-config" })
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
    @extension("x-require-position", #["Treasurer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "dues-config" })
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
    @extension("x-require-position", #["Treasurer", "President"])
    @extension("x-audit", #{ action: "delete", resourceType: "dues-config" })
    deleteDuesConfig(
      @path duesConfigId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and payment lifecycle for dues invoices")
  interface DuesInvoiceManagement {
    @doc("Create a dues invoice manually.")
    @operationId("createDuesInvoice")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "dues-invoice" })
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
    @extension("x-security-required-roles", #["association:admin", "association:member"])
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
    @extension("x-audit", #{ action: "update", resourceType: "dues-invoice" })
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
    @extension("x-audit", #{ action: "delete", resourceType: "dues-invoice" })
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
    @extension("x-audit", #{ action: "create", resourceType: "dues-invoice" })
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
    @extension("x-audit", #{ action: "mark-paid", resourceType: "dues-invoice" })
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
    @extension("x-require-position", #["Treasurer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "aging-bucket" })
    recalculateAgingBucket(
      @path organizationId: string
    ): ApiOkResponse<AgingBucket>
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, and execution of dunning templates and runs")
  interface DunningManagement {
    @doc("Create a new dunning template.")
    @operationId("createDunningTemplate")
    @post
    @route("/templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
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
    @extension("x-require-position", #["Treasurer", "President"])
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
    @extension("x-require-position", #["Treasurer", "President"])
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
    @extension("x-require-position", #["Treasurer", "President"])
    runDunning(
      @body body: RunDunningRequest
    ): ApiOkResponse<DunningRunResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Record, retrieve, and refund dues payments")
  interface DuesPaymentManagement {
    @doc("List dues payments with optional filters.")
    @operationId("listDuesPayments")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    listDuesPayments(
      ...PaginationQuery,
      @query organizationId?: string,
      @query personId?: string,
      @query status?: DuesPaymentStatus
    ): ApiOkResponse<PaginatedResponse<DuesPayment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a dues payment by ID.")
    @operationId("getDuesPayment")
    @get
    @route("/{paymentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    getDuesPayment(
      @path paymentId: string
    ): ApiOkResponse<DuesPayment>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Record a manual dues payment for a member.")
    @operationId("recordDuesPayment")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "create", resourceType: "dues-payment" })
    recordDuesPayment(
      @body body: RecordPaymentRequest
    ): ApiCreatedResponse<DuesPayment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Refund a dues payment fully or partially.")
    @operationId("refundDuesPayment")
    @post
    @route("/{paymentId}/refund")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "update", resourceType: "dues-payment" })
    refundDuesPayment(
      @path paymentId: string,
      @body body: DuesRefundRequest
    ): ApiOkResponse<DuesPayment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("Proof-based payment submission and officer review workflow")
  interface DuesPaymentProofManagement {
    @doc("Submit a dues payment with proof of transfer (member-facing).")
    @operationId("submitPaymentProof")
    @post
    @route("/submit-proof")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    @extension("x-audit", #{ action: "create", resourceType: "dues-payment-proof" })
    submitPaymentProof(
      @body body: SubmitPaymentProofRequest
    ): ApiCreatedResponse<DuesPayment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Confirm a submitted payment proof (officer-facing). Triggers fund allocation and expiry extension.")
    @operationId("confirmPaymentProof")
    @post
    @route("/{paymentId}/confirm")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "approve", resourceType: "dues-payment-proof" })
    confirmPaymentProof(
      @path paymentId: string,
      @body body: ConfirmPaymentProofRequest
    ): ApiOkResponse<DuesPayment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Reject a submitted payment proof (officer-facing).")
    @operationId("rejectPaymentProof")
    @post
    @route("/{paymentId}/reject")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-audit", #{ action: "deny", resourceType: "dues-payment-proof" })
    rejectPaymentProof(
      @path paymentId: string,
      @body body: RejectPaymentProofRequest
    ): ApiOkResponse<DuesPayment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("List pending payment proofs awaiting officer review for an organization.")
    @operationId("listPendingProofs")
    @get
    @route("/pending-proofs")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listPendingProofs(
      ...PaginationQuery,
      @query organizationId: string
    ): ApiOkResponse<PaginatedResponse<DuesPayment>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Configure, test, and disconnect the payment gateway for an organization")
  interface DuesGatewayManagement {
    @doc("Get the payment gateway configuration for an organization.")
    @operationId("getDuesGatewayConfig")
    @get
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getDuesGatewayConfig(
      @path organizationId: string
    ): ApiOkResponse<GatewayConfig>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Create or update the payment gateway configuration for an organization.")
    @operationId("upsertDuesGatewayConfig")
    @put
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "dues-gateway" })
    upsertDuesGatewayConfig(
      @path organizationId: string,
      @body body: GatewayConfigRequest
    ): ApiOkResponse<GatewayConfig>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Test the payment gateway connection for an organization.")
    @operationId("testDuesGatewayConnection")
    @post
    @route("/{organizationId}/test")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    testDuesGatewayConnection(
      @path organizationId: string
    ): ApiOkResponse<GatewayTestResult>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Disconnect and remove the payment gateway configuration for an organization.")
    @operationId("disconnectDuesGateway")
    @delete
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    @extension("x-audit", #{ action: "delete", resourceType: "dues-gateway" })
    disconnectDuesGateway(
      @path organizationId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("Fund allocation management and financial reporting for dues")
  interface DuesReportingService {
    @doc("List dues fund allocations for an organization.")
    @operationId("listDuesFunds")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDuesFunds(
      @query organizationId: string
    ): ApiOkResponse<PaginatedResponse<DuesFund>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Replace the fund allocations for an organization.")
    @operationId("upsertDuesFunds")
    @put
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "dues-funds" })
    upsertDuesFunds(
      @path organizationId: string,
      @body body: UpsertFundsRequest
    ): ApiOkResponse<PaginatedResponse<DuesFund>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get financial dashboard statistics for an organization.")
    @operationId("getDuesFinancialDashboard")
    @get
    @route("/{organizationId}/dashboard")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getDuesFinancialDashboard(
      @path organizationId: string
    ): ApiOkResponse<FinancialDashboard>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Generate a dues report for an organization. Type selects the report variant.")
    @operationId("generateDuesReport")
    @get
    @route("/{organizationId}/report")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    generateDuesReport(
      @path organizationId: string,
      @query type: DuesReportType,
      @query from?: utcDateTime,
      @query to?: utcDateTime
    ): ApiOkResponse<DuesReportResponse>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
