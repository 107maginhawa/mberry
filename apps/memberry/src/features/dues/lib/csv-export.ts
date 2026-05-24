/**
 * Export payment data as CSV file download.
 */
export interface PaymentRow {
  receiptNumber?: string
  amount?: number
  currency?: string
  status?: string
  paidAt?: string
}

export function buildPaymentCsv(payments: PaymentRow[]): string {
  const header = 'Receipt Number,Amount,Currency,Status,Date\n'
  const rows = payments
    .map((p) => {
      const amt = (Number(p.amount ?? 0) / 100).toFixed(2)
      const date = p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ''
      return `${p.receiptNumber ?? ''},${amt},${p.currency ?? 'PHP'},${p.status ?? ''},${date}`
    })
    .join('\n')
  return header + rows
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
