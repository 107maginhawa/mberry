import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "./primitives.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Domain 8 — Fee Schedules & Pricing
 *
 * Defines the catalogues of fees charged by the association, pricing tiers
 * that grant member-category discounts, and promotional codes that can be
 * redeemed against eligible fee items.
 */
namespace Association.Core.FeeSchedule;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a fee schedule.")
enum FeeScheduleStatus {
  @doc("Under construction, not yet publicly visible.")
  draft: "draft",

  @doc("Currently in effect and used for new invoices.")
  active: "active",

  @doc("Superseded by a newer schedule; read-only historical reference.")
  retired: "retired",
}

@doc("Mechanism used for a promotional discount.")
enum DiscountType {
  @doc("Reduce the price by a fixed percentage of the original amount.")
  percentage: "percentage",

  @doc("Reduce the price by a fixed monetary amount.")
  fixedAmount: "fixedAmount",
}

@doc("Operational status of a promotional code.")
enum PromoStatus {
  @doc("Code can be redeemed by eligible payers.")
  active: "active",

  @doc("Code's validity window has passed.")
  expired: "expired",

  @doc("Code has reached its maximum redemption count.")
  depleted: "depleted",

  @doc("Code was manually revoked by an administrator.")
  revoked: "revoked",
}

// ---------------------------------------------------------------------------
// Core models
// ---------------------------------------------------------------------------

@doc("A versioned catalogue of fees effective for a specified date range.")
model FeeSchedule extends AssociationBaseEntity {
  @doc("Human-readable name (e.g. 'FY 2025 Standard Dues Schedule').")
  name: string;

  @doc("Organisation this schedule applies to; omit for association-wide schedules.")
  organizationId?: string;

  @doc("Date from which this schedule is used for new billing.")
  effectiveDate: plainDate;

  @doc("Date after which this schedule is superseded. Omit for open-ended schedules.")
  expiryDate?: plainDate;

  @doc("Lifecycle status.")
  status: FeeScheduleStatus;
}

@doc("An individual fee line item within a fee schedule.")
model FeeItem extends AssociationBaseEntity {
  @doc("Parent fee schedule.")
  feeScheduleId: string;

  @doc("Unique billing code for the fee (e.g. 'DUES-FULL', 'EVENT-CONF-2025').")
  code: string;

  @doc("Display name shown on invoices.")
  name: string;

  @doc("Optional longer description for the member portal.")
  description?: string;

  @doc("Base price before any tier discounts.")
  amount: float64;

  @doc("ISO 4217 currency code.")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Whether this fee item is subject to applicable taxes.")
  taxable: boolean;

  @doc("Optional grouping category (e.g. 'membership', 'event', 'publication').")
  category?: string;
}

@doc("A pricing tier that qualifies a subset of members for a discounted price on a fee item.")
model PricingTier extends AssociationBaseEntity {
  @doc("Fee item this tier modifies.")
  feeItemId: string;

  @doc("Descriptive tier name (e.g. 'Student Rate', 'Early-Bird', 'Senior').")
  tierName: string;

  @doc("Human-readable description of the qualification criteria for this tier.")
  qualificationCriteria: string;

  @doc("Percentage discount applied to the base price (0–100). Mutually exclusive with discountAmount.")
  @minValue(0)
  @maxValue(100)
  discountPercent?: float64;

  @doc("Fixed monetary discount applied to the base price. Mutually exclusive with discountPercent.")
  @minValue(0)
  discountAmount?: float64;

  @doc("Evaluation order when multiple tiers could apply (lower value = higher priority).")
  @minValue(1)
  priority: int32;
}

