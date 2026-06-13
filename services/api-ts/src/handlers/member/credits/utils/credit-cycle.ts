/**
 * Credit cycle calculation utilities.
 *
 * BR-11: Configurable cycle start date per association.
 *   - When cycleStartMonth/cycleStartDay set: fixed annual anchor (e.g. July 1).
 *   - When unset: per-member registration-based cycles (legacy).
 *
 * BR-12: Carryover capped at 50% of required credits.
 */

import { ValidationError } from '@/core/errors';

export interface CreditCycleConfig {
  /** Cycle duration in years (1, 2, or 3) */
  cyclePeriodYears: number;
  /** Required credits per cycle */
  requiredCredits: number;
  /** Whether excess credits carry over */
  carryoverEnabled: boolean;
  /** BR-11: Fixed cycle start month (1-12). Null = registration-based. */
  cycleStartMonth?: number | null;
  /** BR-11: Fixed cycle start day (1-31). Defaults to 1. */
  cycleStartDay?: number | null;
}

export interface CreditCycle {
  cycleStart: Date;
  cycleEnd: Date;
  cycleNumber: number;
}

/**
 * Calculate which cycle a given date falls into, based on registration date.
 * Legacy mode: registration-date-anchored cycles.
 */
export function getCycleForDate(
  registrationDate: Date,
  targetDate: Date,
  cyclePeriodYears: number,
): CreditCycle {
  const regMs = registrationDate.getTime();
  const targetMs = targetDate.getTime();
  const cycleDurationMs = cyclePeriodYears * 365.25 * 24 * 60 * 60 * 1000;

  const cycleNumber = Math.floor((targetMs - regMs) / cycleDurationMs);
  const cycleStart = new Date(regMs + cycleNumber * cycleDurationMs);
  const cycleEnd = new Date(regMs + (cycleNumber + 1) * cycleDurationMs - 1);

  return { cycleStart, cycleEnd, cycleNumber };
}

/**
 * BR-11: Calculate cycle based on a fixed annual start date per association.
 *
 * The cycle anchor is month/day each year (e.g. July 1). Multi-year cycles
 * repeat from the anchor: for a 2-year cycle starting July 1, the first
 * boundary year is the earliest year whose July 1 is <= targetDate.
 */
export function getCycleForDateWithConfig(
  targetDate: Date,
  config: CreditCycleConfig,
  /** Fallback registration date for legacy mode */
  registrationDate?: Date,
): CreditCycle {
  const { cycleStartMonth, cycleStartDay, cyclePeriodYears } = config;

  // Legacy mode: no fixed start configured
  if (!cycleStartMonth) {
    if (!registrationDate) {
      throw new ValidationError('registrationDate required when cycleStartMonth is not configured');
    }
    return getCycleForDate(registrationDate, targetDate, cyclePeriodYears);
  }

  const month = cycleStartMonth; // 1-12
  const day = cycleStartDay ?? 1;

  // Find the most recent cycle start on or before targetDate
  const targetYear = targetDate.getFullYear();
  const anchorThisYear = new Date(targetYear, month - 1, day);

  let cycleStartYear: number;
  if (targetDate >= anchorThisYear) {
    cycleStartYear = targetYear;
  } else {
    cycleStartYear = targetYear - 1;
  }

  // Align to cycle period boundary (cycles repeat every N years from some epoch)
  // Use year 2000 as epoch for consistent alignment
  const epochYear = 2000;
  const yearsSinceEpoch = cycleStartYear - epochYear;
  const cycleOffset = ((yearsSinceEpoch % cyclePeriodYears) + cyclePeriodYears) % cyclePeriodYears;
  cycleStartYear -= cycleOffset;

  const cycleStart = new Date(cycleStartYear, month - 1, day);
  const cycleEnd = new Date(cycleStartYear + cyclePeriodYears, month - 1, day);
  cycleEnd.setMilliseconds(cycleEnd.getMilliseconds() - 1);

  // Cycle number from epoch
  const cycleNumber = Math.floor((cycleStartYear - epochYear) / cyclePeriodYears);

  return { cycleStart, cycleEnd, cycleNumber };
}

