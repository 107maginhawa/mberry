/**
 * CreditService — public facade for cross-module credit operations.
 *
 * Encapsulates credit entry creation and cycle calculation so external
 * modules (person) don't import member internals directly.
 *
 * EX-CM-001: Decouples person → association:member repo coupling.
 */

import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { CreditEntryRepository } from '../repos/credits.repo';
import { getCycleForDate } from '../utils/credit-cycle';

interface CreateCreditEntryInput {
  organizationId: string;
  personId: string;
  type: 'manual' | 'auto';
  activityName: string;
  provider?: string;
  activityDate: Date;
  creditAmount: number;
  registrationDate?: Date;
  cyclePeriodYears?: number;
  supportingDocumentId?: string;
}

export class CreditService {
  private repo: CreditEntryRepository;

  constructor(db: DatabaseInstance, logger?: Logger) {
    this.repo = new CreditEntryRepository(db, logger);
  }

  async createEntry(input: CreateCreditEntryInput) {
    const registrationDate = input.registrationDate ?? input.activityDate;
    const cyclePeriodYears = input.cyclePeriodYears ?? 2;
    const cycle = getCycleForDate(registrationDate, input.activityDate, cyclePeriodYears);

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
