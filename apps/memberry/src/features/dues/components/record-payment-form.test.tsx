import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { RecordPaymentForm } from './record-payment-form'

vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  listDuesFundsOptions: vi.fn(() => ({
    queryKey: ['dues', 'funds'],
    queryFn: () => Promise.resolve({ data: [] }),
  })),
  listRosterMembersOptions: vi.fn(() => ({
    queryKey: ['roster', 'members'],
    queryFn: () => Promise.resolve({ data: [] }),
  })),
  recordDuesPaymentMutation: vi.fn(() => ({ mutationFn: vi.fn().mockResolvedValue({}) })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('./fund-allocation-preview', () => ({
  FundAllocationPreview: ({ amountCents }: any) => (
    <div data-testid="fund-preview">Preview: {amountCents}</div>
  ),
}))

describe('RecordPaymentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders form fields', () => {
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    expect(screen.getByText('Member')).toBeInTheDocument()
    expect(screen.getByText('Amount (PHP)')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Payment Method')).toBeInTheDocument()
    expect(screen.getByText('Reference Number (optional)')).toBeInTheDocument()
    expect(screen.getByText('Record Payment')).toBeInTheDocument()
  })

  test('shows fund allocation message when no amount entered', () => {
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    expect(screen.getByText('Enter an amount to see fund allocation.')).toBeInTheDocument()
  })

  test('Record Payment button is disabled when form is incomplete', () => {
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    const button = screen.getByText('Record Payment')
    expect(button).toBeDisabled()
  })

  test('renders member search input with placeholder', () => {
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    expect(screen.getByPlaceholderText('Search by name or license number...')).toBeInTheDocument()
  })
})
