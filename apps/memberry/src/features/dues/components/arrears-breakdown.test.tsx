import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ArrearsBreakdown } from './arrears-breakdown'

// Mock formatCents
vi.mock('@/features/dues/lib/money', () => ({
  formatCents: (amount: number, currency: string) => {
    const symbol = currency === 'PHP' ? '₱' : currency === 'USD' ? '$' : `${currency} `
    return `${symbol}${(amount / 100).toFixed(2)}`
  },
}))

// Mock GlassCard to pass through
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

const makeInvoice = (overrides: Partial<{
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
  periodStart: string
  periodEnd: string
  dueDate: string
  currency: string
}> = {}) => ({
  id: overrides.id ?? 'inv-1',
  invoiceNumber: overrides.invoiceNumber ?? 'INV-2025-001',
  totalAmount: overrides.totalAmount ?? 500_00,
  status: overrides.status ?? 'overdue',
  periodStart: overrides.periodStart ?? '2025-01-01',
  periodEnd: overrides.periodEnd ?? '2025-12-31',
  dueDate: overrides.dueDate ?? '2025-01-15',
  currency: overrides.currency ?? 'PHP',
})

describe('ArrearsBreakdown', () => {
  test('[AC-T7-002] groups unpaid invoices by year', () => {
    const invoices = [
      makeInvoice({ id: '1', periodStart: '2025-01-01', periodEnd: '2025-12-31' }),
      makeInvoice({ id: '2', periodStart: '2024-01-01', periodEnd: '2024-12-31' }),
      makeInvoice({ id: '3', periodStart: '2025-06-01', periodEnd: '2025-06-30' }),
    ]
    renderWithProviders(<ArrearsBreakdown invoices={invoices} currency="PHP" />)

    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
  })

  test('[AC-T7-002] shows days overdue per invoice', () => {
    const pastDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const invoices = [
      makeInvoice({ id: '1', dueDate: pastDate }),
    ]
    renderWithProviders(<ArrearsBreakdown invoices={invoices} currency="PHP" />)

    // Should show "X days overdue" text
    expect(screen.getByText(/\d+ days? overdue/)).toBeInTheDocument()
  })

  test('[AC-T7-002] shows aging bucket totals', () => {
    const agingBuckets = {
      current: 100_00,
      thirtyDay: 200_00,
      sixtyDay: 300_00,
      ninetyDay: 400_00,
      overNinety: 500_00,
      totalOutstanding: 1500_00,
    }
    renderWithProviders(
      <ArrearsBreakdown invoices={[makeInvoice()]} currency="PHP" agingBuckets={agingBuckets} />
    )

    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('30 days')).toBeInTheDocument()
    expect(screen.getByText('60 days')).toBeInTheDocument()
    expect(screen.getByText('90 days')).toBeInTheDocument()
    expect(screen.getByText('90+ days')).toBeInTheDocument()
  })

  test('[AC-T7-003] renders aging bucket amounts from server data', () => {
    const agingBuckets = {
      current: 100_00,
      thirtyDay: 200_00,
      sixtyDay: 0,
      ninetyDay: 0,
      overNinety: 500_00,
      totalOutstanding: 800_00,
    }
    renderWithProviders(
      <ArrearsBreakdown invoices={[makeInvoice()]} currency="PHP" agingBuckets={agingBuckets} />
    )

    // Verify amounts are rendered (mocked formatCents divides by 100)
    expect(screen.getByText('₱100.00')).toBeInTheDocument() // current = 100_00 cents
    expect(screen.getByText('₱200.00')).toBeInTheDocument() // thirtyDay = 200_00 cents
    // overNinety = 500_00 matches invoice totalAmount (500_00), so multiple elements
    expect(screen.getAllByText('₱500.00').length).toBeGreaterThanOrEqual(1)
  })

  test('[AC-T7-005] shows "All caught up!" when no unpaid invoices', () => {
    renderWithProviders(<ArrearsBreakdown invoices={[]} currency="PHP" />)

    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })

  test('[AC-T7-002] displays invoice numbers', () => {
    const invoices = [
      makeInvoice({ id: '1', invoiceNumber: 'INV-2025-042' }),
    ]
    renderWithProviders(<ArrearsBreakdown invoices={invoices} currency="PHP" />)

    expect(screen.getByText('INV-2025-042')).toBeInTheDocument()
  })

  test('[AC-T7-002] displays invoice amounts', () => {
    const invoices = [
      makeInvoice({ id: '1', totalAmount: 750_00 }),
    ]
    renderWithProviders(<ArrearsBreakdown invoices={invoices} currency="PHP" />)

    expect(screen.getByText('₱750.00')).toBeInTheDocument()
  })
})
