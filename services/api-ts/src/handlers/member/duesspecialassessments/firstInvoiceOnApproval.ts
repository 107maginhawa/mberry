/**
 * [FIX-009 / Q-PD7] First dues invoice on membership approval.
 *
 * Approval (and invite-claim) leaves a new member `pendingPayment` with no
 * invoice. The batch generator (`generateDuesInvoicesForOrg`) only picks up
 * `status='active'` members, so without this a newly-approved member never gets
 * a payable invoice — the join→pay→active funnel dead-ends.
 *
 * This helper is invoked by the `membership.created` domain-event consumer
 * (decoupled from the approval handler, mirrors the Step-44 cascade pattern). It
 * mints exactly one open invoice from the org's active dues config, idempotent
 * per (membership, period), and strictly scoped to the membership's own org.
 *
 * It does NOT change the membership status transition: approval stays
 * `pendingPayment` until a payment settles (settle flips to `active`, per the
 * ratified Track B lifecycle). [CROSS-MODULE RISK] kept read-only on memberships.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { duesConfigs, duesInvoices } from '@/handlers/association:member/repos/dues.schema';
import type { FundAllocation } from '@/handlers/dues/repos/dues.schema';

export interface FirstInvoicePayload {
  membershipId: string;
  personId: string;
  organizationId: string;
}

export interface FirstInvoiceResult {
  created: boolean;
  invoiceId?: string;
  amount?: number;
  periodStart?: string;
  periodEnd?: string;
  reason?: 'no-membership' | 'org-mismatch' | 'no-config' | 'already-invoiced';
}

/**
 * Derive the active annual dues period `[periodStart, periodEnd]` (inclusive last
 * day) from a config's `cycleStartMonth` and the current date. If today precedes
 * this calendar year's cycle start, the active cycle began the previous year.
 */
export function computeDuesPeriod(
  cycleStartMonth: number,
  now: Date,
): { periodStart: string; periodEnd: string } {
  const month = Math.min(Math.max(Math.trunc(cycleStartMonth) || 1, 1), 12);
  const year = now.getUTCFullYear();
  const cycleStartThisYear = Date.UTC(year, month - 1, 1);
  const startYear = now.getTime() < cycleStartThisYear ? year - 1 : year;

  const start = new Date(Date.UTC(startYear, month - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, month - 1, 1));
  end.setUTCDate(end.getUTCDate() - 1); // inclusive last day of the cycle

  return {
    periodStart: start.toISOString().split('T')[0]!,
    periodEnd: end.toISOString().split('T')[0]!,
  };
}

export async function mintFirstDuesInvoice(
  db: DatabaseInstance,
  payload: FirstInvoicePayload,
  logger?: Logger,
  now: Date = new Date(),
): Promise<FirstInvoiceResult> {
  // 1. Load the membership (need its tier + a defensive org guard).
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.id, payload.membershipId))
    .limit(1);

  if (!membership) return { created: false, reason: 'no-membership' };

  // Cross-org guard: never mint an invoice in a different org than the membership
  // actually belongs to (an org-A approval can never mint an org-B invoice).
  if (membership.organizationId !== payload.organizationId) {
    return { created: false, reason: 'org-mismatch' };
  }

  // 2. Resolve the org's active dues config, preferring the member's tier.
  const configs = await db
    .select()
    .from(duesConfigs)
    .where(
      and(
        eq(duesConfigs.organizationId, payload.organizationId),
        eq(duesConfigs.status, 'active'),
      ),
    );

  const config =
    configs.find((c: any) => c.tierId === membership.tierId) ?? configs[0];
  if (!config) return { created: false, reason: 'no-config' };

  const { periodStart, periodEnd } = computeDuesPeriod(config.cycleStartMonth, now);

  // 3. Idempotency: skip if an invoice already exists for this membership+period
  //    (mirrors the batch generator's per-period guard, so a re-fired event or a
  //    later batch run never double-issues).
  const [existing] = await db
    .select()
    .from(duesInvoices)
    .where(
      and(
        eq(duesInvoices.membershipId, membership.id),
        eq(duesInvoices.periodStart, periodStart),
        eq(duesInvoices.periodEnd, periodEnd),
      ),
    )
    .limit(1);

  if (existing) {
    return { created: false, reason: 'already-invoiced', periodStart, periodEnd };
  }

  // 4. Mint the invoice (mirror generateDuesInvoicesForOrg fund-split math).
  const invoiceNumber = `INV-${payload.organizationId.slice(0, 8)}-${now.getTime()}`;
  const fundAllocations = ((config.fundAllocations as FundAllocation[]) || []).map((fa) => ({
    fundName: fa.fundName,
    amount: Math.round(config.annualAmount * (fa.percentage / 100)),
  }));

  const [invoice] = await db
    .insert(duesInvoices)
    .values({
      membershipId: membership.id,
      personId: membership.personId,
      organizationId: payload.organizationId,
      invoiceNumber,
      periodStart,
      periodEnd,
      totalAmount: config.annualAmount,
      fundAllocations,
      status: 'generated',
    })
    .returning();

  logger?.info?.(
    { invoiceId: invoice?.id, membershipId: membership.id, organizationId: payload.organizationId },
    'First dues invoice minted on membership.created',
  );

  return {
    created: true,
    invoiceId: invoice?.id,
    amount: config.annualAmount,
    periodStart,
    periodEnd,
  };
}
