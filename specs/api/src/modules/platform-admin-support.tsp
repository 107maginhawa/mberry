import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Platform Admin — Support / Breach / Billing endpoints (FIX-011 / G7)
 *
 * Migrates the previously hand-wired `/admin/tickets`, `/admin/breaches`,
 * `/admin/pricing`, and `/admin/subscriptions` routes into TypeSpec so they
 * appear in OpenAPI and generate SDK hooks (unblocks the FIX-013 admin UI).
 *
 * Preservation contract (do not break on regen):
 *   - All routes live under `/admin/*`, so the existing
 *     `app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware())`
 *     gate in app.ts still sets `ctx.platformAdmin` for every one of them.
 *   - `@extension("x-security-required-roles", #["platform_admin"])` mirrors the
 *     sibling admin routes (getCommittee, getPlatformSummary, …) and documents
 *     the platform-admin requirement in the spec.
 *   - Per-handler admin-tier RBAC (super-only / support-or-super, FIX-008) lives
 *     INSIDE the handler bodies and survives regen unchanged — it is NOT
 *     duplicated here.
 *   - `updateBreachStatus` already calls `auditAction()` inline in its handler,
 *     so NO `x-audit` extension is declared (avoids double-audit). None of the
 *     other migrated handlers audit, so none get an `x-audit` extension.
 *   - Request bodies mirror what the handlers actually READ via
 *     `ctx.req.json()` (not the stale app.ts zValidator shapes). Generated zod
 *     objects strip unknown keys (no `.strict()`) and the handlers read the raw
 *     body, so optional fields keep currently-valid requests from being rejected.
 *
 * Note: `createTicket` (POST /support/tickets) is intentionally LEFT hand-wired
 * — it is public-authenticated (any signed-in user) and must NOT sit behind the
 * `/admin/*` platform-admin gate.
 */

// ---------------------------------------------------------------------------
// Request models (mirror handler reads)
// ---------------------------------------------------------------------------

@doc("Request body to record a new personal-data breach incident (DPA 2012 / M3-R11)")
model PaReportBreachRequest {
  @doc("Organisation the breach affects (optional)")
  organizationId?: UUID;

  @doc("ISO timestamp the breach was discovered")
  discoveredAt: string;

  @doc("Description of the breach")
  @minLength(1)
  @maxLength(5000)
  description: string;

  @doc("Number of affected records")
  affectedRecordsCount?: int32;

  @doc("Categories of data involved")
  dataCategories?: string[];
}

@doc("Request body to transition a breach incident's status")
model PaUpdateBreachStatusRequest {
  @doc("Target status: investigating, notified, or resolved")
  status: string;

  @doc("NPC reference number (required when transitioning to notified)")
  npcReferenceNumber?: string;
}

@doc("Request body to transition a support ticket's status")
model PaUpdateTicketStatusRequest {
  @doc("Target ticket status")
  status?: string;

  @doc("User the ticket is assigned to")
  assignedTo?: UUID;

  @doc("Resolution note")
  resolution?: string;
}

@doc("Request body to add a comment to a support ticket")
model PaAddTicketCommentRequest {
  @doc("Comment body")
  @minLength(1)
  content: string;

  @doc("When true, the note is internal (admin-only visibility)")
  isInternal?: boolean;
}

@doc("Request body to create or update a pricing tier")
model PaPricingTierRequest {
  @doc("Tier display name")
  name?: string;

  @doc("URL-safe tier slug")
  slug?: string;

  @doc("Monthly price in cents")
  monthlyPrice?: int32;

  @doc("Annual price in cents")
  annualPrice?: int32;

  @doc("ISO 4217 currency code")
  currency?: string;

  @doc("Maximum members allowed on the tier")
  maxMembers?: int32;

  @doc("Trial period length in days")
  trialDays?: int32;

  @doc("Feature flags / labels included in the tier")
  features?: string[];

  @doc("Whether the tier is active and selectable")
  isActive?: boolean;

  @doc("Sort order for display")
  sortOrder?: int32;
}

@doc("Request body to cancel a subscription")
model PaCancelSubscriptionRequest {
  @doc("Reason for cancellation")
  @minLength(1)
  reason: string;
}

