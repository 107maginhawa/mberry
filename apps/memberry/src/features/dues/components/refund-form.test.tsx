import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { RefundForm } from './refund-form'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('RefundForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders collapsed Refund button initially', () => {
    renderWithProviders(
      <RefundForm paymentId="pay-1" maxAmount={50000} currency="PHP" />
    )
    expect(screen.getByText('Refund')).toBeInTheDocument()
    expect(screen.queryByText('Initiate Refund')).not.toBeInTheDocument()
  })

  test('expands form when Refund button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundForm paymentId="pay-1" maxAmount={50000} currency="PHP" />
    )

    await user.click(screen.getByText('Refund'))

    // h4 heading "Initiate Refund" and button "Initiate Refund" both present
    expect(screen.getAllByText('Initiate Refund')).toHaveLength(2)
    expect(screen.getByText('Amount (PHP)')).toBeInTheDocument()
    expect(screen.getByText('Reason (required)')).toBeInTheDocument()
  })

  test('shows validation error when amount exceeds max', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundForm paymentId="pay-1" maxAmount={10000} currency="PHP" />
    )

    await user.click(screen.getByText('Refund'))

    const amountInput = screen.getByDisplayValue('100.00')
    await user.clear(amountInput)
    await user.type(amountInput, '200')

    await waitFor(() => {
      expect(screen.getByText(/Refund cannot exceed/)).toBeInTheDocument()
    })
  })

  test('collapses form when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundForm paymentId="pay-1" maxAmount={50000} currency="PHP" />
    )

    await user.click(screen.getByText('Refund'))
    expect(screen.getAllByText('Initiate Refund').length).toBeGreaterThan(0)

    await user.click(screen.getByText('Cancel'))
    expect(screen.queryAllByText('Initiate Refund')).toHaveLength(0)
  })
})
