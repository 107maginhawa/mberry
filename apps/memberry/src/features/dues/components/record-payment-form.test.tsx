import React from 'react'
import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { RecordPaymentForm } from './record-payment-form'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Capturing mock — module-level spy so payload tests can inspect it
const mutateSpy = vi.fn()

vi.mock('@/hooks/use-mutation-feedback', () => ({
  useMutationFeedback: (_opts: any) => ({
    mutate: mutateSpy,
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
  DatePicker: ({ value, onValueChange, ...rest }: any) => (
    <input
      data-testid="date-picker"
      type="date"
      value={value instanceof Date ? value.toISOString().split('T')[0] : (value ?? '')}
      onChange={(e: any) => {
        const d = e.target.value ? new Date(e.target.value) : undefined
        if (onValueChange) onValueChange(d)
      }}
      {...rest}
    />
  ),
}))

vi.mock('@/components/patterns/form-field', () => ({
  FormField: ({ label, children, error, description, required }: any) => (
    <div data-testid="form-field">
      <label>{label}{!required && description ? ' (optional)' : ''}</label>
      {children}
      {error && <span className="error">{typeof error === 'string' ? error : error?.message}</span>}
    </div>
  ),
}))

vi.mock('./fund-allocation-preview', () => ({
  FundAllocationPreview: ({ amountCents }: any) => (
    <div data-testid="fund-preview">Preview: {amountCents}</div>
  ),
}))

// Stub @monobase/ui: real Button/Label/Dialog are usable in happy-dom,
// but the Radix Select component requires JS-driven portals that don't work
// cleanly in happy-dom. Replace Select with a native <select> for test control.
// React is imported at the top of the file (avoids require() lint error).
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, type }: any) =>
    React.createElement('button', { onClick, disabled, type }, children),
  // eslint-disable-next-line react/display-name
  Input: React.forwardRef<HTMLInputElement, any>(function InputStub({ ...props }, ref) {
    return React.createElement('input', { ref, ...props })
  }),
  Label: ({ children }: any) => React.createElement('label', null, children),
  Dialog: ({ children, open }: any) => open ? React.createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children }: any) => React.createElement('div', null, children),
  DialogHeader: ({ children }: any) => React.createElement('div', null, children),
  DialogTitle: ({ children }: any) => React.createElement('h2', null, children),
  DialogFooter: ({ children }: any) => React.createElement('div', null, children),
  // Native select stub for Select family — lets tests use fireEvent.change / userEvent.selectOptions
  Select: ({ children, value, onValueChange }: any) =>
    React.createElement('div', null,
      React.createElement('select', {
        'data-testid': 'payment-method-select',
        value: value ?? '',
        onChange: (e: any) => onValueChange?.(e.target.value),
      }, children)),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => React.createElement(React.Fragment, null, children),
  SelectItem: ({ value, children }: any) => React.createElement('option', { value }, children),
}))

describe('RecordPaymentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateSpy.mockReset()
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

  test('submit button is disabled until member is selected', async () => {
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    // Without selecting a member, button stays disabled
    const button = screen.getByRole('button', { name: /record payment/i })
    expect(button).toBeDisabled()

    // Select a member via the combobox stub
    const combobox = screen.getByTestId('combobox')
    fireEvent.change(combobox, { target: { value: 'person-123' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record payment/i })).not.toBeDisabled()
    })
  })

  test('valid submission: confirm dialog appears and mutate called with correct payload', async () => {
    const user = userEvent.setup()
    mutateSpy.mockResolvedValue({})
    renderWithProviders(<RecordPaymentForm orgId="org-42" />)

    // Select a member
    const combobox = screen.getByTestId('combobox')
    fireEvent.change(combobox, { target: { value: 'person-999' } })

    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.00')
    await user.clear(amountInput)
    await user.type(amountInput, '500')

    // Set payment method via stubbed native select
    const methodSelect = screen.getByTestId('payment-method-select')
    await user.selectOptions(methodSelect, 'cash')

    // Verify the select has the expected value before submitting
    expect((methodSelect as HTMLSelectElement).value).toBe('cash')

    // Submit the form — use fireEvent.submit directly on the form element
    // (userEvent.click on submit button sometimes doesn't propagate form submit in happy-dom)
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    // Confirm dialog should appear (Dialog mock renders when open=true, has role="dialog")
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Click Confirm in the dialog
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledTimes(1)
    })

    const callArg = mutateSpy.mock.calls[0][0]
    // Payload shape: { body: { organizationId, personId, amount (integer cents), currency, paymentMethod, ... }, headers }
    expect(callArg.body.organizationId).toBe('org-42')
    expect(callArg.body.personId).toBe('person-999')
    // ISSUE-022: 500 PHP → 50000 cents as a plain integer (validator is
    // z.number().int(); BigInt would serialize to a string it rejects).
    expect(callArg.body.amount).toBe(50000)
    expect(callArg.body.currency).toBe('PHP')
    expect(callArg.body.paymentMethod).toBe('cash')
    expect(callArg.headers['x-org-id']).toBe('org-42')
  })

  test('zero amount: zod validation blocks submit — Confirm dialog does not open', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    // Select a member so button is enabled
    const combobox = screen.getByTestId('combobox')
    fireEvent.change(combobox, { target: { value: 'person-123' } })

    // Leave amount at 0 / empty (default is undefined, entering 0 should fail .positive())
    const amountInput = screen.getByPlaceholderText('0.00')
    await user.clear(amountInput)
    await user.type(amountInput, '0')

    // Set payment method so it's not the blocker
    const methodSelect = screen.getByTestId('payment-method-select')
    await user.selectOptions(methodSelect, 'cash')

    // Submit via form directly
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    // Zod .positive() rejects 0 — dialog must NOT appear
    // Give a short window for any async state updates
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // mutate must NOT have been called
    expect(mutateSpy).not.toHaveBeenCalled()
  })

  test('negative amount: zod validation blocks submit — mutate not called', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RecordPaymentForm orgId="org-1" />)

    // Select a member
    const combobox = screen.getByTestId('combobox')
    fireEvent.change(combobox, { target: { value: 'person-abc' } })

    // Enter negative amount
    const amountInput = screen.getByPlaceholderText('0.00')
    await user.clear(amountInput)
    await user.type(amountInput, '-100')

    const methodSelect = screen.getByTestId('payment-method-select')
    await user.selectOptions(methodSelect, 'cash')

    // Submit via form directly
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    // Zod .positive() rejects negative — dialog must NOT appear
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mutateSpy).not.toHaveBeenCalled()
  })
})
