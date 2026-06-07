import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import {
  getCycleForDate,
  getCycleForDateWithConfig,
  calculateCarryover,
  summarizeCycle,
  type CreditCycleConfig,
} from './utils/credit-cycle';
import {
  renderTranscriptHtml,
  validateTranscriptData,
  type TranscriptData,
  type TranscriptCreditEntry,
} from './utils/transcript-template';

/**
 * getCreditTranscriptPdf (Slice 043)
 *
 * Generates a cycle-aware credit transcript as HTML for PDF conversion.
 * Cross-org aggregated with per-org breakdowns, cycle boundary display,
 * and compliance status.
 */

interface GetCreditTranscriptPdfQuery {
  registrationDate: string;
  cyclePeriodYears?: string;
  requiredCredits?: string;
  carryoverEnabled?: string;
  previousCycleEarned?: string;
  targetDate?: string;
  personName?: string;
  /** Association-level cycle config (BR-11) */
  cycleStartMonth?: string;
  cycleStartDay?: string;
}

export async function getCreditTranscriptPdf(
  ctx: ValidatedContext<never, GetCreditTranscriptPdfQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const registrationDate = new Date(query.registrationDate);
  const cyclePeriodYears = Number(query.cyclePeriodYears) || 2;
  const requiredCredits = Number(query.requiredCredits) || 40;
  const carryoverEnabled = query.carryoverEnabled !== 'false';
  const previousCycleEarned = Number(query.previousCycleEarned) || 0;
  const targetDate = query.targetDate ? new Date(query.targetDate) : new Date();
  const personName = query.personName ?? user.name ?? 'Member';
  const cycleStartMonth = query.cycleStartMonth ? Number(query.cycleStartMonth) : null;
  const cycleStartDay = query.cycleStartDay ? Number(query.cycleStartDay) : undefined;

  // Determine cycle using either association-level config (BR-11) or registration-based
  let cycle;
  if (cycleStartMonth) {
    const config: CreditCycleConfig = {
      cyclePeriodYears,
      requiredCredits,
      carryoverEnabled,
      cycleStartMonth,
      cycleStartDay,
    };
    cycle = getCycleForDateWithConfig(targetDate, config, registrationDate);
  } else {
    cycle = getCycleForDate(registrationDate, targetDate, cyclePeriodYears);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CreditEntryRepository(db, logger);

  // Get cross-org credit summaries
  const byOrg = await repo.sumCreditsByOrg(user.id, cycle.cycleStart, cycle.cycleEnd);
  const totalEarned = byOrg.reduce((sum, entry) => sum + entry.total, 0);

  // Get individual credit entries for the transcript detail
  const entries = await repo.listForPerson(user.id, {
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
  });

  const carryover = calculateCarryover(previousCycleEarned, requiredCredits, carryoverEnabled);
  const summary = summarizeCycle(cycle, totalEarned, requiredCredits, carryover);

  // Map entries to transcript format
  const transcriptEntries: TranscriptCreditEntry[] = (entries ?? []).map((e) => ({
    activityName: e.activityName ?? 'Activity',
    activityDate: new Date(e.activityDate as unknown as string),
    creditAmount: Number(e.creditAmount),
    category: e.category ?? undefined,
    type: e.type ?? 'manual',
    organizationName: (e as Record<string, unknown>)['organizationName'] as string ?? undefined,
  }));

  const transcriptData: TranscriptData = {
    personName,
    personId: user.id,
    generatedAt: new Date(),
    cycle,
    summary,
    entries: transcriptEntries,
    organizations: byOrg.map(o => ({
      organizationId: o.organizationId,
      name: (o as Record<string, unknown>)['organizationName'] as string ?? o.organizationId,
      credits: o.total,
    })),
  };

  const validationErrors = validateTranscriptData(transcriptData);
  if (validationErrors.length > 0) {
    return ctx.json({ error: 'Invalid transcript data', details: validationErrors }, 400);
  }

  const html = renderTranscriptHtml(transcriptData);

  return ctx.json({
    personId: user.id,
    cycle: {
      cycleStart: cycle.cycleStart.toISOString(),
      cycleEnd: cycle.cycleEnd.toISOString(),
      cycleNumber: cycle.cycleNumber,
    },
    summary: {
      earned: summary.earned,
      carryoverFromPrevious: summary.carryoverFromPrevious,
      total: summary.total,
      required: summary.required,
      remaining: summary.remaining,
      compliant: summary.compliant,
    },
    html,
    contentType: 'text/html',
  }, 200);
}
