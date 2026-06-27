import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./use-member-data', () => ({
  useMemberData: vi.fn(),
}))

import { useMemberData } from './use-member-data'
import { ReceiptsTile } from './ReceiptsTile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuery(overrides: Record<string, unknown>) {
  return { isLoading: false, isError: false, isSuccess: false, data: undefined, ...overrides }
}

function mockData(paymentsQueryOverrides: Record<string, unknown>) {
  vi.mocked(useMemberData).mockReturnValue({
    membershipsQuery: makeQuery({}) as any,
    invoicesQuery: makeQuery({}) as any,
    paymentsQuery: makeQuery(paymentsQueryOverrides) as any,
    outstandingInvoices: [],
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReceiptsTile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loading: shows skeletons', () => {
    mockData({ isLoading: true })
    render(<ReceiptsTile />)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('error: shows role=alert error message', () => {
    mockData({ isLoading: false, isError: true })
    render(<ReceiptsTile />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/could not load your payment history/i)).toBeTruthy()
  })

  it('empty: shows "No payments yet." when data is empty', () => {
    mockData({ isLoading: false, isSuccess: true, data: [] })
    render(<ReceiptsTile />)
    expect(screen.getByText('No payments yet.')).toBeTruthy()
  })

  it('data: shows receiptNumber, ₱ amount (Number coercion), Paid label, status', () => {
    // amount is bigint via transformer — Number(bigint) coerces; centavosToPhp(150000) = ₱1,500.00
    mockData({
      isLoading: false,
      isSuccess: true,
      data: [
        {
          id: 'pay-1',
          receiptNumber: 'REC-2025-001',
          amount: 150000n, // bigint via transformer; Number() at display → ₱1,500.00
          refundedAmount: 0n,
          currency: 'PHP',
          status: 'confirmed',
          paidAt: '2025-01-15T10:00:00.000Z',
        },
      ],
    })
    render(<ReceiptsTile />)
    expect(screen.getByText('REC-2025-001')).toBeTruthy()
    // centavosToPhp(Number(150000n)) = centavosToPhp(150000) = ₱1,500.00
    expect(screen.getByText(/₱/)).toBeTruthy()
    expect(screen.getByText(/1,500/)).toBeTruthy()
    // "Paid" label present
    expect(screen.getByText(/paid/i)).toBeTruthy()
    // status displayed
    expect(screen.getByText(/confirmed/i)).toBeTruthy()
  })

  it('data: Number(amount) money coercion — 150000 centavos → ₱1,500.00', () => {
    mockData({
      isLoading: false,
      isSuccess: true,
      data: [
        {
          id: 'pay-2',
          receiptNumber: 'REC-2025-002',
          amount: 150000n, // asserting Number coercion: Number(150000n) = 150000; / 100 = 1500
          refundedAmount: 0n,
          currency: 'PHP',
          status: 'confirmed',
          paidAt: null,
        },
      ],
    })
    render(<ReceiptsTile />)
    // centavosToPhp(150000) renders ₱1,500.00
    const amountEl = screen.getByText(/1,500/)
    expect(amountEl.textContent).toMatch(/₱1,500/)
  })

  it('data: multiple payments listed as separate items', () => {
    mockData({
      isLoading: false,
      isSuccess: true,
      data: [
        { id: 'pay-1', receiptNumber: 'REC-001', amount: 100000n, refundedAmount: 0n, currency: 'PHP', status: 'confirmed', paidAt: '2025-01-01T00:00:00.000Z' },
        { id: 'pay-2', receiptNumber: 'REC-002', amount: 200000n, refundedAmount: 0n, currency: 'PHP', status: 'confirmed', paidAt: '2025-02-01T00:00:00.000Z' },
      ],
    })
    render(<ReceiptsTile />)
    expect(screen.getByText('REC-001')).toBeTruthy()
    expect(screen.getByText('REC-002')).toBeTruthy()
  })

  it('data: paidAt null shows dash', () => {
    mockData({
      isLoading: false,
      isSuccess: true,
      data: [
        { id: 'pay-1', receiptNumber: null, amount: 50000n, refundedAmount: 0n, currency: 'PHP', status: 'pending', paidAt: null },
      ],
    })
    render(<ReceiptsTile />)
    // null paidAt → '—'
    expect(screen.getByText('—')).toBeTruthy()
  })
})
