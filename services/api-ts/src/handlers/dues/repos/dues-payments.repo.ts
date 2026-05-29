import { eq, and, desc, sql, gte, lte, count, ne, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { memberships } from '../../association:member/repos/membership.schema';
import { duesPaymentStatusHistory } from '../../association:member/repos/dues-payment-status-history.schema';
import { duesInvoices } from './dues.schema';
import { persons } from '../../person/repos/person.schema';
import { assertValidTransition, DUES_PAYMENT_VALID_TRANSITIONS } from '@/utils/status-transitions';

/** @deprecated Use DUES_PAYMENT_VALID_TRANSITIONS from @/utils/status-transitions instead. */
export const VALID_PAYMENT_TRANSITIONS = DUES_PAYMENT_VALID_TRANSITIONS;
import {
  duesOrgConfigs,
  duesCategoryOverrides,
  duesFunds,
  duesPayments,
  duesFundAllocations,
  duesReminderSchedules,
  duesGatewayConfigs,
  type DuesOrgConfig,
  type NewDuesOrgConfig,
  type DuesFund,
  type NewDuesPayment,
  type DuesPayment,
  type NewDuesFundAllocation,
  type DuesReminderSchedule,
  type DuesGatewayConfig,
} from './dues-payments.schema';

export class DuesRepository {
  constructor(private db: DatabaseInstance) {}

  // ─── Config ───────────────────────────────────────────

  async getConfig(organizationId: string): Promise<DuesOrgConfig | undefined> {
    const [config] = await this.db
      .select()
      .from(duesOrgConfigs)
      .where(eq(duesOrgConfigs.organizationId, organizationId))
      .limit(1);
    return config;
  }

  async upsertConfig(organizationId: string, data: Omit<NewDuesOrgConfig, 'organizationId'>): Promise<DuesOrgConfig> {
    const [result] = await this.db
      .insert(duesOrgConfigs)
      .values({ ...data, organizationId })
      .onConflictDoUpdate({
        target: [duesOrgConfigs.organizationId],
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return result!;
  }

  async getCategoryOverrides(duesConfigId: string) {
    return this.db
      .select()
      .from(duesCategoryOverrides)
      .where(eq(duesCategoryOverrides.duesConfigId, duesConfigId));
  }

  async replaceCategoryOverrides(duesConfigId: string, overrides: { categoryId: string; overrideAmount: number }[], organizationId: string) {
    await this.db.delete(duesCategoryOverrides).where(eq(duesCategoryOverrides.duesConfigId, duesConfigId));
    if (overrides.length > 0) {
      await this.db.insert(duesCategoryOverrides).values(
        overrides.map((o) => ({ duesConfigId, organizationId, ...o }))
      );
    }
  }

  // ─── Funds ────────────────────────────────────────────

  async listFunds(organizationId: string): Promise<DuesFund[]> {
    return this.db
      .select()
      .from(duesFunds)
      .where(and(eq(duesFunds.organizationId, organizationId), eq(duesFunds.active, true)))
      .orderBy(duesFunds.sortOrder)
      .limit(100);
  }

  async replaceFunds(organizationId: string, funds: { name: string; percentage: string; sortOrder: number }[]) {
    await this.db
      .update(duesFunds)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(duesFunds.organizationId, organizationId));

    if (funds.length > 0) {
      await this.db.insert(duesFunds).values(
        funds.map((f) => ({ organizationId, name: f.name, percentage: f.percentage, sortOrder: f.sortOrder, active: true }))
      );
    }
  }

  // ─── Payments ─────────────────────────────────────────

  async listPayments(filters: {
    organizationId?: string;
    personId?: string;
    status?: string;
    method?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: DuesPayment[]; total: number }> {
    const conditions: SQL<unknown>[] = [];

    if (filters.organizationId) conditions.push(eq(duesPayments.organizationId, filters.organizationId));
    if (filters.personId) conditions.push(eq(duesPayments.personId, filters.personId));
    if (filters.status) conditions.push(eq(duesPayments.status, filters.status as DuesPayment['status']));
    if (filters.method) conditions.push(eq(duesPayments.paymentMethod, filters.method as DuesPayment['paymentMethod']));
    if (filters.fromDate) conditions.push(gte(duesPayments.paidAt, filters.fromDate));
    if (filters.toDate) conditions.push(lte(duesPayments.paidAt, filters.toDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: duesPayments.id,
          organizationId: duesPayments.organizationId,
          personId: duesPayments.personId,
          invoiceId: duesPayments.invoiceId,
          receiptNumber: duesPayments.receiptNumber,
          amount: duesPayments.amount,
          currency: duesPayments.currency,
          paymentMethod: duesPayments.paymentMethod,
          status: duesPayments.status,
          referenceNumber: duesPayments.referenceNumber,
          paidAt: duesPayments.paidAt,
          createdAt: duesPayments.createdAt,
          updatedAt: duesPayments.updatedAt,
          proofStorageKey: duesPayments.proofStorageKey,
          proofFileName: duesPayments.proofFileName,
          proofMimeType: duesPayments.proofMimeType,
          refundedAmount: duesPayments.refundedAmount,
          refundDate: duesPayments.refundDate,
          refundReason: duesPayments.refundReason,
          rejectionReason: duesPayments.rejectionReason,
          personFirstName: persons.firstName,
          personLastName: persons.lastName,
        })
        .from(duesPayments)
        .leftJoin(persons, eq(persons.id, duesPayments.personId))
        .where(where)
        .orderBy(desc(duesPayments.paidAt))
        .limit(filters.limit ?? 25)
        .offset(filters.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(duesPayments)
        .where(where),
    ]);

    // Shape data with nested person object for frontend consumption
    const shaped = data.map((row) => ({
      ...row,
      person: row.personFirstName ? { firstName: row.personFirstName, lastName: row.personLastName } : null,
    }));

    return { data: shaped as any, total: countResult[0]?.count ?? 0 };
  }

  async getPayment(id: string): Promise<DuesPayment | undefined> {
    const [payment] = await this.db
      .select()
      .from(duesPayments)
      .where(eq(duesPayments.id, id))
      .limit(1);
    return payment;
  }

  async createPayment(data: NewDuesPayment): Promise<DuesPayment> {
    const [result] = await this.db.insert(duesPayments).values(data).returning();
    return result!;
  }

  async updatePaymentStatus(id: string, currentStatus: string, newStatus: string, extra?: Partial<DuesPayment>, actorId?: string): Promise<DuesPayment> {
    assertValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, currentStatus, newStatus, 'dues payment');
    const [result] = await this.db
      .update(duesPayments)
      .set({ status: newStatus as DuesPayment['status'], ...extra, updatedAt: new Date() })
      .where(eq(duesPayments.id, id))
      .returning();

    // [M06 BR financial audit trail] log every status transition
    if (result) {
      const reason =
        (extra as Record<string, unknown> | undefined)?.['refundReason'] ??
        (extra as Record<string, unknown> | undefined)?.['rejectionReason'] ??
        null;
      await this.db.insert(duesPaymentStatusHistory).values({
        organizationId: result.organizationId,
        paymentId: result.id,
        personId: result.personId,
        fromStatus: currentStatus as DuesPayment['status'],
        toStatus: newStatus as DuesPayment['status'],
        reason: reason as string | null,
        changedBy: actorId ?? null,
      });
    }

    return result!;
  }

  async createFundAllocations(allocations: NewDuesFundAllocation[]) {
    if (allocations.length > 0) {
      await this.db.insert(duesFundAllocations).values(allocations);
    }
  }

  async getFundAllocations(paymentId: string) {
    return this.db
      .select()
      .from(duesFundAllocations)
      .where(eq(duesFundAllocations.paymentId, paymentId));
  }

  async findRecentPaymentForPerson(organizationId: string, personId: string, withinMinutes: number = 5): Promise<DuesPayment | undefined> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
    const [recent] = await this.db
      .select()
      .from(duesPayments)
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        eq(duesPayments.personId, personId),
        gte(duesPayments.createdAt, cutoff),
      ))
      .orderBy(desc(duesPayments.createdAt))
      .limit(1);
    return recent;
  }

  async getNextReceiptSequence(organizationId: string, year: number): Promise<number> {
    const pattern = `%-${year}-%`;
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(duesPayments)
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        sql`${duesPayments.receiptNumber} LIKE ${pattern}`,
      ));
    return (result?.count ?? 0) + 1;
  }

  // ─── Dashboard Stats ──────────────────────────────────

  async getDashboardStats(organizationId: string) {
    const [stats] = await this.db
      .select({
        totalCollected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int`,
        totalOutstanding: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::int`,
        pendingCount: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)::int`,
        completedCount: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)::int`,
        totalCount: sql<number>`COUNT(*)::int`,
      })
      .from(duesPayments)
      .where(eq(duesPayments.organizationId, organizationId));

    return {
      totalCollected: stats?.totalCollected ?? 0,
      totalOutstanding: stats?.totalOutstanding ?? 0,
      pendingCount: stats?.pendingCount ?? 0,
      completedCount: stats?.completedCount ?? 0,
      totalCount: stats?.totalCount ?? 0,
      collectionRate: stats?.totalCount
        ? Math.round(((stats?.completedCount ?? 0) / stats.totalCount) * 100)
        : 0,
    };
  }

  /**
   * Invoice-aware dashboard stats — joins duesPayments + duesInvoices for
   * richer metrics (unpaidCount, overdueCount). collectionRate is 0-100 integer.
   * Preferred over getDashboardStats() for officer-facing dashboards.
   */
  async getFullDashboardStats(organizationId: string) {
    const [paymentStats] = await this.db
      .select({
        totalCollected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int`,
        paidCount: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)::int`,
      })
      .from(duesPayments)
      .where(eq(duesPayments.organizationId, organizationId));

    const [invoiceStats] = await this.db
      .select({
        totalOutstanding: sql<number>`COALESCE(SUM(CASE WHEN status IN ('generated', 'sent', 'overdue') THEN total_amount ELSE 0 END), 0)::int`,
        unpaidCount: sql<number>`COUNT(CASE WHEN status IN ('generated', 'sent') THEN 1 END)::int`,
        overdueCount: sql<number>`COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int`,
      })
      .from(duesInvoices)
      .where(eq(duesInvoices.organizationId, organizationId));

    const totalCollected = paymentStats?.totalCollected ?? 0;
    const totalOutstanding = invoiceStats?.totalOutstanding ?? 0;
    const total = totalCollected + totalOutstanding;

    return {
      totalCollected,
      totalOutstanding,
      paidCount: paymentStats?.paidCount ?? 0,
      unpaidCount: invoiceStats?.unpaidCount ?? 0,
      overdueCount: invoiceStats?.overdueCount ?? 0,
      collectionRate: total > 0 ? Math.round((totalCollected / total) * 100) : 0,
    };
  }

  /**
   * Treasurer metrics: trailing collection rates, monthly breakdown, status distribution.
   * All collectionRate values are 0-100 integers.
   */
  async getMetricsWithTrends(organizationId: string) {
    // Trailing collection rates for 30/90/365 day windows
    const trailingRates = await this.computeTrailingRates(organizationId, [30, 90, 365]);

    // Monthly breakdown (last 12 months)
    const monthlyBreakdown = await this.computeMonthlyBreakdown(organizationId, 12);

    // Member status distribution from invoice statuses
    const statusDistribution = await this.computeStatusDistribution(organizationId);

    // Top unpaid members (up to 10)
    const topUnpaid = await this.computeTopUnpaid(organizationId, 10);

    return { trailingRates, monthlyBreakdown, statusDistribution, topUnpaid };
  }

  private async computeTrailingRates(organizationId: string, windows: number[]) {
    const results: Record<string, number> = {};

    for (const days of windows) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const [stats] = await this.db
        .select({
          collected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' AND ${duesPayments.paidAt} >= ${cutoff} THEN amount ELSE 0 END), 0)::int`,
          total: sql<number>`COALESCE(SUM(CASE WHEN ${duesPayments.createdAt} >= ${cutoff} THEN amount ELSE 0 END), 0)::int`,
        })
        .from(duesPayments)
        .where(eq(duesPayments.organizationId, organizationId));

      const collected = stats?.collected ?? 0;
      const total = stats?.total ?? 0;
      results[`days${days}`] = total > 0 ? Math.round((collected / total) * 100) : 0;
    }

    return results as { days30: number; days90: number; days365: number };
  }

  private async computeMonthlyBreakdown(organizationId: string, months: number) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    return this.db
      .select({
        month: sql<string>`to_char(${duesPayments.paidAt}, 'YYYY-MM')`,
        collected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int`,
        outstanding: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::int`,
      })
      .from(duesPayments)
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        gte(duesPayments.createdAt, cutoff),
      ))
      .groupBy(sql`to_char(${duesPayments.paidAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${duesPayments.paidAt}, 'YYYY-MM')`);
  }

  private async computeStatusDistribution(organizationId: string) {
    const [dist] = await this.db
      .select({
        active: sql<number>`COUNT(CASE WHEN status = 'paid' THEN 1 END)::int`,
        dueSoon: sql<number>`COUNT(CASE WHEN status IN ('generated', 'sent') THEN 1 END)::int`,
        overdue: sql<number>`COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int`,
        lapsed: sql<number>`COUNT(CASE WHEN status = 'voided' THEN 1 END)::int`,
      })
      .from(duesInvoices)
      .where(eq(duesInvoices.organizationId, organizationId));

    return {
      active: dist?.active ?? 0,
      dueSoon: dist?.dueSoon ?? 0,
      overdue: dist?.overdue ?? 0,
      lapsed: dist?.lapsed ?? 0,
    };
  }

  /**
   * Per-member financial summary: invoices, payments, computed balance, status timeline.
   * Balance = sum of unpaid invoice amounts (status not 'paid').
   */
  async getMemberFinancialSummary(organizationId: string, personId: string) {
    const invoices = await this.db
      .select()
      .from(duesInvoices)
      .where(and(
        eq(duesInvoices.organizationId, organizationId),
        eq(duesInvoices.personId, personId),
      ))
      .orderBy(desc(duesInvoices.generatedAt));

    const payments = await this.listPayments({
      organizationId,
      personId,
      limit: 100,
    });

    // Balance = sum of unpaid invoice amounts
    const balance = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    // Status timeline from membership_status_history
    const { membershipStatusHistory } = await import('../../association:member/repos/status-history.schema');
    const statusTimeline = await this.db
      .select({
        fromStatus: membershipStatusHistory.fromStatus,
        toStatus: membershipStatusHistory.toStatus,
        changedAt: membershipStatusHistory.changedAt,
      })
      .from(membershipStatusHistory)
      .where(and(
        eq(membershipStatusHistory.organizationId, organizationId),
        eq(membershipStatusHistory.personId, personId),
      ))
      .orderBy(membershipStatusHistory.changedAt);

    return {
      invoices,
      payments: payments.data,
      balance,
      statusTimeline,
    };
  }

  async getMemberCount(organizationId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(memberships)
      .where(and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
      ));
    return result?.count ?? 0;
  }

  // ─── Reminders ────────────────────────────────────────

  async getReminderSchedules(duesConfigId: string): Promise<DuesReminderSchedule[]> {
    return this.db
      .select()
      .from(duesReminderSchedules)
      .where(eq(duesReminderSchedules.duesConfigId, duesConfigId))
      .orderBy(duesReminderSchedules.daysOffset)
      .limit(100);
  }

  async replaceReminderSchedules(duesConfigId: string, schedules: Omit<DuesReminderSchedule, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy' | 'updatedBy' | 'duesConfigId' | 'organizationId'>[], organizationId: string) {
    await this.db.delete(duesReminderSchedules).where(eq(duesReminderSchedules.duesConfigId, duesConfigId));
    if (schedules.length > 0) {
      await this.db.insert(duesReminderSchedules).values(
        schedules.map((s) => ({ ...s, duesConfigId, organizationId }))
      );
    }
  }

  // ─── Reports ──────────────────────────────────────────

  async reportCollectionSummary(organizationId: string, from: Date, to: Date) {
    return this.db
      .select({
        month: sql<string>`to_char(${duesPayments.paidAt}, 'YYYY-MM')`,
        method: duesPayments.paymentMethod,
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${duesPayments.amount}), 0)::int`,
      })
      .from(duesPayments)
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        eq(duesPayments.status, 'completed'),
        gte(duesPayments.paidAt, from),
        lte(duesPayments.paidAt, to),
      ))
      .groupBy(sql`to_char(${duesPayments.paidAt}, 'YYYY-MM')`, duesPayments.paymentMethod)
      .orderBy(sql`to_char(${duesPayments.paidAt}, 'YYYY-MM')`);
  }

  async reportFundBreakdown(organizationId: string, from: Date, to: Date) {
    return this.db
      .select({
        fundId: duesFundAllocations.fundId,
        fundName: duesFunds.name,
        percentage: duesFunds.percentage,
        totalAllocated: sql<number>`COALESCE(SUM(CASE WHEN ${duesFundAllocations.isReversal} = false THEN ${duesFundAllocations.amount} ELSE 0 END), 0)::int`,
        totalReversals: sql<number>`COALESCE(SUM(CASE WHEN ${duesFundAllocations.isReversal} = true THEN ${duesFundAllocations.amount} ELSE 0 END), 0)::int`,
        netTotal: sql<number>`COALESCE(SUM(${duesFundAllocations.amount}), 0)::int`,
      })
      .from(duesFundAllocations)
      .innerJoin(duesPayments, eq(duesFundAllocations.paymentId, duesPayments.id))
      .innerJoin(duesFunds, eq(duesFundAllocations.fundId, duesFunds.id))
      .where(and(
        eq(duesPayments.organizationId, organizationId),
        gte(duesPayments.paidAt, from),
        lte(duesPayments.paidAt, to),
      ))
      .groupBy(duesFundAllocations.fundId, duesFunds.name, duesFunds.percentage);
  }

  async reportDuesStatus(organizationId: string, from?: Date, to?: Date) {
    const conditions = [eq(duesPayments.organizationId, organizationId)];
    if (from) conditions.push(gte(duesPayments.paidAt, from));
    if (to) conditions.push(lte(duesPayments.paidAt, to));

    return this.db
      .select({
        personId: duesPayments.personId,
        totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${duesPayments.status} = 'completed' THEN ${duesPayments.amount} ELSE 0 END), 0)::int`,
        lastPaymentDate: sql<string>`MAX(${duesPayments.paidAt})`,
        paymentCount: sql<number>`count(*)::int`,
      })
      .from(duesPayments)
      .where(and(...conditions))
      .groupBy(duesPayments.personId);
  }

  async reportAging(organizationId: string, from?: Date, to?: Date) {
    const conditions = [
      eq(duesPayments.organizationId, organizationId),
      eq(duesPayments.status, 'pending'),
    ];
    if (from) conditions.push(gte(duesPayments.createdAt, from));
    if (to) conditions.push(lte(duesPayments.createdAt, to));

    return this.db
      .select({
        personId: duesPayments.personId,
        amount: duesPayments.amount,
        paidAt: duesPayments.paidAt,
        daysPending: sql<number>`EXTRACT(DAY FROM NOW() - ${duesPayments.createdAt})::int`,
      })
      .from(duesPayments)
      .where(and(...conditions))
      .orderBy(duesPayments.createdAt);
  }

  // ─── Top Unpaid ───────────────────────────────────────

  private async computeTopUnpaid(organizationId: string, limit: number) {
    const rows = await this.db
      .select({
        personId: duesInvoices.membershipId,
        name: sql<string>`COALESCE(${persons.firstName} || ' ' || ${persons.lastName}, 'Unknown')`,
        outstanding: sql<number>`COALESCE(SUM(${duesInvoices.totalAmount}), 0)::int`,
        invoiceCount: sql<number>`COUNT(*)::int`,
      })
      .from(duesInvoices)
      .leftJoin(persons, eq(duesInvoices.membershipId, persons.id))
      .where(
        and(
          eq(duesInvoices.organizationId, organizationId),
          ne(duesInvoices.status, 'paid'),
          ne(duesInvoices.status, 'cancelled'),
        ),
      )
      .groupBy(duesInvoices.membershipId, persons.firstName, persons.lastName)
      .orderBy(sql`SUM(${duesInvoices.totalAmount}) DESC`)
      .limit(limit);

    return rows;
  }

  // ─── Gateway ──────────────────────────────────────────

  async getGatewayConfig(organizationId: string): Promise<DuesGatewayConfig | undefined> {
    const [config] = await this.db
      .select()
      .from(duesGatewayConfigs)
      .where(eq(duesGatewayConfigs.organizationId, organizationId))
      .limit(1);
    return config;
  }
}
