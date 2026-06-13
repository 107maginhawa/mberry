/**
 * Receipt number format: ORG_CODE-YEAR-NNNNNN (M6-R6)
 */
export function formatReceiptNumber(orgCode: string, year: number, sequence: number): string {
  return `${orgCode}-${year}-${sequence.toString().padStart(6, '0')}`;
}

export function parseReceiptNumber(receipt: string): { orgCode: string; year: number; sequence: number } | null {
  const match = receipt.match(/^([A-Z0-9]+)-(\d{4})-(\d{6})$/);
  if (!match) return null;
  return {
    orgCode: match[1]!,
    year: parseInt(match[2]!, 10),
    sequence: parseInt(match[3]!, 10),
  };
}

/**
 * [FIX-003] Derive a stable, per-org receipt prefix from the organization slug.
 *
 * Replaces the previously hardcoded literal `'ORG'` prefix that caused
 * cross-org receipt-number collisions (org-A and org-B both produced
 * `ORG-YEAR-000001` for their first payment of the year, violating the global
 * receipt-number unique constraint).
 *
 * The prefix is uppercase-alphanumeric (matches the receipt format regex),
 * capped at 8 chars, and falls back to a safe default when the slug is empty.
 */
export function buildReceiptPrefix(orgSlug: string | null | undefined): string {
  const cleaned = (orgSlug ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  // Keep prefixes short but distinctive; 8 chars is plenty to disambiguate orgs
  // while staying well within the 50-char receipt_number column.
  const prefix = cleaned.slice(0, 8);
  return prefix.length > 0 ? prefix : 'ORG';
}
