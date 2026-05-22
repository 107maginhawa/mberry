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
 * Domain 9 — Billing & Financial
 *
 * Covers the full billing lifecycle: draft invoices, payment recording,
 * refund processing, and revenue recognition scheduling for deferred-
 * income accounting.
 */
namespace Association.Core.Billing;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of an invoice.")
enum InvoiceStatus {
  @doc("Under construction; not yet delivered to the payer.")
  draft: "draft",

  @doc("Delivered to the payer; awaiting payment.")
  sent: "sent",

  @doc("Fully paid.")
  paid: "paid",

  @doc("Partially paid; balance remains outstanding.")
  partiallyPaid: "partiallyPaid",

  @doc("Past due date with an outstanding balance.")
  overdue: "overdue",

  @doc("Voided; cannot be paid.")
  voided: "void",

  @doc("Cancelled before delivery.")
  cancelled: "cancelled",
}

@doc("Payment method used to settle an invoice.")
enum PaymentMethod {
  @doc("Credit or debit card.")
  creditCard: "creditCard",

  @doc("Bank wire or ACH transfer.")
  bankTransfer: "bankTransfer",

  @doc("Physical cheque.")
  check: "check",

  @doc("Physical cash.")
  cash: "cash",

  @doc("PayPal.")
  paypal: "paypal",

  @doc("GCash (Philippines).")
  gcash: "gcash",

  @doc("Maya / PayMaya (Philippines).")
  maya: "maya",

  @doc("Any other payment method.")
  other: "other",
}

@doc("Processing status of a payment.")
enum PaymentStatus {
  @doc("Submitted but not yet confirmed by the payment processor.")
  pending: "pending",

  @doc("Successfully processed and funds received.")
  completed: "completed",

  @doc("Processing failed; funds not received.")
  failed: "failed",

  @doc("Previously completed payment that has been fully refunded.")
  refunded: "refunded",

  @doc("Cancelled before processing was attempted.")
  cancelled: "cancelled",
}

@doc("Processing status of a refund.")
enum RefundStatus {
  @doc("Refund requested and queued.")
  pending: "pending",

  @doc("Refund successfully sent to the original payment method.")
  processed: "processed",

  @doc("Refund attempt failed.")
  failed: "failed",
}

@doc("How revenue recognised for an invoice is spread across periods.")
enum RecognitionMethod {
  @doc("All revenue recognised at the time of payment.")
  immediate: "immediate",

  @doc("Revenue spread evenly across the service period.")
  straightLine: "straightLine",

  @doc("Revenue recognised as defined milestones are achieved.")
  milestone: "milestone",
}

// ---------------------------------------------------------------------------
// Supporting value-object models
// ---------------------------------------------------------------------------

@doc("A single line item on an invoice.")
model InvoiceLineItem {
  @doc("Human-readable description for this line.")
  description: string;

  @doc("Fee item this line was generated from (optional).")
  feeItemId?: string;

  @doc("Number of units.")
  @minValue(1)
  quantity: int32;

  @doc("Price per unit.")
  @minValue(0)
  unitPrice: int64;

  @doc("Line total (quantity × unitPrice before tax).")
  @minValue(0)
  amount: int64;

  @doc("Tax rate applied to this line (decimal fraction, e.g. 0.12 for 12%). Omit if non-taxable.")
  @minValue(0)
  @maxValue(1)
  taxRate?: float64;
}

