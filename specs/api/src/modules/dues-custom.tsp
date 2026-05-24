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

@doc("Payment checkout response with Stripe redirect URL")
model PaymentCheckoutResponse {
  @doc("Stripe Checkout session URL to redirect the member to")
  checkoutUrl: string;
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

// ---------------------------------------------------------------------------
// Dues Dashboard Models
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
    @route("/dues/dashboard/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getDuesDashboard(
      @path @doc("Organisation ID") organizationId: UUID
    ): ApiOkResponse<{ data: DuesDashboardData }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
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

    @doc("Initiate Stripe checkout for a payment token. Creates a checkout session and returns the redirect URL. Token is single-use (double-pay prevention).")
    @operationId("checkoutPaymentToken")
    @post
    @route("/pay/{token}/checkout")
    checkoutPaymentToken(
      @path token: string,
    ): ApiOkResponse<PaymentCheckoutResponse>
      | ApiBadRequestResponse;
  }

  @doc("Officer endpoint for generating payment links")
  interface PaymentLinkManagement {
    @doc("Generate a one-tap payment link for a member. Requires officer auth and org context.")
    @operationId("sendPaymentLink")
    @post
    @route("/org/{organizationId}/payments/send-link")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    sendPaymentLink(
      @path organizationId: string,
      @body body: SendPaymentLinkRequest,
    ): ApiCreatedResponse<SendPaymentLinkResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
