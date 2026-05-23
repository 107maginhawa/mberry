/**
 * Repository for special assessments CRUD and collection metrics.
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  specialAssessments,
  specialAssessmentTargets,
  type NewSpecialAssessment,
} from './special-assessments.schema';
import { duesInvoices } from './dues.schema';

export class SpecialAssessmentRepository {
  constructor(private db: DatabaseInstance) {}

  async create(data: NewSpecialAssessment) {
    const [result] = await this.db.insert(specialAssessments).values(data).returning();
    return result;
  }

  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(specialAssessments)
      .where(eq(specialAssessments.id, id));
    return result ?? null;
  }

  async listByOrg(organizationId: string) {
    return this.db
      .select()
      .from(specialAssessments)
      .where(eq(specialAssessments.organizationId, organizationId))
      .orderBy(desc(specialAssessments.createdAt));
  }

  async update(id: string, data: Partial<Pick<NewSpecialAssessment, 'name' | 'description' | 'amount' | 'currency' | 'dueDate' | 'fundId' | 'appliesTo'>>) {
    const [result] = await this.db
      .update(specialAssessments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(specialAssessments.id, id))
      .returning();
    return result ?? null;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(specialAssessments)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(specialAssessments.id, id))
      .returning();
    return result ?? null;
  }

  async setStatus(id: string, status: 'draft' | 'active' | 'closed') {
    const [result] = await this.db
      .update(specialAssessments)
      .set({ status, updatedAt: new Date() })
      .where(eq(specialAssessments.id, id))
      .returning();
    return result ?? null;
  }

  // ─── Targets ───────────────────────────────────────────

  async addTargets(assessmentId: string, personIds: string[]) {
    if (personIds.length === 0) return [];
    const values = personIds.map(personId => ({ assessmentId, personId }));
    return this.db.insert(specialAssessmentTargets).values(values).returning();
  }

  async getTargets(assessmentId: string) {
    return this.db
      .select()
      .from(specialAssessmentTargets)
      .where(eq(specialAssessmentTargets.assessmentId, assessmentId));
  }

  async getTargetPersonIds(assessmentId: string): Promise<string[]> {
    const targets = await this.getTargets(assessmentId);
    return targets.map(t => t.personId);
  }

  async findTargetByAssessmentAndPerson(assessmentId: string, personId: string) {
    const [result] = await this.db
      .select()
      .from(specialAssessmentTargets)
      .where(and(
        eq(specialAssessmentTargets.assessmentId, assessmentId),
        eq(specialAssessmentTargets.personId, personId),
      ));
    return result ?? null;
  }

  async updateTargetInvoice(targetId: string, invoiceId: string) {
    const [result] = await this.db
      .update(specialAssessmentTargets)
      .set({ invoiceId, status: 'paid', updatedAt: new Date() })
      .where(eq(specialAssessmentTargets.id, targetId))
      .returning();
    return result ?? null;
  }

  async markTargetWithInvoice(assessmentId: string, personId: string, invoiceId: string) {
    const [result] = await this.db
      .update(specialAssessmentTargets)
      .set({ invoiceId, updatedAt: new Date() })
      .where(and(
        eq(specialAssessmentTargets.assessmentId, assessmentId),
        eq(specialAssessmentTargets.personId, personId),
      ))
      .returning();
    return result ?? null;
  }

  // ─── Collection Metrics ────────────────────────────────

  async getCollectionMetrics(assessmentId: string) {
    const targets = await this.getTargets(assessmentId);
    const assessment = await this.findById(assessmentId);
    if (!assessment) return null;

    const totalTargets = targets.length;
    const withInvoice = targets.filter(t => t.invoiceId !== null);

    // Check which invoices are paid
    let paidCount = 0;
    let paidAmount = 0;
    if (withInvoice.length > 0) {
      const invoiceIds = withInvoice.map(t => t.invoiceId!);
      const paidInvoices = await this.db
        .select()
        .from(duesInvoices)
        .where(and(
          sql`${duesInvoices.id} IN (${sql.join(invoiceIds.map(id => sql`${id}`), sql`,`)})`,
          eq(duesInvoices.status, 'paid'),
        ));
      paidCount = paidInvoices.length;
      paidAmount = paidCount * assessment.amount;
    }

    const pendingCount = totalTargets - paidCount;
    const pendingAmount = pendingCount * assessment.amount;
    const totalAmount = totalTargets * assessment.amount;

    return {
      totalTargets,
      paidCount,
      paidAmount,
      pendingCount,
      pendingAmount,
      totalAmount,
    };
  }

  // ─── Active Members Query ─────────────────────────────

  async getActiveOrgMemberPersonIds(organizationId: string): Promise<string[]> {
    // Import dynamically to avoid circular dependency
    const { memberships } = await import('./membership.schema');
    const rows = await this.db
      .select({ personId: memberships.personId })
      .from(memberships)
      .where(and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
      ));
    return rows.map(r => r.personId);
  }
}
