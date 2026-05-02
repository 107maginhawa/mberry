/**
 * Receipt number format: ORG_CODE-YEAR-NNNNNN (M6-R6)
 */
export function formatReceiptNumber(orgCode: string, year: number, sequence: number): string {
  return `${orgCode}-${year}-${sequence.toString().padStart(6, '0')}`;
}

export function parseReceiptNumber(receipt: string): { orgCode: string; year: number; sequence: number } | null {
  const match = receipt.match(/^([A-Z]+)-(\d{4})-(\d{6})$/);
  if (!match) return null;
  return {
    orgCode: match[1]!,
    year: parseInt(match[2]!, 10),
    sequence: parseInt(match[3]!, 10),
  };
}
