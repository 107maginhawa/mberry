/**
 * Money formatting and validation utilities.
 *
 * All monetary amounts are stored as integer cents/centavos (int64).
 * These utilities handle display formatting and input parsing.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
};

/**
 * Format an integer amount in cents to a display string.
 * Example: formatCents(10050, 'PHP') → '₱100.50'
 */
export function formatCents(cents: number | bigint, currency: string = 'PHP'): string {
  const n = Number(cents);
  const isNegative = n < 0;
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';

  const formatted = whole.toLocaleString('en-US');
  const result = `${symbol}${formatted}.${frac.toString().padStart(2, '0')}`;

  return isNegative ? `-${result}` : result;
}

/**
 * Parse a decimal string input to integer cents.
 * Example: parseCentsInput('100.50') → 10050
 */
export function parseCentsInput(input: string): number {
  const num = parseFloat(input);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

interface FundAllocation {
  fundName: string;
  percentage: number;
}

/**
 * Validate that fund allocation percentages sum to exactly 100.
 */
export function validateFundAllocations(allocations: FundAllocation[]): { valid: boolean; sum: number } {
  const sum = allocations.reduce((s, a) => s + a.percentage, 0);
  return { valid: sum === 100, sum };
}
