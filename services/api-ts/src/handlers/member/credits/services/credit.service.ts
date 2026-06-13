/**
 * CreditService — public facade for cross-module credit operations.
 *
 * Encapsulates credit entry creation and cycle calculation so external
 * modules (person) don't import member internals directly.
 *
 * EX-CM-001: Decouples person → association:member repo coupling.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { resolveCycle } from '../utils/credit-cycle';

interface CreateCreditEntryInput {
  organizationId: string;
  personId: string;
  type: 'manual' | 'auto';
  activityName: string;
  provider?: string;
  activityDate: Date;
  creditAmount: number;
  /** @deprecated FIX-004: ignored — cycle now derives from org_cpd_config via resolveCycle. */
  registrationDate?: Date;
  /** @deprecated FIX-004: ignored — cycle period now comes from org_cpd_config.cycleLengthYears. */
  cyclePeriodYears?: number;
  supportingDocumentId?: string;
}

export class CreditService {
  private db: DatabaseInstance;
  private repo: CreditEntryRepository;

  constructor(db: DatabaseInstance, logger?: Logger) {
    this.db = db;
    this.repo = new CreditEntryRepository(db, logger);
  }

  async createEntry(input: CreateCreditEntryInput) {
    // FIX-004 (G2): single cycle authority. Derive the cycle window from the
    // member's org org_cpd_config (cycleStartMonth + cycleLengthYears) anchored
    // at the activity date — the SAME shared resolveCycle() used by the other
    // four credit-write paths (award-training-credit, awardManualCredit,
    // adjustCreditEntry, creditIssue) — instead of the legacy hardcoded 2-year
    // getCycleForDate(activityDate, activityDate, 2) that ignored config and
    // stored a wrong cycle_start/cycle_end on member self-logged rows.
    const [config] = await this.db
      .select()
      .from(orgCpdConfig)
      .where(eq(orgCpdConfig.organizationId, input.organizationId))
      .limit(1);
    const cycle = resolveCycle(
      { cycleStartMonth: config?.cycleStartMonth, cycleLengthYears: config?.cycleLengthYears },
      input.activityDate,
    );

    return this.repo.createOne({
      organizationId: input.organizationId,
      personId: input.personId,
      type: input.type,
      activityName: input.activityName,
      provider: input.provider,
      activityDate: input.activityDate,
      creditAmount: input.creditAmount,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      supportingDocumentId: input.supportingDocumentId,
    });
  }
}
