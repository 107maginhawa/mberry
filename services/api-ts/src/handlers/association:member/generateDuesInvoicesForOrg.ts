import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { GenerateDuesInvoicesForOrgBody } from '@/generated/openapi/validators';
import { domainEvents } from '@/core/domain-events';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { eq, and } from 'drizzle-orm';
import { duesInvoices, duesConfigs } from './repos/dues.schema';
import { memberships } from './repos/membership.schema';
import { processDuesReminders } from './jobs/reminderProcessor';

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
  const orgId = ctx.get('organizationId') as string;
  if (body.organizationId !== orgId) throw new ForbiddenError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  ctx.set('auditResourceId', orgId);
  ctx.set('auditDescription', 'Bulk dues invoice generation triggered');

  // 1. Get dues config for the organization
  const [config] = await db
    .select()
    .from(duesConfigs)
    .where(eq(duesConfigs.organizationId, orgId))
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
        eq(memberships.organizationId, orgId),
        eq(memberships.status, 'active'),
      ),
    );

  // [CR-03] Wrap the entire insert loop in a transaction so a mid-batch
  // server crash cannot leave a partially-committed invoice set.
  const generatedInvoices: any[] = await db.transaction(async (tx: DatabaseInstance) => {
    const invoices: any[] = [];
    let invoiceCounter = 0;

    for (const member of activeMembers) {
      // Check if invoice already exists for this member+period
      const [existing] = await tx
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
      const invoiceNumber = `INV-${orgId.slice(0, 8)}-${Date.now()}-${invoiceCounter}`;

      // Generate the invoice
      const [invoice] = await tx
        .insert(duesInvoices)
        .values({
          membershipId: member.id,
          personId: member.personId,
          organizationId: orgId,
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

      invoices.push(invoice);
    }

    return invoices;
  });

  // Emit one dues.invoice.generated per newly created invoice (fire-and-forget)
  for (const inv of generatedInvoices) {
    domainEvents.emit('dues.invoice.generated', {
      invoiceId: inv.id,
      organizationId: orgId,
      personId: inv.personId,
      amount: inv.totalAmount,
      dueDate: body.periodEnd,
    }).catch(() => {});
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
