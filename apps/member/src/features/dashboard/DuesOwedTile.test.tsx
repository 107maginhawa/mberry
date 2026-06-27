import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('./use-member-data', () => ({
  useMemberData: vi.fn(),
}))

vi.mock('./use-pay-now', () => ({
  usePayNow: vi.fn(),
}))

import { useMemberData } from './use-member-data'
import { usePayNow } from './use-pay-now'
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

/** Default no-op mutation mock — used by existing tests that don't exercise pay-now */
function mockPayNow(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean; isSuccess: boolean }> = {}) {
  vi.mocked(usePayNow).mockReturnValue({
    mutate: overrides.mutate ?? vi.fn(),
    isPending: overrides.isPending ?? false,
    isSuccess: overrides.isSuccess ?? false,
  } as any)
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no-op mutation so existing tests don't need to configure it
  mockPayNow()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Existing tests (unchanged behavior) ─────────────────────────────────────

describe('DuesOwedTile', () => {
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

  it('shows footer "use the link your chapter sent you" when no outstanding invoices', () => {
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true, data: [] },
      outstandingInvoices: [],
    })
    render(<DuesOwedTile />)
    expect(screen.getByText(/link your chapter sent you/i)).toBeTruthy()
  })

  // ─── Pay-now tests ───────────────────────────────────────────────────────

  it('pay-now: renders "Pay now" button when outstanding invoices exist', () => {
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    expect(screen.getByRole('button', { name: /pay now/i })).toBeTruthy()
    // footer informational text replaced by button — should NOT be present
    expect(screen.queryByText(/link your chapter sent you/i)).toBeNull()
  })

  it('pay-now: no "Pay now" button when no outstanding invoices', () => {
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true, data: [] },
      outstandingInvoices: [],
    })
    render(<DuesOwedTile />)
    expect(screen.queryByRole('button', { name: /pay now/i })).toBeNull()
  })

  it('pay-now: click calls mutate with first invoice id', () => {
    const mutate = vi.fn()
    mockPayNow({ mutate })
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    expect(mutate).toHaveBeenCalledWith(
      { invoiceId: 'inv-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('pay-now: button disabled while isPending (double-tap guard)', () => {
    mockPayNow({ isPending: true })
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    expect(screen.getByRole('button', { name: /pay now/i })).toHaveProperty('disabled', true)
  })

  it('pay-now: onSuccess navigates to paymentUrl via window.location.href', () => {
    const locationMock = { href: '' }
    vi.stubGlobal('location', locationMock)

    let capturedOnSuccess: ((data: { paymentUrl: string }) => void) | undefined
    const mutate = vi.fn((_vars: unknown, opts: { onSuccess: (d: { paymentUrl: string }) => void }) => {
      capturedOnSuccess = opts.onSuccess
    })
    mockPayNow({ mutate })
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))

    // Simulate mutation success callback
    capturedOnSuccess!({ paymentUrl: '/pay/tok-abc' })
    expect(locationMock.href).toBe('/pay/tok-abc')
  })

  it('pay-now: onError shows role=alert with error message', () => {
    let capturedOnError: ((e: Error) => void) | undefined
    const mutate = vi.fn((_vars: unknown, opts: { onError: (e: Error) => void }) => {
      capturedOnError = opts.onError
    })
    mockPayNow({ mutate })
    mockData({
      invoicesQueryOverrides: { isLoading: false, isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'generated', periodEnd: null },
      ],
    })
    render(<DuesOwedTile />)
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))

    // Simulate mutation error callback — wrap in act() to flush React state update (setPayErr)
    act(() => {
      capturedOnError!(new Error('Could not start payment. Please try again.'))
    })
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('Could not start payment')
  })
})
