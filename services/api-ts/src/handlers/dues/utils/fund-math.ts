export interface FundSplit {
  fundId: string;
  percentage: number;
}

export interface FundAllocationResult {
  fundId: string;
  amount: number;
}

/**
 * BR-05: Fund allocation percentages must sum to exactly 100%.
 * Tolerance of 0.01 for floating-point precision.
 * Returns null if valid, error message string if invalid.
 */
export function validateFundSplits(funds: FundSplit[]): string | null {
  if (funds.length === 0) return 'At least one fund is required';

  for (const fund of funds) {
    if (fund.percentage < 0) return `Fund ${fund.fundId} has negative percentage: ${fund.percentage}`;
    if (fund.percentage > 100) return `Fund ${fund.fundId} has percentage over 100: ${fund.percentage}`;
  }

  const sum = funds.reduce((s, f) => s + f.percentage, 0);
  if (Math.abs(sum - 100) > 0.01) {
    return `Fund percentages must sum to 100%, got ${sum}%`;
  }

  const ids = new Set(funds.map((f) => f.fundId));
  if (ids.size !== funds.length) return 'Duplicate fund IDs detected';

  return null;
}

/** BR-32: Financial records retention period in years. */
export const FINANCIAL_RETENTION_YEARS = 7;

/**
 * BR-32: Check if a financial record's creation date is within the retention period.
 * Records must be retained for at least 7 years.
 */
export function isWithinRetentionPeriod(createdAt: Date, now: Date = new Date()): boolean {
  const retentionEnd = new Date(createdAt);
  retentionEnd.setFullYear(retentionEnd.getFullYear() + FINANCIAL_RETENTION_YEARS);
  return now <= retentionEnd;
}

/**
 * Allocate a payment amount across funds using last-fund rounding (M6-R1).
 * The last fund in the array absorbs any rounding remainder so the sum
 * always equals the input amount exactly.
 */
export function allocateFunds(amountCents: number, funds: FundSplit[]): FundAllocationResult[] {
  if (funds.length === 0) return [];
  if (funds.length === 1) {
    return [{ fundId: funds[0]!.fundId, amount: amountCents }];
  }

  const results: FundAllocationResult[] = [];
  let allocated = 0;

  for (let i = 0; i < funds.length - 1; i++) {
    const fund = funds[i]!;
    const amount = Math.floor(amountCents * (fund.percentage / 100));
    results.push({ fundId: fund.fundId, amount });
    allocated += amount;
  }

  const lastFund = funds[funds.length - 1]!;
  results.push({ fundId: lastFund.fundId, amount: amountCents - allocated });

  return results;
}
