import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { resolveCycle } from '@/handlers/member/credits/utils/credit-cycle';
import { orgCpdConfig } from '@/handlers/association:member/repos/credits.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { isEnabled } from '@/core/feature-flags';
import type { Training } from '../repos/training.schema';

/**
 * Award a single AUTO CreditEntry for a person completing a credit-bearing
 * training. Shared by completeTrainingEnrollment (FIX-001 credit-award path)
 * and checkInCustomTraining (officer per-member attendance → credit).
 *
 * [SHARED DEPENDENCY] reads/writes the credits repo that lives in
 * association:member/repos. Fixed in place per the deferred P1-11 split.
 *
 * Behaviour:
 * - Returns { creditAwarded } where creditAwarded is the credits actually
 *   recorded. It is the training's creditAmount on success, and 0 when the
 *   training is not credit-bearing, when a credit already exists
 *   (idempotent — [AC-M10-002]), or when the insert FAILS.
 * - G8 / FIX-002: a credit-insert failure is logged and surfaced as
 *   creditAwarded:0 instead of being swallowed by a bare catch and reported
 *   as if the credit had been awarded.
 */
export async function awardTrainingCredit(
  db: DatabaseInstance,
  logger: { error?: (...a: unknown[]) => void; debug?: (...a: unknown[]) => void } | null | undefined,
  training: Pick<Training, 'id' | 'organizationId' | 'title' | 'creditAmount'> & {
    creditBearing?: boolean | null;
    endDate?: Date | null;
  },
  personId: string,
): Promise<{ creditAwarded: number }> {
  const creditBearing = (training as { creditBearing?: boolean | null }).creditBearing;
  if (!creditBearing || !training.creditAmount || training.creditAmount <= 0) {
    return { creditAwarded: 0 };
  }

  // FIX-009 (G9 / M9-R8): honour the hosting org's credit-tracking toggle.
  // Suppress the AUTO credit award when the org has explicitly disabled
  // credit tracking in organizations.featureFlags. Default is ON — the
  // toggle only ever suppresses (absent flag / no org row → award).
  const [org] = await db
    .select({ featureFlags: organizations.featureFlags })
    .from(organizations)
    .where(eq(organizations.id, training.organizationId))
    .limit(1);
  const flags = (org?.featureFlags ?? {}) as Record<string, boolean>;
  if (Object.prototype.hasOwnProperty.call(flags, 'creditTracking') && !isEnabled(flags, 'creditTracking')) {
    logger?.debug?.(
      { trainingId: training.id, personId, organizationId: training.organizationId },
      'Credit tracking disabled for org — auto credit suppressed (M9-R8)',
    );
    return { creditAwarded: 0 };
  }

  const creditRepo = new CreditEntryRepository(db, logger as never);

  // [AC-M10-002] Duplicate guard — one AUTO credit per training+person.
  const existing = await creditRepo.findByTrainingAndPerson(training.id, personId);
  if (existing) {
    return { creditAwarded: 0 };
  }

  const activityDate = training.endDate ?? new Date();

  // FIX-004 (G2): single cycle authority. Resolve the cycle window from the
  // hosting org's org_cpd_config (cycleStartMonth + cycleLengthYears) anchored
  // at the activity date — instead of the previous degenerate
  // getCycleForDate(activityDate, activityDate, 2) that ignored config and
  // hardcoded a 2-year period. Falls back to config defaults (Jan, 3-year)
  // when no config row exists.
  const [config] = await db
    .select()
    .from(orgCpdConfig)
    .where(eq(orgCpdConfig.organizationId, training.organizationId))
    .limit(1);
  const cycle = resolveCycle(
    { cycleStartMonth: config?.cycleStartMonth, cycleLengthYears: config?.cycleLengthYears },
    activityDate,
  );

  try {
    await creditRepo.createOne({
      personId,
      organizationId: training.organizationId,
      type: 'auto',
      trainingId: training.id,
      activityName: training.title,
      provider: training.organizationId,
      activityDate,
      creditAmount: training.creditAmount,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      // TC-DEC-02 (Step 47): AUTO credits are system-verified at award time —
      // officer attendance confirmation IS the verification. They must count
      // toward the member total immediately, so they bypass the manual-entry
      // verification gate that holds member self-reported entries at 'pending'.
      verificationStatus: 'verified',
    });
    return { creditAwarded: training.creditAmount };
  } catch (err) {
    // G8 / FIX-002: do NOT swallow. Surface the failure so the completion
    // does not falsely report credits that were never persisted.
    logger?.error?.(
      { err, trainingId: training.id, personId },
      'Auto credit award failed during training completion',
    );
    return { creditAwarded: 0 };
  }
}
