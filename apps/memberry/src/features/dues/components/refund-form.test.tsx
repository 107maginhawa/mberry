import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Access the global stub for refundDuesPaymentMutation.
// test-setup-root.ts registers @monobase/sdk-ts/generated/react-query as a
// global mock (all exports are jest.fn() returning the sdk pattern shape).
// We import it here so we can override what refundDuesPaymentMutation() returns,
// enabling payload capture via a spy on the mutationFn it injects into useMutation.
import * as sdkMod from '@monobase/sdk-ts/generated/react-query'
import { RefundForm } from './refund-form'

const refundDuesPaymentMutationStub = (sdkMod as any).refundDuesPaymentMutation as ReturnType<typeof vi.fn>

// Spy on the mutationFn that useMutation receives from refundDuesPaymentMutation().
// We configure refundDuesPaymentMutationStub to return { mutationFn: captureSpy }.
// TanStack useMutation then calls captureSpy(args) when mutate(args) is invoked.
const captureSpy = vi.fn().mockResolvedValue({})

describe('RefundForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captureSpy.mockReset()
    captureSpy.mockResolvedValue({})
    // Override the global stub so this component's useMutation gets our captureSpy
    refundDuesPaymentMutationStub.mockReturnValue({ mutationFn: captureSpy })
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

  test('over-max amount: Initiate Refund button is disabled (amountError blocks)', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundForm paymentId="pay-1" maxAmount={10000} currency="PHP" />
    )

    await user.click(screen.getByText('Refund'))

    // Enter amount exceeding max (100.00 max, enter 200)
    const amountInput = screen.getByDisplayValue('100.00')
    await user.clear(amountInput)
    await user.type(amountInput, '200')

    // Enter reason so only amountError blocks the button
    const reasonInput = screen.getByPlaceholderText('Reason for refund...')
    await user.type(reasonInput, 'Test reason')

    await waitFor(() => {
      expect(screen.getByText(/Refund cannot exceed/)).toBeInTheDocument()
    })

    // Button is disabled when amountError is present
    expect(screen.getByRole('button', { name: /initiate refund/i })).toBeDisabled()
    // captureSpy (mutationFn) must NOT have been called
    expect(captureSpy).not.toHaveBeenCalled()
  })

  test('valid refund: mutationFn called once with correct payload (path + body)', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundForm paymentId="pay-xyz" maxAmount={50000} currency="PHP" />
    )

    // Expand form
    await user.click(screen.getByText('Refund'))

    // Default amount is maxAmount (500.00). Change to 250.
    const amountInput = screen.getByDisplayValue('500.00')
    await user.clear(amountInput)
    await user.type(amountInput, '250')

    // Enter a reason (required)
    const reasonInput = screen.getByPlaceholderText('Reason for refund...')
    await user.type(reasonInput, 'Membership cancelled')

    // "Initiate Refund" button must be enabled
    const initiateBtn = screen.getByRole('button', { name: /initiate refund/i })
    await waitFor(() => expect(initiateBtn).not.toBeDisabled())

    // Click Initiate Refund — shows the confirm dialog
    await user.click(initiateBtn)

    // Confirm dialog should appear — wait for Confirm Refund button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm refund/i })).toBeInTheDocument()
    })

    // Click "Confirm Refund" — triggers refundMutation.mutate(...)
    // Use fireEvent to avoid Radix pointer-events lock in happy-dom
    const confirmBtn = screen.getByRole('button', { name: /confirm refund/i })
    fireEvent.click(confirmBtn)

    // TanStack useMutation calls mutationFn asynchronously; wait for the call
    await waitFor(() => {
      expect(captureSpy).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })

    const callArg = captureSpy.mock.calls[0][0]
    // Payload shape: { path: { paymentId }, body: { amount: BigInt(cents), reason } }
    expect(callArg.path.paymentId).toBe('pay-xyz')
    // 250 PHP → 25000 cents as BigInt
    expect(callArg.body.amount).toBe(BigInt(25000))
    expect(callArg.body.reason).toBe('Membership cancelled')
  })

  test('zero amount: Initiate Refund button disabled (amountCents <= 0 blocks)', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RefundForm paymentId="pay-1" maxAmount={50000} currency="PHP" />
    )

    await user.click(screen.getByText('Refund'))

    const amountInput = screen.getByDisplayValue('500.00')
    await user.clear(amountInput)
    await user.type(amountInput, '0')

    // Enter reason to isolate the amount gate
    const reasonInput = screen.getByPlaceholderText('Reason for refund...')
    await user.type(reasonInput, 'Test reason')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /initiate refund/i })).toBeDisabled()
    })

    expect(captureSpy).not.toHaveBeenCalled()
  })
})
