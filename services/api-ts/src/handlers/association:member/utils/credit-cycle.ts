/**
 * Credit cycle calculation utilities.
 *
 * Per-member cycles based on registration date (NOT calendar year).
 * Cycle = registration_date + (N * cycle_duration_years)
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
}

export interface CreditCycle {
  cycleStart: Date;
  cycleEnd: Date;
  cycleNumber: number;
}

/**
 * Calculate which cycle a given date falls into, based on registration date.
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
 * Get the current cycle for a member.
 */
export function getCurrentCycle(
  registrationDate: Date,
  cyclePeriodYears: number,
): CreditCycle {
  return getCycleForDate(registrationDate, new Date(), cyclePeriodYears);
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
