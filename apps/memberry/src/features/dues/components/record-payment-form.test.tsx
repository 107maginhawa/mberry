import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { RecordPaymentForm } from './record-payment-form'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/hooks/use-mutation-feedback', () => ({
  useMutationFeedback: ({ mutationFn }: any) => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/components/patterns/combobox', () => ({
  Combobox: ({ value, onValueChange, placeholder, ...rest }: any) => (
    <input data-testid="combobox" value={value ?? ''} placeholder={placeholder} onChange={(e: any) => onValueChange?.(e.target.value)} {...rest} />
  ),
}))

vi.mock('@/components/patterns/date-picker', () => ({
  DatePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="date-picker" type="date" value={value ?? ''} onChange={(e: any) => onChange?.(e.target.value)} {...rest} />
  ),
}))

vi.mock('@/components/patterns/form-field', () => ({
  FormField: ({ label, children, error, description, required }: any) => (
    <div data-testid="form-field">
      <label>{label}{!required && description ? ' (optional)' : ''}</label>
      {children}
      {error && <span className="error">{error}</span>}
    </div>
  ),
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
