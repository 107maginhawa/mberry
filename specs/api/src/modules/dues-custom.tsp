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

// ---------------------------------------------------------------------------
// Payment Token Models
// ---------------------------------------------------------------------------

@doc("Payment token validation result — public endpoint response")
model PaymentTokenValidation {
  @doc("Whether the token is valid for use")
  valid: boolean;

  @doc("Associated invoice ID (if applicable)")
  invoiceId?: string;

  @doc("Payment amount in minor units (centavos)")
  amount?: int64;

  @doc("ISO 4217 currency code")
  currency?: string;

  @doc("Member display name")
  memberName?: string;

  @doc("Organization display name")
  orgName?: string;

  @doc("Token expiry date (ISO 8601)")
  dueDate?: string;

  @doc("Error message when token is invalid")
  error?: string;

  @doc("Status hint: already_paid, expired, etc.")
  status?: string;
}

@doc("Payment checkout response with PayMongo redirect URL")
model PaymentCheckoutResponse {
  @doc("PayMongo Checkout session URL to redirect the member to")
  checkoutUrl: string;
}

@doc("Acknowledgement of a payment gateway webhook")
model PaymentWebhookAck {
  received: boolean;
  action: string;
}

@doc("Request body for sending a payment link to a member")
model SendPaymentLinkRequest {
  @doc("Person ID of the member to send the payment link to")
  personId: string;

  @doc("Payment amount in minor units. If omitted, uses org dues config default.")
  amount?: int64;

  @doc("Invoice ID to associate with the payment (optional)")
  invoiceId?: string;
}

@doc("Response after generating a payment link")
model SendPaymentLinkResponse {
  @doc("Raw token for constructing the payment URL")
  token: string;

  @doc("Full payment URL path")
  paymentUrl: string;

  @doc("Token expiry timestamp (ISO 8601)")
  expiresAt: string;
}

@doc("Request body for a member minting a pay-link for their own dues.")
model MintMyPaymentLinkRequest {
  @doc("The member's own unpaid invoice to pay.")
  invoiceId: string;
}

// ---------------------------------------------------------------------------
// Dues Dashboard Models
// ---------------------------------------------------------------------------

@doc("Trailing collection rate per window, integer 0-100")
model DuesTrailingRates {
  @doc("Last 30 days collection rate (0-100)")
  days30: int32;

  @doc("Last 90 days collection rate (0-100)")
  days90: int32;

  @doc("Last 365 days collection rate (0-100)")
  days365: int32;
}

@doc("Monthly breakdown row")
model DuesMonthlyBreakdownRow {
  @doc("ISO month YYYY-MM")
  month: string;

  @doc("Collected amount in minor units")
  collected: int32;

  @doc("Outstanding amount in minor units")
  outstanding: int32;
}

@doc("Member status distribution from invoice statuses")
model DuesStatusDistribution {
  @doc("Active (paid) count")
  active: int32;

  @doc("Due soon (generated/sent) count")
  dueSoon: int32;

  @doc("Overdue count")
  overdue: int32;

  @doc("Lapsed (voided) count")
  lapsed: int32;
}

@doc("Top unpaid member row")
model DuesTopUnpaidRow {
  @doc("Person ID")
  personId: string;

  @doc("Member display name")
  name?: string;

  @doc("Total unpaid amount in minor units")
  unpaidAmount: int32;
}

@doc("Treasurer dues metrics — trailing rates + monthly breakdown + status distribution + top unpaid")
model DuesTreasurerMetrics {
  @doc("Trailing collection rates")
  trailingRates: DuesTrailingRates;

  @doc("Monthly breakdown (last 12 months)")
  monthlyBreakdown: DuesMonthlyBreakdownRow[];

  @doc("Status distribution snapshot")
  statusDistribution: DuesStatusDistribution;

  @doc("Top unpaid members (up to 10)")
  topUnpaid: DuesTopUnpaidRow[];
}

@doc("Invoice row in member summary (loose-typed; full invoice schema lives in DuesInvoice)")
model DuesMemberSummaryInvoice {
  @doc("Invoice ID")
  id: string;

  @doc("Invoice status")
  status: string;

  @doc("Total amount in minor units (decimal-as-string from DB)")
  totalAmount: string;

  @doc("Generated at (ISO 8601)")
  generatedAt: string;

  @doc("Due date (ISO 8601)")
  dueDate?: string;
}

@doc("Payment row in member summary")
model DuesMemberSummaryPayment {
  @doc("Payment ID")
  id: string;

  @doc("Payment status")
  status: string;

  @doc("Amount in minor units")
  amount: int64;

  @doc("Paid at (ISO 8601)")
  paidAt?: string;

  @doc("Payment method")
  method?: string;
}

@doc("Membership status timeline entry")
model DuesMemberStatusTimelineEntry {
  @doc("Previous status")
  fromStatus?: string;

  @doc("New status")
  toStatus: string;

  @doc("Changed at (ISO 8601)")
  changedAt: string;
}

