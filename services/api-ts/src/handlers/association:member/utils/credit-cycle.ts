/**
 * Credit cycle calculation utilities.
 *
 * BR-11: Configurable cycle start date per association.
 *   - When cycleStartMonth/cycleStartDay set: fixed annual anchor (e.g. July 1).
 *   - When unset: per-member registration-based cycles (legacy).
 *
 * BR-12: Carryover capped at 50% of required credits.
 */

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
      throw new Error('registrationDate required when cycleStartMonth is not configured');
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
