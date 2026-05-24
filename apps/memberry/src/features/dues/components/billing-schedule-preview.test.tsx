import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BillingSchedulePreview } from './billing-schedule-preview'

// Mock GlassCard to pass through
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

describe('BillingSchedulePreview', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders dates list', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    render(
      <BillingSchedulePreview
        frequency="quarterly"
        cycleStartMonth={1}
        dueDateDay={15}
      />
    )

    expect(screen.getByText('Billing Schedule')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: /upcoming billing dates/i })
    const items = list.querySelectorAll('li')
    expect(items.length).toBeGreaterThanOrEqual(4)
  })

  test('shows amount when provided', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    render(
      <BillingSchedulePreview
        frequency="annual"
        cycleStartMonth={6}
        dueDateDay={15}
        amount={500000}
        currency="PHP"
      />
    )

    // formatCents(500000, 'PHP') -> '₱5,000.00' — shown for each date
    const amounts = screen.getAllByText('₱5,000.00')
    expect(amounts.length).toBeGreaterThanOrEqual(1)
  })

  test('does not show amount when zero', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    render(
      <BillingSchedulePreview
        frequency="annual"
        cycleStartMonth={6}
        dueDateDay={15}
        amount={0}
      />
    )

    // Should not render any amount text
    expect(screen.queryByText(/₱/)).not.toBeInTheDocument()
  })

  test('shows grace period note', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    render(
      <BillingSchedulePreview
        frequency="annual"
        cycleStartMonth={1}
        dueDateDay={1}
        gracePeriodDays={30}
      />
    )

    expect(screen.getByText('30-day grace period after each due date')).toBeInTheDocument()
  })

  test('hides grace period note when not provided', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    render(
      <BillingSchedulePreview
        frequency="annual"
        cycleStartMonth={1}
        dueDateDay={1}
      />
    )

    expect(screen.queryByText(/grace period/i)).not.toBeInTheDocument()
  })

  test('empty state when frequency is empty string', () => {
    render(
      <BillingSchedulePreview
        frequency={'' as any}
        cycleStartMonth={1}
        dueDateDay={1}
      />
    )

    expect(screen.getByText('Configure billing frequency to see schedule')).toBeInTheDocument()
  })
})