@doc("A promotional code that can be redeemed at checkout for a discount.")
model PromotionalCode extends AssociationBaseEntity {
  @doc("Case-insensitive redemption code entered by the payer.")
  code: string;

  @doc("Optional description shown to the payer during redemption.")
  description?: string;

  @doc("How the discount value is interpreted.")
  discountType: DiscountType;

  @doc("Magnitude of the discount (percentage points or fixed amount depending on discountType).")
  @minValue(0)
  discountValue: float64;

  @doc("First date the code can be redeemed.")
  validFrom: plainDate;

  @doc("Last date the code can be redeemed.")
  validTo: plainDate;

  @doc("Maximum number of times the code can be redeemed across all payers. Omit for unlimited.")
  @minValue(1)
  maxUses?: int32;

  @doc("Number of times the code has been successfully redeemed to date.")
  @minValue(0)
  currentUses: int32;

  @doc("Current status of the code.")
  status: PromoStatus;

  @doc("List of fee item IDs this code applies to. Omit to allow redemption against any item.")
  applicableFeeItems?: string[];
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a fee schedule.")
model FeeScheduleCreateRequest {
  @doc("Display name.")
  name: string;

  @doc("Scoped organisation ID (optional).")
  organizationId?: string;

  @doc("Effective date.")
  effectiveDate: plainDate;

  @doc("Expiry date (optional).")
  expiryDate?: plainDate;
}

@doc("Partial update for a fee schedule.")
model FeeScheduleUpdateRequest {
  @doc("Display name.")
  name?: string;

  @doc("Effective date.")
  effectiveDate?: plainDate;

  @doc("Expiry date — pass null to clear.")
  expiryDate?: plainDate | null;

  @doc("Status.")
  status?: FeeScheduleStatus;
}

@doc("Request body to create a fee item.")
model FeeItemCreateRequest {
  @doc("Parent fee schedule ID.")
  feeScheduleId: string;

  @doc("Billing code.")
  code: string;

  @doc("Display name.")
  name: string;

  @doc("Description (optional).")
  description?: string;

  @doc("Base price.")
  amount: float64;

  @doc("ISO 4217 currency code.")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Taxable flag.")
  taxable: boolean;

  @doc("Category (optional).")
  category?: string;
}

@doc("Partial update for a fee item.")
model FeeItemUpdateRequest {
  @doc("Display name.")
  name?: string;

  @doc("Description — pass null to clear.")
  description?: string | null;

  @doc("Base price.")
  amount?: float64;

  @doc("Taxable flag.")
  taxable?: boolean;

  @doc("Category — pass null to clear.")
  category?: string | null;
}

@doc("Request body to create a pricing tier.")
model PricingTierCreateRequest {
  @doc("Parent fee item ID.")
  feeItemId: string;

  @doc("Tier name.")
  tierName: string;

  @doc("Qualification criteria description.")
  qualificationCriteria: string;

  @doc("Percentage discount (0–100).")
  @minValue(0)
  @maxValue(100)
  discountPercent?: float64;

  @doc("Fixed monetary discount.")
  @minValue(0)
  discountAmount?: float64;

  @doc("Priority.")
  @minValue(1)
  priority: int32;
}

@doc("Request body to create a promotional code.")
model PromotionalCodeCreateRequest {
  @doc("Redemption code.")
  code: string;

  @doc("Description (optional).")
  description?: string;

  @doc("Discount type.")
  discountType: DiscountType;

  @doc("Discount value.")
  @minValue(0)
  discountValue: float64;

  @doc("Valid from date.")
  validFrom: plainDate;

  @doc("Valid to date.")
  validTo: plainDate;

  @doc("Maximum uses (optional).")
  @minValue(1)
  maxUses?: int32;

  @doc("Applicable fee item IDs (optional; omit for all items).")
  applicableFeeItems?: string[];
}

@doc("Query parameters for searching fee schedules.")
model FeeScheduleSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by organisation ID.")
  @query
  organizationId?: string;

  @doc("Filter by status.")
  @query
  status?: FeeScheduleStatus;

  @doc("Schedules effective on or after this date.")
  @query
  effectiveFrom?: plainDate;
}

@doc("Query parameters for searching fee items.")
model FeeItemSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by fee schedule ID.")
  @query
  feeScheduleId?: string;

  @doc("Filter by category.")
  @query
  category?: string;

  @doc("Only return taxable items.")
  @query
  taxable?: boolean;
}

@doc("Query parameters for searching promotional codes.")
model PromotionalCodeSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by status.")
  @query
  status?: PromoStatus;

  @doc("Codes valid on this date.")
  @query
  validOn?: plainDate;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/fee-schedules")
