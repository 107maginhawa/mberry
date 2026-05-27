/**
 * Auto-Invoice Generator
 *
 * Runs daily at 1 AM UTC. For each org with active dues config:
 *   1. Check if today is a billing cycle start date based on billingFrequency + dueDateMonth/dueDateDay
 *   2. If yes, generate invoices for all eligible members
 *   3. Skip: deceased, resigned, expelled, removed, suspended, lapsed members
 *   4. Skip: members who already have an invoice for this billing period
 *   5. Use category override amount when available
 *   6. Log: generated count, skipped count, errors
 *
 * Idempotent — checks existing invoices by periodStart to avoid duplicates.
 */

import type { DatabaseInstance } from '@/core/database';
import { eq, and, sql, notInArray } from 'drizzle-orm';
import { duesOrgConfigs, duesCategoryOverrides } from '../../association:member/repos/dues-payments.schema';
import { duesInvoices } from '../../association:member/repos/dues.schema';
import { memberships } from '../../association:member/repos/membership.schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoInvoiceContext {
  db: DatabaseInstance;
  logger: any;
  /** Override "today" for testing */
  now?: Date;
}

export interface AutoInvoiceResult {
  generated: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Statuses to exclude from invoice generation
// ---------------------------------------------------------------------------

const EXCLUDED_STATUSES = [
  'deceased',
  'resigned',
  'expelled',
  'removed',
  'suspended',
  'lapsed',
  'pendingPayment',
  'expired',
] as const;

// ---------------------------------------------------------------------------
// Billing cycle logic
// ---------------------------------------------------------------------------

/**
 * Determine the billing cycle months for a given frequency and start month.
 *
 * - annual: [cycleStartMonth]
 * - semi-annual: [cycleStartMonth, cycleStartMonth+6]
 * - quarterly: [cycleStartMonth, +3, +6, +9]
 *
 * dueDateMonth from duesOrgConfigs is used as cycleStartMonth when present,
 * falling back to month 1 (January).
 */
export function getCycleBillingMonths(
  billingFrequency: 'annual' | 'semi-annual' | 'quarterly',
  cycleStartMonth: number,
): number[] {
  const normalizeMonth = (m: number): number => ((m - 1) % 12) + 1;

  switch (billingFrequency) {
    case 'annual':
      return [normalizeMonth(cycleStartMonth)];
    case 'semi-annual':
      return [normalizeMonth(cycleStartMonth), normalizeMonth(cycleStartMonth + 6)];
    case 'quarterly':
      return [
        normalizeMonth(cycleStartMonth),
        normalizeMonth(cycleStartMonth + 3),
        normalizeMonth(cycleStartMonth + 6),
        normalizeMonth(cycleStartMonth + 9),
      ];
    default:
      return [normalizeMonth(cycleStartMonth)];
  }
}

/**
 * Check if today is a billing cycle date for this config.
 */
export function isBillingCycleDate(
  today: Date,
  billingFrequency: 'annual' | 'semi-annual' | 'quarterly',
  cycleStartMonth: number,
  dueDateDay: number,
): boolean {
  const currentMonth = today.getMonth() + 1; // 1-based
  const currentDay = today.getDate();

  if (currentDay !== dueDateDay) return false;

  const billingMonths = getCycleBillingMonths(billingFrequency, cycleStartMonth);
  return billingMonths.includes(currentMonth);
}

/**
 * Compute the billing period [start, end) for the current cycle.
 */
export function computeBillingPeriod(
  today: Date,
  billingFrequency: 'annual' | 'semi-annual' | 'quarterly',
  cycleStartMonth: number,
  dueDateDay: number,
): { periodStart: string; periodEnd: string } {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const periodStartDate = new Date(year, month - 1, dueDateDay);
  const periodStart = periodStartDate.toISOString().split('T')[0];

  let periodEndDate: Date;
  switch (billingFrequency) {
    case 'annual':
      periodEndDate = new Date(year + 1, month - 1, dueDateDay);
      break;
    case 'semi-annual':
      periodEndDate = new Date(year, month - 1 + 6, dueDateDay);
      break;
    case 'quarterly':
      periodEndDate = new Date(year, month - 1 + 3, dueDateDay);
      break;
    default:
      periodEndDate = new Date(year + 1, month - 1, dueDateDay);
  }
  const periodEnd = periodEndDate.toISOString().split('T')[0];

  return { periodStart: periodStart!, periodEnd: periodEnd! };
}

/**
 * Generate a unique invoice number: INV-{orgId-short}-{YYYYMMDD}-{seq}
 */
function generateInvoiceNumber(orgId: string, date: Date, index: number): string {
  const orgShort = orgId.slice(0, 8);
  const dateStr = date.toISOString().split('T')[0]!.replace(/-/g, '');
  const seq = String(index + 1).padStart(4, '0');
  return `INV-${orgShort}-${dateStr}-${seq}`;
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function generateAutoInvoices(ctx: AutoInvoiceContext): Promise<AutoInvoiceResult> {
  const { db, logger } = ctx;
  const today = ctx.now ?? new Date();
  const result: AutoInvoiceResult = { generated: 0, skipped: 0, errors: 0 };

  try {
    // 1. Get all org configs
    const configs = await db.select().from(duesOrgConfigs).limit(500);

    for (const config of configs) {
      try {
        const frequency = config.billingFrequency as 'annual' | 'semi-annual' | 'quarterly';
        const cycleStartMonth = config.dueDateMonth ?? 1;
        const dueDateDay = config.dueDateDay;

        // 2. Check if today is a billing cycle date
        if (!isBillingCycleDate(today, frequency, cycleStartMonth, dueDateDay)) {
          logger?.debug({
            msg: 'Not a billing cycle date for this config',
            orgId: config.organizationId,
            frequency,
            cycleStartMonth,
            dueDateDay,
          });
          continue;
        }

        // 3. Compute billing period
        const { periodStart, periodEnd } = computeBillingPeriod(
          today,
          frequency,
          cycleStartMonth,
          dueDateDay,
        );

        // 4. Get eligible members (active/gracePeriod only)
        const eligibleMembers = await db
          .select({
            id: memberships.id,
            personId: memberships.personId,
            organizationId: memberships.organizationId,
            categoryId: memberships.categoryId,
          })
          .from(memberships)
          .where(
            and(
              eq(memberships.organizationId, config.organizationId),
              notInArray(memberships.status, [...EXCLUDED_STATUSES]),
            ),
          );

        if (eligibleMembers.length === 0) {
          logger?.debug({
            msg: 'No eligible members for org',
            orgId: config.organizationId,
          });
          continue;
        }

        // 5. Get category overrides for this config
        let categoryOverrides: Array<{ categoryId: string; overrideAmount: number }> = [];
        try {
          categoryOverrides = await db
            .select({
              categoryId: duesCategoryOverrides.categoryId,
              overrideAmount: duesCategoryOverrides.overrideAmount,
            })
            .from(duesCategoryOverrides)
            .where(eq(duesCategoryOverrides.duesConfigId, config.id));
        } catch (err) {
          logger?.warn({ msg: 'Failed to fetch category overrides', err, configId: config.id });
        }

        const overrideMap = new Map(
          categoryOverrides.map((o) => [o.categoryId, o.overrideAmount]),
        );

        // 6. Check for existing invoices in this period (idempotency)
        let existingInvoices: Array<{ membershipId: string }> = [];
        try {
          existingInvoices = await db
            .select({ membershipId: duesInvoices.membershipId })
            .from(duesInvoices)
            .where(
              and(
                eq(duesInvoices.organizationId, config.organizationId),
                eq(duesInvoices.periodStart, periodStart),
              ),
            );
        } catch (err) {
          logger?.warn({ msg: 'Failed to check existing invoices', err, orgId: config.organizationId });
        }

        const alreadyInvoiced = new Set(existingInvoices.map((i) => i.membershipId));

        // 7. Compute due date = today + gracePeriodDays
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + config.gracePeriodDays);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        // 8. Generate invoices per member
        let invoiceIndex = 0;
        for (const member of eligibleMembers) {
          try {
            // Skip if already invoiced
            if (alreadyInvoiced.has(member.id)) {
              result.skipped++;
              continue;
            }

            // Determine amount: category override or default
            const amount = member.categoryId && overrideMap.has(member.categoryId)
              ? overrideMap.get(member.categoryId)!
              : config.defaultAmount;

            // Skip life members (amount = 0)
            if (amount === 0) {
              result.skipped++;
              continue;
            }

            const invoiceNumber = generateInvoiceNumber(config.organizationId, today, invoiceIndex);

            await db.insert(duesInvoices).values({
              membershipId: member.id,
              personId: member.personId,
              organizationId: config.organizationId,
              invoiceNumber,
              periodStart,
              periodEnd,
              totalAmount: amount,
              fundAllocations: [], // Fund allocations computed at payment time
              status: 'generated',
            });

            result.generated++;
            invoiceIndex++;

            logger?.debug({
              msg: 'Invoice generated',
              membershipId: member.id,
              personId: member.personId,
              orgId: config.organizationId,
              amount,
              periodStart,
              periodEnd,
            });
          } catch (memberErr) {
            result.errors++;
            logger?.error({
              msg: 'Failed to generate invoice for member',
              err: memberErr,
              membershipId: member.id,
              personId: member.personId,
            });
          }
        }

        logger?.info({
          msg: 'Auto-invoice batch complete for org',
          orgId: config.organizationId,
          generated: result.generated,
          skipped: result.skipped,
          errors: result.errors,
        });
      } catch (configErr) {
        result.errors++;
        logger?.error({
          msg: 'Failed to process config',
          err: configErr,
          configId: config.id,
        });
      }
    }
  } catch (err) {
    logger?.error({ msg: 'Auto-invoice generator failed', err });
    throw err;
  }

  return result;
}
