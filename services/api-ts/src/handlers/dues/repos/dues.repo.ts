import { eq, and, desc, sql, gte, lte, type SQL, count } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { duesInvoices } from '@/handlers/association:member/repos/dues.schema';

/** Valid dues payment status transitions — used by handlers for guard logic. */
export const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['completed', 'failed', 'expired'],
  submitted: ['underReview', 'confirmed', 'rejected'],
  underReview: ['confirmed', 'rejected'],
  confirmed: ['completed', 'refunded', 'partiallyRefunded'],
  completed: ['refunded', 'partiallyRefunded'],
  partiallyRefunded: ['refunded'],
  failed: ['pending'],       // retry
  rejected: ['pending'],     // resubmit
  refunded: [],              // terminal
  expired: [],               // terminal
};
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
} from '../../association:member/repos/dues-payments.schema';

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
      .orderBy(duesFunds.sortOrder);
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
        .select()
        .from(duesPayments)
        .where(where)
        .orderBy(desc(duesPayments.paidAt))
        .limit(filters.limit ?? 25)
        .offset(filters.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(duesPayments)
        .where(where),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
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

  async updatePaymentStatus(id: string, status: string, extra?: Partial<DuesPayment>): Promise<DuesPayment> {
    const [result] = await this.db
      .update(duesPayments)
      .set({ status: status as DuesPayment['status'], ...extra, updatedAt: new Date() })
      .where(eq(duesPayments.id, id))
      .returning();
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
    // Payment stats from duesPayments table
    const [paymentStats] = await this.db
      .select({
        totalCollected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int`,
        paidCount: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)::int`,
      })
      .from(duesPayments)
      .where(eq(duesPayments.organizationId, organizationId));

    // Outstanding invoices from duesInvoices table
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
      collectionRate: total > 0 ? +(totalCollected / total).toFixed(2) : 0,
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
      .orderBy(duesReminderSchedules.daysOffset);
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