@tag("FeeSchedule")
namespace FeeScheduleManagement {
  interface FeeScheduleManagement {
    @doc("Create a fee schedule.")
    @operationId("createFeeSchedule")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createFeeSchedule(
      @body body: FeeScheduleCreateRequest
    ): ApiCreatedResponse<FeeSchedule>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a fee schedule by ID.")
    @operationId("getFeeSchedule")
    @get
    @route("/{feeScheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "coordinator", "member"])
    getFeeSchedule(
      @path feeScheduleId: string
    ): ApiOkResponse<FeeSchedule>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a fee schedule.")
    @operationId("updateFeeSchedule")
    @patch(#{implicitOptionality: true})
    @route("/{feeScheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updateFeeSchedule(
      @path feeScheduleId: string,
      @body updates: FeeScheduleUpdateRequest
    ): ApiOkResponse<FeeSchedule>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a fee schedule.")
    @operationId("deleteFeeSchedule")
    @delete
    @route("/{feeScheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteFeeSchedule(
      @path feeScheduleId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list fee schedules.")
    @operationId("searchFeeSchedules")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "coordinator"])
    searchFeeSchedules(
      ...FeeScheduleSearchParams
    ): ApiOkResponse<PaginatedResponse<FeeSchedule>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/fee-items")
@tag("FeeSchedule")
namespace FeeItemManagement {
  interface FeeItemManagement {
    @doc("Create a fee item.")
    @operationId("createFeeItem")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createFeeItem(
      @body body: FeeItemCreateRequest
    ): ApiCreatedResponse<FeeItem>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a fee item by ID.")
    @operationId("getFeeItem")
    @get
    @route("/{feeItemId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "coordinator", "member"])
    getFeeItem(
      @path feeItemId: string
    ): ApiOkResponse<FeeItem>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a fee item.")
    @operationId("updateFeeItem")
    @patch(#{implicitOptionality: true})
    @route("/{feeItemId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updateFeeItem(
      @path feeItemId: string,
      @body updates: FeeItemUpdateRequest
    ): ApiOkResponse<FeeItem>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a fee item.")
    @operationId("deleteFeeItem")
    @delete
    @route("/{feeItemId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteFeeItem(
      @path feeItemId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list fee items.")
    @operationId("searchFeeItems")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "coordinator"])
    searchFeeItems(
      ...FeeItemSearchParams
    ): ApiOkResponse<PaginatedResponse<FeeItem>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/pricing-tiers")
@tag("FeeSchedule")
namespace PricingTierManagement {
  interface PricingTierManagement {
    @doc("Create a pricing tier.")
    @operationId("createPricingTier")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createPricingTier(
      @body body: PricingTierCreateRequest
    ): ApiCreatedResponse<PricingTier>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a pricing tier by ID.")
    @operationId("getPricingTier")
    @get
    @route("/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "coordinator"])
    getPricingTier(
      @path tierId: string
    ): ApiOkResponse<PricingTier>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a pricing tier.")
    @operationId("updatePricingTier")
    @patch(#{implicitOptionality: true})
    @route("/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updatePricingTier(
      @path tierId: string,
      @body updates: PricingTierCreateRequest
    ): ApiOkResponse<PricingTier>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a pricing tier.")
    @operationId("deletePricingTier")
    @delete
    @route("/{tierId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deletePricingTier(
      @path tierId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list pricing tiers.")
    @operationId("searchPricingTiers")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    searchPricingTiers(
      ...OffsetPaginationParams,
      @query feeItemId?: string
    ): ApiOkResponse<PaginatedResponse<PricingTier>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/promotional-codes")
@tag("FeeSchedule")
namespace PromotionalCodeManagement {
  interface PromotionalCodeManagement {
    @doc("Create a promotional code.")
    @operationId("createPromotionalCode")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createPromotionalCode(
      @body body: PromotionalCodeCreateRequest
    ): ApiCreatedResponse<PromotionalCode>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a promotional code by ID.")
    @operationId("getPromotionalCode")
    @get
    @route("/{codeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    getPromotionalCode(
      @path codeId: string
    ): ApiOkResponse<PromotionalCode>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a promotional code.")
    @operationId("updatePromotionalCode")
    @patch(#{implicitOptionality: true})
    @route("/{codeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updatePromotionalCode(
      @path codeId: string,
      @body updates: PromotionalCodeCreateRequest
    ): ApiOkResponse<PromotionalCode>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a promotional code.")
    @operationId("deletePromotionalCode")
    @delete
    @route("/{codeId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deletePromotionalCode(
      @path codeId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list promotional codes.")
    @operationId("searchPromotionalCodes")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    searchPromotionalCodes(
      ...PromotionalCodeSearchParams
    ): ApiOkResponse<PaginatedResponse<PromotionalCode>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