@doc("Request body to create a platform subscription for an organisation (UJ-M03). The org pays a flat band price for a tier that covers up to maxMembers members.")
model PaCreateSubscriptionRequest {
  @doc("Organisation the subscription is for")
  organizationId: UUID;

  @doc("Chosen pricing tier. When omitted, the cheapest active tier that covers the org's active member count is selected; if none fits, an explicit tierId is required.")
  tierId?: UUID;

  @doc("Billing cycle: monthly (default) or annual")
  billingCycle?: string;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

namespace PlatformAdminSupportModule {


  @doc("Support inbox, breach register, and platform billing endpoints for platform admins (FIX-011 / G7).")
  interface SupportBillingEndpoints {

    // ----- Support tickets (PA-8 / M3-R12) -----

    @doc("List support tickets sorted by priority then age. Platform admin only. Returns computed slaStatus per ticket.")
    @operationId("listTickets")
    @get
    @route("/admin/tickets")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    listTickets(
      @doc("Filter by ticket status")
      @query status?: string,
      @doc("Filter by priority")
      @query priority?: string,
      @doc("Filter by assignee user id")
      @query assignee?: string,
    ): ApiOkResponse<{ data: Record<unknown>[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a single support ticket with comments and SLA countdown. Platform admin only under the /admin gate.")
    @operationId("getTicket")
    @get
    @route("/admin/tickets/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    getTicket(
      @path id: string,
    ): ApiOkResponse<{ data: Record<unknown> }>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Transition a support ticket's status (support-or-super only; enforced in handler).")
    @operationId("updateTicketStatus")
    @put
    @route("/admin/tickets/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    updateTicketStatus(
      @path id: string,
      @body body: PaUpdateTicketStatusRequest,
    ): ApiOkResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Add a comment to a support ticket. A reporter reply to a resolved ticket re-opens it (FIX-012).")
    @operationId("addTicketComment")
    @post
    @route("/admin/tickets/{id}/comments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    addTicketComment(
      @path id: string,
      @body body: PaAddTicketCommentRequest,
    ): ApiCreatedResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    // ----- Breach register (DPA 2012 / M3-R11) -----

    @doc("Record a new personal-data breach incident (support-or-super only; enforced in handler).")
    @operationId("reportBreach")
    @post
    @route("/admin/breaches")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    reportBreach(
      @body body: PaReportBreachRequest,
    ): ApiCreatedResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List breach incidents with urgency colour and hours-remaining. Platform admin only.")
    @operationId("listBreaches")
    @get
    @route("/admin/breaches")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    listBreaches(): ApiOkResponse<{ data: Record<unknown>[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Transition a breach incident's status (support-or-super only; enforced in handler). Emits its own audit event inline.")
    @operationId("updateBreachStatus")
    @put
    @route("/admin/breaches/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    updateBreachStatus(
      @path id: string,
      @body body: PaUpdateBreachStatusRequest,
    ): ApiOkResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    // ----- Pricing tiers (UJ-M03) -----

    @doc("List pricing tiers with subscriber counts. Platform admin only.")
    @operationId("listPricingTiers")
    @get
    @route("/admin/pricing")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    listPricingTiers(): ApiOkResponse<{ data: Record<unknown>[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Create a pricing tier (super-only; enforced in handler).")
    @operationId("createPricingTier")
    @post
    @route("/admin/pricing")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    createPricingTier(
      @body body: PaPricingTierRequest,
    ): ApiCreatedResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a pricing tier (super-only; enforced in handler). Price changes affect new subscriptions only (M3-R8).")
    @operationId("updatePricingTier")
    @put
    @route("/admin/pricing/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    updatePricingTier(
      @path tierId: string,
      @body body: PaPricingTierRequest,
    ): ApiOkResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    // ----- Subscriptions (UJ-M03) -----

    @doc("List organisation subscriptions. Platform admin only.")
    @operationId("listSubscriptions")
    @get
    @route("/admin/subscriptions")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    listSubscriptions(): ApiOkResponse<{ data: Record<unknown>[] }>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Create a platform subscription for an organisation (super-only; enforced in handler). Validates the org's active member count against the tier's maxMembers band.")
    @operationId("createSubscription")
    @post
    @route("/admin/subscriptions")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    createSubscription(
      @body body: PaCreateSubscriptionRequest,
    ): ApiCreatedResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a single subscription by ID. Platform admin only.")
    @operationId("getSubscription")
    @get
    @route("/admin/subscriptions/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    getSubscription(
      @path id: string,
    ): ApiOkResponse<{ data: Record<unknown> }>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Cancel a subscription (super-only; enforced in handler).")
    @operationId("cancelSubscription")
    @put
    @route("/admin/subscriptions/{id}/cancel")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["platform_admin"])
    cancelSubscription(
      @path id: string,
      @body body: PaCancelSubscriptionRequest,
    ): ApiOkResponse<{ data: Record<unknown> }>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
