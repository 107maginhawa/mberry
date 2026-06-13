/**
 * List Invoices Handler
 *
 * Lists invoices with filtering and pagination.
 * Follows TypeSpec billing.tsp definition with current schema adaptation.
 */

import type { ValidatedContext } from '@/types/app';
import type { ListInvoicesQuery } from '@/generated/openapi/validators';
import { ForbiddenError } from '@/core/errors';
import type { Session } from '@/types/auth';
import { InvoiceRepository, type InvoiceFilters } from './repos/billing.repo';
import { parsePagination, buildPaginationMeta } from '@/utils/query';

/**
 * listInvoices
 *
 * Path: GET /invoices
 * OperationId: listInvoices
 *
 * List invoices with filtering and pagination
 */
export async function listInvoices(
  ctx: ValidatedContext<never, ListInvoicesQuery, never>
): Promise<Response> {
  const database = ctx.get('database');
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'billing' }) ?? baseLogger;

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract and parse query parameters
  const query = ctx.req.valid('query');

  logger.debug({ action: 'listInvoices.1',
    userId: user.id,
    filters: {
      customer: query.customer,
      merchant: query.merchant,
      status: query.status,
      context: query.context
    }
  }, 'Listing invoices');

  // Parse pagination with defaults
  const { limit, offset } = parsePagination(query, { limit: 25, maxLimit: 100 });

  // Multi-tenant scoping (P0-7)
  const organizationId = ctx.get('organizationId') as string;

  // Build filters - map TypeSpec fields to current schema
  const filters: InvoiceFilters = {
    organizationId
  };

  if (query.customer) {
    filters.customer = query.customer;
  }

  if (query.merchant) {
    filters.merchant = query.merchant;
  }

  if (query.status) {
    filters.status = query.status;
  }

  if (query.context) {
    filters.context = query.context;
  }

  // Access control: non-admin users can only see their own invoices
  const userRoles = user.role ? user.role.split(',').map((r: string) => r.trim()) : [];
  const isAdmin = userRoles.includes('admin');

  if (!isAdmin) {
    // Non-admin: scope to invoices where user is customer or merchant.
    // A customer/merchant filter that isn't the user is denied unless the
    // *other* party filter pins the result to the user (e.g. merchant=self +
    // customer=X, or customer=self + merchant=Y). The merchant-side check
    // (FIX-003) closes the leak where ?merchant=<foreign> with no ?customer=
    // was left unscoped — letting any member enumerate another merchant's
    // invoices (amounts + customer person IDs) across orgs.
    if (filters.customer && filters.customer !== user.id && filters.merchant !== user.id) {
      throw new ForbiddenError('You can only view your own invoices');
    }
    if (filters.merchant && filters.merchant !== user.id && filters.customer !== user.id) {
      throw new ForbiddenError('You can only view your own invoices');
    }
    if (!filters.customer && !filters.merchant) {
      // Default scope: show invoices where user is either customer or merchant
      // Use customer filter as primary, repo will handle OR logic via customerOrMerchant
      filters.customerOrMerchant = user.id;
    }
  }

  // Create repository instance
  const invoiceRepo = new InvoiceRepository(database, logger);

  // Get invoices (expand handled automatically by middleware)
  const result = await invoiceRepo.findManyWithPagination(filters, { pagination: { limit, offset } });

  const invoices = result.data;
  const totalCount = result.totalCount;

  // Build pagination metadata
  const paginationMeta = buildPaginationMeta(invoices, totalCount, limit, offset);

  // Batch-fetch line items for all invoices in one query
  const invoiceIds = invoices.map((inv: any) => inv.id);
  const lineItemsMap = await invoiceRepo.findLineItemsByInvoiceIds(invoiceIds);

  // Format response to match TypeSpec Invoice model
  const formattedInvoices = invoices.map((invoice: any) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customer: invoice.customer,
    merchant: invoice.merchant,
    context: invoice.context || null,
    status: invoice.status,
    subtotal: invoice.subtotal,
    tax: invoice.tax || null,
    total: invoice.total,
    currency: invoice.currency,
    paymentCaptureMethod: invoice.paymentCaptureMethod,
    paymentDueAt: invoice.paymentDueAt?.toISOString() || null,
    lineItems: (lineItemsMap.get(invoice.id) || []).map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata || null
    })),
    paymentStatus: invoice.paymentStatus || null,
    paidAt: invoice.paidAt?.toISOString() || null,
    paidBy: invoice.paidBy || null,
    voidedAt: invoice.voidedAt?.toISOString() || null,
    voidedBy: invoice.voidedBy || null,
    voidThresholdMinutes: invoice.voidThresholdMinutes || null,
    authorizedAt: invoice.authorizedAt?.toISOString() || null,
    authorizedBy: invoice.authorizedBy || null,
    metadata: invoice.metadata || null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString()
  }));

  logger.info({ action: 'listInvoices.2',
    userId: user.id,
    filters,
    pagination: { limit, offset },
    resultCount: invoices.length,
    totalCount
  }, 'Invoices listed successfully');

  // Return standardized paginated response
  return ctx.json({
    data: formattedInvoices,
    pagination: paginationMeta
  }, 200);
}
