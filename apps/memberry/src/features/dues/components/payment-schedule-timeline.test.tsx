import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PaymentScheduleTimeline } from './payment-schedule-timeline'

// Mock GlassCard to pass through
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

interface TimelinePeriod {
  id: string
  label: string
  amount: number
  dueDate: string
  status: 'paid' | 'overdue' | 'upcoming'
  paidDate?: string
}

const makePeriod = (overrides: Partial<TimelinePeriod> = {}): TimelinePeriod => ({
  id: overrides.id ?? 'p-1',
  label: overrides.label ?? '2025',
  amount: overrides.amount ?? 500_00,
  dueDate: overrides.dueDate ?? '2025-01-15',
  status: overrides.status ?? 'upcoming',
  paidDate: overrides.paidDate,
})

describe('PaymentScheduleTimeline', () => {
  test('[AC-T7-004] renders horizontal timeline with paid periods as green', () => {
    const periods: TimelinePeriod[] = [
      makePeriod({ id: '1', label: '2023', status: 'paid', paidDate: '2023-01-20' }),
      makePeriod({ id: '2', label: '2024', status: 'paid', paidDate: '2024-01-18' }),
    ]
    renderWithProviders(<PaymentScheduleTimeline periods={periods} currency="PHP" />)

    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    // Paid markers should have green indicator
    const paidMarkers = screen.getAllByTestId('timeline-marker-paid')
    expect(paidMarkers.length).toBe(2)
  })

  test('[AC-T7-004] renders overdue periods as red', () => {
    const periods: TimelinePeriod[] = [
      makePeriod({ id: '1', label: '2024', status: 'overdue' }),
    ]
    renderWithProviders(<PaymentScheduleTimeline periods={periods} currency="PHP" />)

    const overdueMarker = screen.getByTestId('timeline-marker-overdue')
    expect(overdueMarker).toBeInTheDocument()
  })

  test('[AC-T7-004] renders upcoming periods as gray', () => {
    const periods: TimelinePeriod[] = [
      makePeriod({ id: '1', label: '2026', status: 'upcoming' }),
    ]
    renderWithProviders(<PaymentScheduleTimeline periods={periods} currency="PHP" />)

    const upcomingMarker = screen.getByTestId('timeline-marker-upcoming')
    expect(upcomingMarker).toBeInTheDocument()
  })

  test('[AC-T7-004] shows mixed timeline with all statuses', () => {
    const periods: TimelinePeriod[] = [
      makePeriod({ id: '1', label: '2023', status: 'paid', paidDate: '2023-01-20' }),
      makePeriod({ id: '2', label: '2024', status: 'overdue' }),
      makePeriod({ id: '3', label: '2025', status: 'upcoming' }),
    ]
    renderWithProviders(<PaymentScheduleTimeline periods={periods} currency="PHP" />)

    expect(screen.getByTestId('timeline-marker-paid')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-marker-overdue')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-marker-upcoming')).toBeInTheDocument()
  })

  test('[AC-T7-004] displays amounts for each period', () => {
    const periods: TimelinePeriod[] = [
      makePeriod({ id: '1', label: '2025', amount: 750_00, status: 'upcoming' }),
    ]
    renderWithProviders(<PaymentScheduleTimeline periods={periods} currency="PHP" />)

    expect(screen.getByText('₱750.00')).toBeInTheDocument()
  })

  test('[AC-T7-005] shows empty state when no timeline data', () => {
    renderWithProviders(<PaymentScheduleTimeline periods={[]} currency="PHP" />)

    expect(screen.getByText(/no billing periods/i)).toBeInTheDocument()
  })
})
