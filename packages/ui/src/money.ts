export function centavosToPhp(amount: number): string {
  return '₱' + (amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
