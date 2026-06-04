import { describe, test, expect } from 'bun:test'
import { buildPaymentCsv } from './csv-export'

describe('buildPaymentCsv', () => {
  test('[AC-T7-006] generates CSV header', () => {
    const csv = buildPaymentCsv([])
    expect(csv).toBe('Receipt Number,Amount,Currency,Status,Date\n')
  })

  test('[AC-T7-006] generates CSV rows with payment data', () => {
    const csv = buildPaymentCsv([
      {
        receiptNumber: 'REC-001',
        amount: 500_00,
        currency: 'PHP',
        status: 'confirmed',
        paidAt: '2025-03-15T00:00:00.000Z',
      },
    ])
    expect(csv).toContain('REC-001')
    expect(csv).toContain('500.00')
    expect(csv).toContain('PHP')
    expect(csv).toContain('confirmed')
  })

  test('[AC-T7-006] handles missing fields gracefully', () => {
    const csv = buildPaymentCsv([{}])
    const lines = csv.split('\n')
    expect(lines.length).toBe(2) // header + 1 row
    expect(lines[1]).toContain('0.00')
    expect(lines[1]).toContain('PHP') // default currency
  })

  test('[AC-T7-006] handles multiple payments', () => {
    const csv = buildPaymentCsv([
      { receiptNumber: 'R1', amount: 100_00, status: 'confirmed' },
      { receiptNumber: 'R2', amount: 200_00, status: 'submitted' },
    ])
    const lines = csv.split('\n')
    expect(lines.length).toBe(3) // header + 2 rows
    expect(lines[1]).toContain('R1')
    expect(lines[2]).toContain('R2')
  })
})