/**
 * FIX-004 (G2): Single cycle authority.
 *
 * Resolves the credit-tracking cycle window [cycleStart, cycleEnd) for a given
 * activity date from the per-org `org_cpd_config` row (cycleStartMonth +
 * cycleLengthYears). This is the ONE algorithm every credit-write path must
 * use so that entries for the same member/org and the same activity date
 * always land in the same window — replacing the three previously divergent
 * inline computations (training completion's hardcoded 2-year
 * getCycleForDate, awardManualCredit's inline 2020-epoch math, and the
 * creditIssue job's computeCycleBoundaries).
 *
 * Windows are aligned to a fixed epoch (year 2020) so multi-year cycles are
 * stable regardless of which year a member first earns a credit. The anchor
 * month comes from config; the day is always the 1st (the schema has no
 * cycleStartDay column).
 *
 * Note: this intentionally reads ONLY the two config fields that exist on
 * `org_cpd_config`. It does not consult registrationDate — the legacy
 * registration-anchored mode (getCycleForDate) is kept separately for the
 * cross-org transcript, which has no single org config.
 */
export interface ResolveCycleConfig {
  /** Fixed cycle start month (1-12). Defaults to January. */
  cycleStartMonth?: number | null;
  /** Cycle duration in years. Defaults to 3 (org_cpd_config default). */
  cycleLengthYears?: number | null;
}

const CYCLE_EPOCH_YEAR = 2020;

export function resolveCycle(
  config: ResolveCycleConfig,
  activityDate: Date,
): CreditCycle {
  const cycleStartMonth = config.cycleStartMonth ?? 1;
  const cycleLengthYears = config.cycleLengthYears ?? 3;

  const year = activityDate.getFullYear();
  const month = activityDate.getMonth() + 1; // 1-12

  // The cycle-start year is the prior year when the activity falls before the
  // anchor month within its calendar year (mid-cycle).
  const cycleStartYearRaw = month < cycleStartMonth ? year - 1 : year;

  // Align to the fixed-period grid anchored at the epoch year.
  const cycleIndex = Math.floor((cycleStartYearRaw - CYCLE_EPOCH_YEAR) / cycleLengthYears);
  const alignedStartYear = CYCLE_EPOCH_YEAR + cycleIndex * cycleLengthYears;

  const cycleStart = new Date(alignedStartYear, cycleStartMonth - 1, 1);
  const cycleEnd = new Date(alignedStartYear + cycleLengthYears, cycleStartMonth - 1, 1);

  return { cycleStart, cycleEnd, cycleNumber: cycleIndex };
}

/**
 * Get the current cycle for a member.
 */
export function getCurrentCycle(
  registrationDate: Date,
  cyclePeriodYears: number,
): CreditCycle {
  return getCycleForDate(registrationDate, new Date(), cyclePeriodYears);
}

/**
 * BR-11: Get current cycle using association config.
 */
export function getCurrentCycleWithConfig(
  config: CreditCycleConfig,
  registrationDate?: Date,
): CreditCycle {
  return getCycleForDateWithConfig(new Date(), config, registrationDate);
}

/**
 * Calculate carryover credits from previous cycle.
 * BR-12: Capped at 50% of required credits.
 */
export function calculateCarryover(
  earnedCredits: number,
  requiredCredits: number,
  carryoverEnabled: boolean,
): number {
  if (!carryoverEnabled) return 0;
  const excess = earnedCredits - requiredCredits;
  if (excess <= 0) return 0;
  const maxCarryover = Math.floor(requiredCredits * 0.5);
  return Math.min(excess, maxCarryover);
}

/**
 * Summarize credit status for a cycle.
 */
export interface CreditCycleSummary {
  cycle: CreditCycle;
  earned: number;
  required: number;
  carryoverFromPrevious: number;
  total: number;
  remaining: number;
  compliant: boolean;
}

export function summarizeCycle(
  cycle: CreditCycle,
  earned: number,
  required: number,
  carryoverFromPrevious: number,
): CreditCycleSummary {
  const total = earned + carryoverFromPrevious;
  const remaining = Math.max(0, required - total);
  return {
    cycle,
    earned,
    required,
    carryoverFromPrevious,
    total,
    remaining,
    compliant: total >= required,
  };
}
