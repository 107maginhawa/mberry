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
import { StandingHero } from './StandingHero'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuery(overrides: Record<string, unknown>) {
  return { isLoading: false, isError: false, isSuccess: false, data: undefined, ...overrides }
}

function mockData(overrides: {
  membershipsQueryOverrides?: Record<string, unknown>
  invoicesQueryOverrides?: Record<string, unknown>
  outstandingInvoices?: unknown[]
}) {
  vi.mocked(useMemberData).mockReturnValue({
    membershipsQuery: makeQuery(overrides.membershipsQueryOverrides ?? {}) as any,
    invoicesQuery: makeQuery(overrides.invoicesQueryOverrides ?? {}) as any,
    paymentsQuery: makeQuery({}) as any,
    outstandingInvoices: (overrides.outstandingInvoices ?? []) as any,
  })
}

function mockPayNow(
  overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean; isSuccess: boolean }> = {},
) {
  vi.mocked(usePayNow).mockReturnValue({
    mutate: overrides.mutate ?? vi.fn(),
    isPending: overrides.isPending ?? false,
    isSuccess: overrides.isSuccess ?? false,
  } as any)
}

const ACTIVE_MEMBERSHIP = {
  id: 'm-1',
  orgName: 'Olive Dental Chapter',
  status: 'active',
  duesExpiryDate: '2027-01-01',
}

const OUTSTANDING = [
  { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 150000n, currency: 'PHP', status: 'sent', periodEnd: null },
]

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPayNow()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StandingHero', () => {
  it('loading: shows skeleton while membership loads', () => {
    mockData({ membershipsQueryOverrides: { isLoading: true } })
    render(<StandingHero />)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('loading: shows skeleton while invoices load', () => {
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isLoading: true },
    })
    render(<StandingHero />)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('error: shows role=alert when membership fails', () => {
    mockData({ membershipsQueryOverrides: { isError: true } })
    render(<StandingHero />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('renders the chapter name as a heading', () => {
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: [],
    })
    render(<StandingHero />)
    expect(screen.getByRole('heading', { name: /Olive Dental Chapter/ })).toBeTruthy()
  })

  // ─── Dues-owed poster ─────────────────────────────────────────────────────

  it('dues owed: shows big tabular amount + outstanding count', () => {
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: OUTSTANDING,
    })
    render(<StandingHero />)
    const amount = screen.getByText(/1,500/)
    expect(amount).toBeTruthy()
    // money reads at a glance — tabular figures (the GCash lesson)
    expect(amount.className).toContain('tabular-amount')
    expect(screen.getByText(/1 outstanding invoice/)).toBeTruthy()
  })

  it('dues owed: with multiple invoices, the big amount is the FIRST invoice (what gets charged), with the total shown as context', () => {
    // Honesty fix: mintMyPaymentLink charges ONE invoice. The focal amount must
    // equal what the Pay button charges (the first/oldest invoice), NOT the sum —
    // otherwise the charge won't match the displayed number (trust damage).
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', totalAmount: 150000n, status: 'generated' },
        { id: 'inv-2', totalAmount: 50000n, status: 'overdue' },
      ],
    })
    render(<StandingHero />)
    // Focal amount = first invoice (₱1,500), tabular
    const amount = screen.getByText('₱1,500.00')
    expect(amount.className).toContain('tabular-amount')
    // Total outstanding (₱2,000) shown as secondary context, and the count
    expect(screen.getByText(/2,000/)).toBeTruthy()
    expect(screen.getByText(/2 invoices/)).toBeTruthy()
  })

  it('dues owed: with multiple invoices, the Pay button charges the FIRST invoice (matches the focal amount)', () => {
    const mutate = vi.fn()
    mockPayNow({ mutate })
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: [
        { id: 'inv-1', totalAmount: 150000n, status: 'generated' },
        { id: 'inv-2', totalAmount: 50000n, status: 'overdue' },
      ],
    })
    render(<StandingHero />)
    fireEvent.click(screen.getByRole('button', { name: /pay dues/i }))
    expect(mutate).toHaveBeenCalledWith(
      { invoiceId: 'inv-1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('dues owed: renders the primary Pay dues button', () => {
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: OUTSTANDING,
    })
    render(<StandingHero />)
    expect(screen.getByRole('button', { name: /pay dues/i })).toBeTruthy()
  })

  it('dues owed: click mints pay-link for first invoice (behavior preserved)', () => {
    const mutate = vi.fn()
    mockPayNow({ mutate })
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: OUTSTANDING,
    })
    render(<StandingHero />)
    fireEvent.click(screen.getByRole('button', { name: /pay dues/i }))
    expect(mutate).toHaveBeenCalledWith(
      { invoiceId: 'inv-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('dues owed: button disabled while pending (double-tap guard)', () => {
    mockPayNow({ isPending: true })
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: OUTSTANDING,
    })
    render(<StandingHero />)
    expect(screen.getByRole('button', { name: /pay dues/i })).toHaveProperty('disabled', true)
  })

  it('dues owed: onSuccess navigates to paymentUrl', () => {
    const locationMock = { href: '' }
    vi.stubGlobal('location', locationMock)
    let capturedOnSuccess: ((d: { paymentUrl: string }) => void) | undefined
    const mutate = vi.fn((_v: unknown, opts: { onSuccess: (d: { paymentUrl: string }) => void }) => {
      capturedOnSuccess = opts.onSuccess
    })
    mockPayNow({ mutate })
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: OUTSTANDING,
    })
    render(<StandingHero />)
    fireEvent.click(screen.getByRole('button', { name: /pay dues/i }))
    capturedOnSuccess!({ paymentUrl: '/pay/tok-abc' })
    expect(locationMock.href).toBe('/pay/tok-abc')
  })

  it('dues owed: onError shows role=alert', () => {
    let capturedOnError: ((e: Error) => void) | undefined
    const mutate = vi.fn((_v: unknown, opts: { onError: (e: Error) => void }) => {
      capturedOnError = opts.onError
    })
    mockPayNow({ mutate })
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: OUTSTANDING,
    })
    render(<StandingHero />)
    fireEvent.click(screen.getByRole('button', { name: /pay dues/i }))
    act(() => {
      capturedOnError!(new Error('Could not start payment. Please try again.'))
    })
    expect(screen.getByRole('alert').textContent).toContain('Could not start payment')
  })

  // ─── Good-standing poster ─────────────────────────────────────────────────

  it('all paid + active: shows good-standing message, status badge, no pay button', () => {
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: [],
    })
    render(<StandingHero />)
    expect(screen.getByText(/good standing/i)).toBeTruthy()
    expect(screen.getByTestId('status-badge')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /pay dues/i })).toBeNull()
  })

  it('all paid: shows renewal date when present', () => {
    mockData({
      membershipsQueryOverrides: { isSuccess: true, data: [ACTIVE_MEMBERSHIP] },
      invoicesQueryOverrides: { isSuccess: true },
      outstandingInvoices: [],
    })
    render(<StandingHero />)
    expect(screen.getByText(/Renews/)).toBeTruthy()
  })
})
