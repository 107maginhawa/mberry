import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DuesStatusCard } from './dues-status-card'

// Mock GlassCard to pass through
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

describe('DuesStatusCard', () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  test('renders Active status with correct badge', () => {
    renderWithProviders(
      <DuesStatusCard status="active" expiryDate={futureDate} />
    )

    expect(screen.getByText('Active')).toBeInTheDocument()
    const badge = screen.getByLabelText(/Membership status: Active/)
    expect(badge).toBeInTheDocument()
  })

  test('renders Overdue status with correct badge', () => {
    renderWithProviders(
      <DuesStatusCard status="overdue" expiryDate={pastDate} />
    )

    expect(screen.getByText('Overdue')).toBeInTheDocument()
    const badge = screen.getByLabelText(/Membership status: Overdue/)
    expect(badge).toBeInTheDocument()
  })

  test('shows days remaining when expiry in future', () => {
    renderWithProviders(
      <DuesStatusCard status="active" expiryDate={futureDate} />
    )

    expect(screen.getByRole('status')).toHaveTextContent(/\d+ days? remaining/)
  })

  test('shows days overdue when past expiry', () => {
    renderWithProviders(
      <DuesStatusCard status="overdue" expiryDate={pastDate} />
    )

    expect(screen.getByRole('status')).toHaveTextContent(/\d+ days? overdue/)
  })

  test('handles missing expiryDate gracefully', () => {
    renderWithProviders(
      <DuesStatusCard status="active" />
    )

    const noExpiryElements = screen.getAllByText('No expiry set')
    expect(noExpiryElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('status')).toHaveTextContent('No expiry set')
  })

  test('handles missing nextPaymentAmount', () => {
    renderWithProviders(
      <DuesStatusCard status="active" expiryDate={futureDate} />
    )

    expect(screen.getByText('No upcoming payment')).toBeInTheDocument()
  })

  test('shows Pay Now button when onPayNow provided', () => {
    const onPayNow = vi.fn()
    renderWithProviders(
      <DuesStatusCard status="active" expiryDate={futureDate} onPayNow={onPayNow} />
    )

    expect(screen.getByText('Pay Now')).toBeInTheDocument()
  })

  test('does not show Pay Now button when onPayNow not provided', () => {
    renderWithProviders(
      <DuesStatusCard status="active" expiryDate={futureDate} />
    )

    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument()
  })

  test('formats currency correctly for next payment', () => {
    renderWithProviders(
      <DuesStatusCard
        status="active"
        expiryDate={futureDate}
        nextPaymentAmount={150000}
        nextPaymentDueDate={futureDate}
        currency="PHP"
      />
    )

    expect(screen.getByText('₱1,500.00')).toBeInTheDocument()
  })
})
