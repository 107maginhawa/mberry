/**
 * SuppressionRepository — data access for email suppression list
 *
 * All queries are org-scoped to prevent cross-tenant data leakage (T-25-02).
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type FindManyOptions, type PaginatedResult } from '@/core/database.repo';
import {
  emailSuppressions,
  type EmailSuppression,
  type NewEmailSuppression,
  type SuppressionFilters,
  type SuppressionReason,
} from './suppression.schema';

export class SuppressionRepository extends DatabaseRepository<
  EmailSuppression,
  NewEmailSuppression,
  SuppressionFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, emailSuppressions, logger);
  }

  protected buildWhereConditions(filters?: SuppressionFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL<unknown>[] = [];

    if (filters.organizationId) {
      conditions.push(eq(emailSuppressions.organizationId, filters.organizationId));
    }

    if (filters.email) {
      conditions.push(eq(emailSuppressions.email, filters.email));
    }

    if (filters.reason) {
      conditions.push(eq(emailSuppressions.reason, filters.reason));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Return the suppression reason for an email address in the given
   * organization, or `null` if it is not suppressed. Org-scoped.
   *
   * Reason-aware lookup used by the email send pipeline (BR-57): transactional
   * mail may override a marketing (`unsubscribe`) suppression while still
   * respecting deliverability suppressions (`hard_bounce`/`complaint`). The
   * boolean `isSuppressed` wrapper below is kept for existing callers.
   */
  async getSuppressionReason(email: string, orgId: string): Promise<SuppressionReason | null> {
    this.logger?.debug({ email, orgId }, 'Looking up email suppression reason');

    const records = await this.findMany(
      { organizationId: orgId, email },
      { pagination: { offset: 0, limit: 1 } },
    );

    return records[0]?.reason ?? null;
  }

  /**
   * Check whether an email address is suppressed for the given organization.
   * Org-scoped — suppression in org-A does not affect org-B.
   */
  async isSuppressed(email: string, orgId: string): Promise<boolean> {
    return (await this.getSuppressionReason(email, orgId)) !== null;
  }

  /**
   * Add an email address to the suppression list for an organization.
   * Idempotent — if the email is already suppressed for that org, this is a no-op.
   */
  async addSuppression(data: {
    orgId: string;
    email: string;
    reason: SuppressionReason;
    suppressedBy?: string;
    notes?: string;
  }): Promise<void> {
    this.logger?.debug({ email: data.email, orgId: data.orgId, reason: data.reason }, 'Adding suppression');

    try {
      await this.createOne({
        organizationId: data.orgId,
        email: data.email,
        reason: data.reason,
        suppressedBy: data.suppressedBy ?? null,
        notes: data.notes ?? null,
        suppressedAt: new Date(),
      });
    } catch (err: any) {
      // Unique constraint violation (23505) — already suppressed, treat as no-op.
      // Drizzle wraps driver errors (DrizzleQueryError) with the pg error on
      // `.cause`, so check both levels — a second hard_bounce/complaint for an
      // already-suppressed address (BR-55/56) must stay an idempotent no-op.
      const code = err?.code ?? err?.cause?.code;
      const message = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`;
      if (code === '23505' || /unique/i.test(message)) {
        this.logger?.debug(
          { email: data.email, orgId: data.orgId },
          'Email already suppressed — skipping duplicate',
        );
        return;
      }
      throw err;
    }

    this.logger?.info({ email: data.email, orgId: data.orgId, reason: data.reason }, 'Suppression added');
  }

  /**
   * List all suppressed email addresses for an organization (paginated).
   */
  async listByOrg(orgId: string, options?: FindManyOptions): Promise<PaginatedResult<EmailSuppression>> {
    this.logger?.debug({ orgId }, 'Listing suppressions for org');

    return this.findManyWithPagination({ organizationId: orgId }, options);
  }

  /**
   * Remove a suppression entry for the given org+email pair.
   * No-op if the entry does not exist.
   */
  async removeSuppression(orgId: string, email: string): Promise<void> {
    this.logger?.debug({ email, orgId }, 'Removing suppression');

    await this.db
      .delete(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.organizationId, orgId),
          eq(emailSuppressions.email, email),
        ),
      );

    this.logger?.info({ email, orgId }, 'Suppression removed');
  }

  /**
   * Remove a suppression by its record ID, scoped to an organization.
   * Returns the removed row, or `null` if no row with that ID exists in the
   * org (so callers can return 404 rather than a silent success). Org-scoping
   * prevents an admin from deleting another tenant's suppression (T-25-02).
   *
   * Powers `DELETE /email/suppressions/:id` (FIX-007 / WF-125) — letting an
   * admin unblock a wrongly or mistyped-suppressed address.
   */
  async deleteByIdForOrg(id: string, orgId: string): Promise<EmailSuppression | null> {
    this.logger?.debug({ id, orgId }, 'Removing suppression by id');

    const [existing] = await this.db
      .select()
      .from(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.id, id),
          eq(emailSuppressions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!existing) {
      this.logger?.debug({ id, orgId }, 'Suppression not found for org — nothing removed');
      return null;
    }

    await this.db
      .delete(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.id, id),
          eq(emailSuppressions.organizationId, orgId),
        ),
      );

    this.logger?.info({ id, orgId, email: existing.email }, 'Suppression removed by id');
    return existing;
  }
}
