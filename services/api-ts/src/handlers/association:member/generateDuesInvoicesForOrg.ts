import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GenerateDuesInvoicesForOrgBody } from '@/generated/openapi/validators';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { eq, and } from 'drizzle-orm';
import { duesInvoices, duesConfigs } from './repos/dues.schema';
import { memberships } from './repos/membership.schema';
import { processDuesReminders } from '../dues/jobs/reminderProcessor';

/**
 * generateDuesInvoicesForOrg
 *
 * Path: POST /association/member/dues-invoices/generate
 * OperationId: generateDuesInvoicesForOrg
 *
 * Generates dues invoices for all active members of an organization
 * for the specified period, and triggers reminder processing.
 * Returns the list of generated invoices matching DuesInvoiceListResponseSchema.
 */
export async function generateDuesInvoicesForOrg(
  ctx: ValidatedContext<GenerateDuesInvoicesForOrgBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'dues-invoice',
    resourceId: body.organizationId,
    description: 'Bulk dues invoice generation triggered',
  });

  // 1. Get dues config for the organization
  const [config] = await db
    .select()
    .from(duesConfigs)
    .where(eq(duesConfigs.organizationId, body.organizationId))
    .limit(1);

  if (!config) {
    // No dues config — return empty result
    return ctx.json({
      data: [],
      pagination: {
        offset: 0,
        limit: 100,
        count: 0,
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }, 200);
  }

  // 2. Find active members who don't already have an invoice for this period
  const activeMembers = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, body.organizationId),
        eq(memberships.status, 'active'),
      ),
    );

  const generatedInvoices: any[] = [];
  let invoiceCounter = 0;

  for (const member of activeMembers) {
    // Check if invoice already exists for this member+period
    const [existing] = await db
      .select()
      .from(duesInvoices)
      .where(
        and(
          eq(duesInvoices.membershipId, member.id),
          eq(duesInvoices.periodStart, body.periodStart),
          eq(duesInvoices.periodEnd, body.periodEnd),
        ),
      )
      .limit(1);

    if (existing) {
      // Already generated — skip
      continue;
    }

    invoiceCounter++;
    const invoiceNumber = `INV-${body.organizationId.slice(0, 8)}-${Date.now()}-${invoiceCounter}`;

    // Generate the invoice
    const [invoice] = await db
      .insert(duesInvoices)
      .values({
        membershipId: member.id,
        personId: member.personId,
        organizationId: body.organizationId,
        invoiceNumber,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        totalAmount: config.annualAmount,
        fundAllocations: (config.fundAllocations || []).map((fa: any) => ({
          fundName: fa.fundName,
          amount: Math.round(config.annualAmount * (fa.percentage / 100)),
        })),
        status: 'generated',
      })
      .returning();

    generatedInvoices.push(invoice);
  }

  // 3. Trigger reminder processing for this org (fire-and-forget)
  processDuesReminders({ db, logger }).catch((err: any) => {
    logger?.error({ msg: 'Background reminder processing failed', err });
  });

  // 4. Return response matching DuesInvoiceListResponseSchema
  const count = generatedInvoices.length;
  return ctx.json({
    data: generatedInvoices.map((inv: any) => ({
      id: inv.id,
      membershipId: inv.membershipId,
      personId: inv.personId,
      organizationId: inv.organizationId,
      invoiceNumber: inv.invoiceNumber,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      totalAmount: inv.totalAmount,
      fundAllocations: inv.fundAllocations,
      status: inv.status,
      generatedAt: inv.generatedAt?.toISOString?.() ?? new Date().toISOString(),
      sentAt: inv.sentAt?.toISOString?.() ?? undefined,
      paidAt: inv.paidAt?.toISOString?.() ?? undefined,
      paymentId: inv.paymentId ?? undefined,
    })),
    pagination: {
      offset: 0,
      limit: 100,
      count,
      totalCount: count,
      totalPages: count > 0 ? 1 : 0,
      currentPage: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  }, 200);
}
