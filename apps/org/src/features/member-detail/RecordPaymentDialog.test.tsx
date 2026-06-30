import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordPaymentDialog } from './RecordPaymentDialog'

const { toast, mutate } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  mutate: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('./use-member-detail', () => ({ useRecordPayment: () => ({ mutate, isPending: false }) }))

beforeEach(() => vi.clearAllMocks())

function openDialog() {
  render(<RecordPaymentDialog orgId="o1" personId="p1" memberName="Maria" />)
  fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
}

describe('RecordPaymentDialog', () => {
  it('blocks the review step until an amount is entered', () => {
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than ₱0/i)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('two-step confirm: review shows amount/method, submit records centavos (GCash)', () => {
    mutate.mockImplementation((_b, { onSuccess }) => onSuccess({}))
    openDialog()
    fireEvent.change(screen.getByLabelText('Amount (₱)'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'gcash' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    // Step 2 review: pesos shown formatted, method labelled
    expect(screen.getByText('Step 2 of 2 — confirm and record.')).toBeInTheDocument()
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    expect(screen.getByText('GCash')).toBeInTheDocument()

    // Submit (the footer button; the trigger shares the label)
    fireEvent.click(screen.getAllByRole('button', { name: /record payment/i }).at(-1)!)
    expect(mutate).toHaveBeenCalledWith(
      { amount: 250000, currency: 'PHP', paymentMethod: 'gcash', referenceNumber: undefined },
      expect.anything(),
    )
    expect(toast.success).toHaveBeenCalled()
  })
})