@doc("A single period entry in a revenue recognition schedule.")
model RecognitionEntry {
  @doc("Accounting period label (e.g. '2025-01', '2025-Q1').")
  period: string;

  @doc("Amount to be recognised in this period.")
  @minValue(0)
  amount: int64;

  @doc("Whether the recognition journal entry for this period has been posted.")
  recognized: boolean;

  @doc("Timestamp at which the recognition was posted.")
  recognizedAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Core entity models
// ---------------------------------------------------------------------------

@doc("An invoice issued to a person or organisation for amounts owed.")
model Invoice extends AssociationBaseEntity {
  @doc("Human-readable, auto-generated invoice number (e.g. 'INV-2025-00042').")
  number: string;

  @doc("Person this invoice was issued to (optional; use organizationId for org billing).")
  personId?: string;

  @doc("Current lifecycle status.")
  status: InvoiceStatus;

  @doc("Date the invoice was issued.")
  issueDate: plainDate;

  @doc("Date by which full payment is due.")
  dueDate: plainDate;

  @doc("Ordered list of line items.")
  lineItems: InvoiceLineItem[];

  @doc("Sum of all line-item amounts before tax.")
  @minValue(0)
  subtotal: int64;

  @doc("Total tax amount across all taxable lines.")
  @minValue(0)
  taxAmount: int64;

  @doc("Total amount due (subtotal + taxAmount).")
  @minValue(0)
  totalAmount: int64;

  @doc("Amount paid to date.")
  @minValue(0)
  paidAmount: int64;

  @doc("Remaining balance (totalAmount – paidAmount).")
  @minValue(0)
  balanceDue: int64;

  @doc("ISO 4217 currency code.")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Internal or customer-facing notes.")
  notes?: string;
}

@doc("A payment applied against an invoice or made ad-hoc.")
model Payment extends AssociationBaseEntity {
  @doc("Invoice this payment is applied to (optional for unallocated payments).")
  invoiceId?: string;

  @doc("Person who made the payment.")
  personId?: string;

  @doc("Amount paid.")
  @minValue(0)
  amount: int64;

  @doc("ISO 4217 currency code.")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Payment method used.")
  method: PaymentMethod;

  @doc("External reference or transaction number from the payment processor.")
  referenceNumber?: string;

  @doc("Timestamp at which the payment was made.")
  paidAt: utcDateTime;

  @doc("Processing status.")
  status: PaymentStatus;
}

@doc("A refund issued against a completed payment.")
model Refund extends AssociationBaseEntity {
  @doc("Original payment being refunded.")
  paymentId: string;

  @doc("Amount to refund (must not exceed original payment amount).")
  @minValue(0)
  amount: int64;

  @doc("Business reason for the refund.")
  reason: string;

  @doc("Timestamp at which the refund was processed.")
  processedAt?: utcDateTime;

  @doc("Current status.")
  status: RefundStatus;
}

@doc("A revenue recognition schedule attached to an invoice.")
model RevenueSchedule extends AssociationBaseEntity {
  @doc("Invoice whose revenue is being recognised.")
  invoiceId: string;

  @doc("Method used to allocate revenue across periods.")
  recognitionMethod: RecognitionMethod;

  @doc("Ordered list of period entries.")
  entries: RecognitionEntry[];
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create an invoice.")
model InvoiceCreateRequest {
  @doc("Person to invoice (optional).")
  personId?: string;

  @doc("Organisation to invoice (optional).")
  organizationId?: string;

  @doc("Issue date (defaults to today if omitted).")
  issueDate?: plainDate;

  @doc("Payment due date.")
  dueDate: plainDate;

  @doc("Line items.")
  lineItems: InvoiceLineItem[];

  @doc("ISO 4217 currency code.")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Optional notes.")
  notes?: string;
}

@doc("Partial update payload for an invoice.")
model InvoiceUpdateRequest {
  @doc("Due date.")
  dueDate?: plainDate;

  @doc("Line items — replaces the entire list.")
  lineItems?: InvoiceLineItem[];

  @doc("Notes — pass null to clear.")
  notes?: string | null;
}

@doc("Request body to record a payment.")
model PaymentCreateRequest {
  @doc("Invoice being paid (optional).")
  invoiceId?: string;

  @doc("Person making the payment (optional).")
  personId?: string;

  @doc("Amount paid.")
  @minValue(0)
  amount: int64;

  @doc("ISO 4217 currency code.")
  @minLength(3)
  @maxLength(3)
  currency: string;

  @doc("Payment method.")
  method: PaymentMethod;

  @doc("External reference number (optional).")
  referenceNumber?: string;

  @doc("Payment timestamp (defaults to now if omitted).")
  paidAt?: utcDateTime;
}

@doc("Request body to create a refund.")
model RefundCreateRequest {
  @doc("Payment to refund.")
  paymentId: string;

  @doc("Amount to refund.")
  @minValue(0)
  amount: int64;

  @doc("Reason for the refund.")
  reason?: string;
}

@doc("Request body to create a revenue recognition schedule.")
model RevenueScheduleCreateRequest {
  @doc("Invoice ID.")
  invoiceId: string;

  @doc("Recognition method.")
  recognitionMethod: RecognitionMethod;

  @doc("Period entries.")
  entries: RecognitionEntry[];
}

@doc("Query parameters for searching invoices.")
model InvoiceSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by person ID.")
  @query
  personId?: string;

  @doc("Filter by organisation ID.")
  @query
  organizationId?: string;

  @doc("Filter by status.")
  @query
  status?: InvoiceStatus;

  @doc("Invoices due on or after this date.")
  @query
  dueFrom?: plainDate;

  @doc("Invoices due on or before this date.")
  @query
  dueTo?: plainDate;
}

@doc("Query parameters for searching payments.")
model PaymentSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by invoice ID.")
  @query
  invoiceId?: string;

  @doc("Filter by person ID.")
  @query
  personId?: string;

  @doc("Filter by status.")
  @query
  status?: PaymentStatus;

  @doc("Filter by payment method.")
  @query
  method?: PaymentMethod;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/invoices")
@tag("Billing")
namespace InvoiceManagement {
  interface InvoiceManagement {
    @doc("Create a draft invoice.")
    @operationId("createInvoice")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createInvoice(
      @body body: InvoiceCreateRequest
    ): ApiCreatedResponse<Invoice>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an invoice by ID.")
    @operationId("getInvoice")
    @get
    @route("/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "member:owner"])
    getInvoice(
      @path invoiceId: string
    ): ApiOkResponse<Invoice>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an invoice (draft or sent only).")
    @operationId("updateInvoice")
    @patch(#{implicitOptionality: true})
    @route("/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updateInvoice(
      @path invoiceId: string,
      @body updates: InvoiceUpdateRequest
    ): ApiOkResponse<Invoice>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a draft invoice.")
    @operationId("deleteInvoice")
    @delete
    @route("/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteInvoice(
      @path invoiceId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list invoices.")
    @operationId("searchInvoices")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    searchInvoices(
      ...InvoiceSearchParams
    ): ApiOkResponse<PaginatedResponse<Invoice>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Send an invoice to the payer.")
    @operationId("sendInvoice")
    @post
    @route("/{invoiceId}/send")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    sendInvoice(
      @path invoiceId: string
    ): ApiOkResponse<Invoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Void an invoice, preventing further payment.")
    @operationId("voidInvoice")
    @post
    @route("/{invoiceId}/void")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    voidInvoice(
      @path invoiceId: string
    ): ApiOkResponse<Invoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/payments")
@tag("Billing")
namespace PaymentManagement {
  interface PaymentManagement {
    @doc("Record a payment.")
    @operationId("createPayment")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createPayment(
      @body body: PaymentCreateRequest
    ): ApiCreatedResponse<Payment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a payment by ID.")
    @operationId("getPayment")
    @get
    @route("/{paymentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant", "member:owner"])
    getPayment(
      @path paymentId: string
    ): ApiOkResponse<Payment>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a payment record.")
    @operationId("updatePayment")
    @patch(#{implicitOptionality: true})
    @route("/{paymentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updatePayment(
      @path paymentId: string,
      @body updates: PaymentCreateRequest
    ): ApiOkResponse<Payment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a payment record (pending payments only).")
    @operationId("deletePayment")
    @delete
    @route("/{paymentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deletePayment(
      @path paymentId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list payments.")
    @operationId("searchPayments")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    searchPayments(
      ...PaymentSearchParams
    ): ApiOkResponse<PaginatedResponse<Payment>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/refunds")
@tag("Billing")
namespace RefundManagement {
  interface RefundManagement {
    @doc("Initiate a refund against a completed payment.")
    @operationId("createRefund")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createRefund(
      @body body: RefundCreateRequest
    ): ApiCreatedResponse<Refund>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list refunds.")
    @operationId("searchRefunds")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    searchRefunds(
      ...OffsetPaginationParams,
      @query paymentId?: string,
      @query status?: RefundStatus
    ): ApiOkResponse<PaginatedResponse<Refund>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/revenue-schedules")
@tag("Billing")
namespace RevenueScheduleManagement {
  interface RevenueScheduleManagement {
    @doc("Create a revenue recognition schedule for an invoice.")
    @operationId("createRevenueSchedule")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    createRevenueSchedule(
      @body body: RevenueScheduleCreateRequest
    ): ApiCreatedResponse<RevenueSchedule>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a revenue schedule by ID.")
    @operationId("getRevenueSchedule")
    @get
    @route("/{scheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    getRevenueSchedule(
      @path scheduleId: string
    ): ApiOkResponse<RevenueSchedule>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a revenue schedule.")
    @operationId("updateRevenueSchedule")
    @patch(#{implicitOptionality: true})
    @route("/{scheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "accountant"])
    updateRevenueSchedule(
      @path scheduleId: string,
      @body updates: RevenueScheduleCreateRequest
    ): ApiOkResponse<RevenueSchedule>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a revenue schedule.")
    @operationId("deleteRevenueSchedule")
    @delete
    @route("/{scheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteRevenueSchedule(
      @path scheduleId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
