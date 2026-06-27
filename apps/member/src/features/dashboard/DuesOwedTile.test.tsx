import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./use-member-data', () => ({
  useMemberData: vi.fn(),
}))

import { useMemberData } from './use-member-data'
import { DuesOwedTile } from './DuesOwedTile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuery(overrides: Record<string, unknown>) {
  return { isLoading: false, isError: false, isSuccess: false, data: undefined, ...overrides }
}

function mockData(overrides: { invoicesQueryOverrides?: Record<string, unknown>; outstandingInvoices?: unknown[] }) {
  vi.mocked(useMemberData).mockReturnValue({
    membershipsQuery: makeQuery({}) as any,
    invoicesQuery: makeQuery(overrides.invoicesQueryOverrides ?? {}) as any,
    paymentsQuery: makeQuery({}) as any,
    outstandingInvoices: (overrides.outstandingInvoices ?? []) as any,
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DuesOwedTile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loading: shows skeleton', () => {
    mockData({ invoicesQueryOverrides: { isLoading: true } })
    render(<DuesOwedTile />)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('error: shows role=alert error message', () => {
    mockData({ invoicesQueryOverrides: { isLoading: false, isError: true } })
    render(<DuesOwedTile />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/could not load your dues/i)).toBeTruthy()
  })

  it('empty: shows "You\'re all paid up." when no outstanding invoices', () => {
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true, data: [] },
      outstandingInvoices: [],
    })
    render(<DuesOwedTile />)
    expect(screen.getByText("You're all paid up.")).toBeTruthy()
  })

  it('data: sums outstanding totalAmount and shows ₱ formatted amount', () => {
    // totalAmount is bigint via transformer — Number() converts it at display
    // 150000 centavos = ₱1,500.00 (centavosToPhp divides by 100)
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    expect(screen.getByText(/₱/)).toBeTruthy()
    expect(screen.getByText(/1,500/)).toBeTruthy()
    expect(screen.getByText(/1 outstanding invoice/)).toBeTruthy()
  })

  it('data: sums multiple outstanding invoices correctly', () => {
    // Two invoices: 150000n + 50000n = 200000 centavos = ₱2,000.00
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
        { id: 'inv-2', invoiceNumber: 'INV-002', totalAmount: 50000n, currency: 'PHP', status: 'overdue', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    expect(screen.getByText(/2,000/)).toBeTruthy()
    expect(screen.getByText(/2 outstanding invoices/)).toBeTruthy()
  })

  it('shows footer "use the link your chapter sent you"', () => {
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true, data: [] },
      outstandingInvoices: [],
    })
    render(<DuesOwedTile />)
    expect(screen.getByText(/link your chapter sent you/i)).toBeTruthy()
  })
})
