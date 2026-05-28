import type { JobContext } from '@/core/jobs';
import { eq, and, sql } from 'drizzle-orm';
import { creditEntries, orgCpdConfig } from '../repos/credits.schema';

export interface CreditIssuePayload {
  sourceType: 'event_checkin' | 'training_completion' | 'course_completion' | 'manual_award';
  sourceId: string; personId: string; organizationId: string; creditAmount: number;
  cpdActivityType?: string | null; attestation?: Record<string, unknown>;
  activityName?: string; category?: 'General' | 'Major' | 'Self-Directed';
}

export interface CreditIssueResult {
  thresholdMet: boolean; personId: string; organizationId: string; totalCredits: number; requiredCredits: number;
}

export async function processCreditIssue(context: JobContext): Promise<CreditIssueResult | null> {
  const { db, logger, data } = context;
  const payload = data as CreditIssuePayload;
  if (!payload.sourceType || !payload.sourceId || !payload.personId || !payload.organizationId) { logger.error({ payload }, 'credit.issue: missing fields'); return null; }
  if (!payload.creditAmount || payload.creditAmount <= 0) { logger.info({ payload }, 'credit.issue: skip'); return null; }

  const config = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, payload.organizationId)).limit(1);
  const cycleStartMonth = config[0]?.cycleStartMonth ?? 1;
  const cycleLengthYears = config[0]?.cycleLengthYears ?? 3;
  const requiredCredits = config[0]?.requiredCredits ?? 60;
  const now = new Date();
  const { cycleStart, cycleEnd } = computeCycleBoundaries(now, cycleStartMonth, cycleLengthYears);
  const sourceLabels: Record<string, string> = { event_checkin: 'Event attendance', training_completion: 'Training completion', course_completion: 'Course completion', manual_award: 'Manual credit award' };

  try {
    await db.insert(creditEntries).values({
      personId: payload.personId, organizationId: payload.organizationId,
      type: payload.sourceType === 'manual_award' ? 'manual' : 'auto',
      activityName: payload.activityName ?? sourceLabels[payload.sourceType] ?? 'Credit award',
      activityDate: now, creditAmount: payload.creditAmount, cycleStart, cycleEnd,
      verificationStatus: 'verified', sourceType: payload.sourceType, sourceId: payload.sourceId,
      cpdActivityType: (payload.cpdActivityType ?? null) as typeof creditEntries.cpdActivityType.enumValues[number] | null, attestation: payload.attestation ?? null,
      status: 'active', category: payload.category ?? null,
    });
    logger.info({ sourceType: payload.sourceType, sourceId: payload.sourceId, personId: payload.personId }, 'credit.issue: created');
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('uq_credit_source_person')) { logger.info({ sourceType: payload.sourceType, sourceId: payload.sourceId }, 'credit.issue: duplicate'); return null; }
    throw err;
  }

  try { await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`); } catch { /* view may not exist yet */ }

  const totalResult = await db.select({ total: sql<number>`COALESCE(SUM(${creditEntries.creditAmount}), 0)` })
    .from(creditEntries).where(and(eq(creditEntries.personId, payload.personId), eq(creditEntries.organizationId, payload.organizationId), eq(creditEntries.status, 'active')));
  const totalCredits = Number(totalResult[0]?.total ?? 0);
  const thresholdMet = totalCredits >= requiredCredits;
  if (thresholdMet) logger.info({ personId: payload.personId, totalCredits, requiredCredits }, 'credit.issue: threshold met');
  return { thresholdMet, personId: payload.personId, organizationId: payload.organizationId, totalCredits, requiredCredits };
}

function computeCycleBoundaries(date: Date, cycleStartMonth: number, cycleLengthYears: number) {
  const year = date.getFullYear(); const month = date.getMonth() + 1;
  const cycleStartYear = month < cycleStartMonth ? year - 1 : year;
  const baseYear = 2020;
  const cycleIndex = Math.floor((cycleStartYear - baseYear) / cycleLengthYears);
  const alignedStartYear = baseYear + cycleIndex * cycleLengthYears;
  return { cycleStart: new Date(alignedStartYear, cycleStartMonth - 1, 1), cycleEnd: new Date(alignedStartYear + cycleLengthYears, cycleStartMonth - 1, 1) };
}
