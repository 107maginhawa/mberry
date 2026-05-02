export interface FundSplit {
  fundId: string;
  percentage: number;
}

export interface FundAllocationResult {
  fundId: string;
  amount: number;
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