@doc("Per-member financial summary — invoices, payments, balance, status timeline")
model DuesMemberSummary {
  @doc("All invoices for this member")
  invoices: DuesMemberSummaryInvoice[];

  @doc("All payments for this member (up to 100)")
  payments: DuesMemberSummaryPayment[];

  @doc("Computed balance = sum of unpaid invoice amounts")
  balance: float64;

  @doc("Membership status timeline")
  statusTimeline: DuesMemberStatusTimelineEntry[];
}

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
    @route("/dues/dashboard/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    getDuesDashboard(
      @path @doc("Organisation ID") organizationId: UUID
    ): ApiOkResponse<{ data: DuesDashboardData }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Treasurer dues metrics + per-member financial summary endpoints (TREASURER/PRESIDENT only).")
  interface DuesMetricsManagement {
    @doc("Treasurer metrics: trailing collection rates (30/90/365d), monthly breakdown (12mo), status distribution, top unpaid (10).")
    @operationId("getDuesMetrics")
    @get
    @route("/association/member/dues-metrics/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    getDuesMetrics(
      @path organizationId: UUID
    ): ApiOkResponse<{ data: DuesTreasurerMetrics }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Per-member financial detail: invoices, payments, computed balance, status timeline.")
    @operationId("getDuesMemberSummary")
    @get
    @route("/association/member/dues-member-summary/{organizationId}/{personId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Treasurer", "President"])
    getDuesMemberSummary(
      @path organizationId: UUID,
      @path personId: UUID
    ): ApiOkResponse<{ data: DuesMemberSummary }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  @doc("Public one-tap payment token endpoints — no auth required. Members click payment links from email.")
  interface PaymentTokenEndpoints {
    @doc("Validate a payment token. Returns payment details if valid, or error information if invalid/expired/used.")
    @operationId("validatePaymentToken")
    @get
    @route("/pay/{token}/validate")
    validatePaymentToken(
      @path token: string,
    ): ApiOkResponse<PaymentTokenValidation>;

    @doc("Initiate PayMongo checkout for a payment token. Single-use, idempotent (one active session per token; double-tap returns the same URL or 202 while a session is being created).")
    @operationId("checkoutPaymentToken")
    @post
    @route("/pay/{token}/checkout")
    checkoutPaymentToken(
      @path token: string,
    ): ApiOkResponse<PaymentCheckoutResponse>
      | { @statusCode statusCode: 202; @body body: PaymentCheckoutResponse }
      | ApiBadRequestResponse
      // 409 — the token was already used (payment already processed).
      | ApiConflictResponse
      // 410 — the token was revoked or has expired (gone, not retryable).
      | { @statusCode statusCode: 410; @body body: ValidationError }
      // 502 — the org's PayMongo gateway failed to create a checkout session.
      | { @statusCode statusCode: 502; @body body: ValidationError };
  }

  /**
   * Member-facing receipt endpoint. Returns the receipt rendered as HTML for
   * print / save-as-PDF. Eligible only for payments in completed / confirmed
   * states. NOTE: Response body is text/html, not JSON.
   */
  interface ReceiptEndpoints {
    @doc("Download a printable receipt for a completed dues payment. Returns text/html.")
    @operationId("downloadReceipt")
    @get
    @route("/org/{organizationId}/payments/{paymentId}/receipt")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    @extension("x-audit", #{ action: "read", resourceType: "payment_receipt", eventType: "data-access" })
    downloadReceipt(
      @path organizationId: UUID,
      @path paymentId: UUID,
    ): {
      @statusCode statusCode: 200;
      @header contentType: "text/html";
      @body body: string;
    } | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiBadRequestResponse;
  }

  @doc("Public PayMongo webhook — per-org URL; signature verified with the org's webhook secret. No bearer auth.")
  interface PayMongoWebhookEndpoints {
    @doc("Receive a PayMongo webhook for one org and reconcile the matching payment.")
    @operationId("paymongoWebhook")
    @post
    @route("/webhooks/paymongo/{organizationId}")
    paymongoWebhook(
      @path organizationId: UUID,
    ): ApiOkResponse<PaymentWebhookAck>
      | ApiBadRequestResponse
      // 409 — the event failed inbound validation (org / amount / currency mismatch).
      | ApiConflictResponse;
  }

  @doc("Officer endpoint for generating payment links")
  interface PaymentLinkManagement {
    @doc("Generate a one-tap payment link for a member. Requires officer auth and org context.")
    @operationId("sendPaymentLink")
    @post
    @route("/org/{organizationId}/payments/send-link")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-officer", true)
    sendPaymentLink(
      @path organizationId: string,
      @body body: SendPaymentLinkRequest,
    ): ApiCreatedResponse<SendPaymentLinkResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Revoke an unused payment link. Officer only.")
    @operationId("revokePaymentLink")
    @post
    @route("/org/{organizationId}/payments/{tokenId}/revoke")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-officer", true)
    revokePaymentLink(
      @path organizationId: string,
      @path tokenId: string,
    ): ApiOkResponse<{ revoked: boolean }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Mint a one-tap payment link for the authenticated member's own dues invoice (self-serve).")
    @operationId("mintMyPaymentLink")
    @post
    @route("/org/{organizationId}/payments/mint-mine")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    mintMyPaymentLink(
      @path organizationId: string,
      @body body: MintMyPaymentLinkRequest,
    ): ApiCreatedResponse<SendPaymentLinkResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      // 409 — an active payment link already exists for this invoice (double-charge guard).
      | ApiConflictResponse
      | ApiNotFoundResponse;
  }
}
