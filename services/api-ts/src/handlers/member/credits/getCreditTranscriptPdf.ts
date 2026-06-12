import { eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import {
  resolveCycle,
  calculateCarryover,
  summarizeCycle,
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
 *
 * FIX-006 (G4): this is the regulator-facing record. Required credits, cycle
 * length and the cycle window are resolved SERVER-SIDE from the member's
 * org_cpd_config. Client-supplied requiredCredits / cyclePeriodYears /
 * registrationDate / targetDate / cycleStartMonth / cycleStartDay query params
 * are IGNORED so a member cannot self-certify compliance on the PDF. Falls
 * back to platform defaults (60/3) when no config row exists.
 */

interface GetCreditTranscriptPdfQuery {
  carryoverEnabled?: string;
  previousCycleEarned?: string;
  personName?: string;
}

export async function getCreditTranscriptPdf(
  ctx: ValidatedContext<never, GetCreditTranscriptPdfQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const carryoverEnabled = query.carryoverEnabled !== 'false';
  const previousCycleEarned = Number(query.previousCycleEarned) || 0;
  const personName = query.personName ?? user.name ?? 'Member';

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // FIX-006: resolve required credits + cycle from org_cpd_config, not client.
  const organizationId = ctx.get('organizationId') as string | undefined;
  let requiredCredits = 60;
  let cycleConfig: { cycleStartMonth?: number | null; cycleLengthYears?: number | null } = {};
  if (organizationId) {
    const [config] = await db
      .select()
      .from(orgCpdConfig)
      .where(eq(orgCpdConfig.organizationId, organizationId))
      .limit(1);
    if (config) {
      requiredCredits = config.requiredCredits;
      cycleConfig = { cycleStartMonth: config.cycleStartMonth, cycleLengthYears: config.cycleLengthYears };
    }
  }
  const cycle = resolveCycle(cycleConfig, new Date());

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
