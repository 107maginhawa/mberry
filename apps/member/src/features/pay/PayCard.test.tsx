import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PayCard } from './PayCard'

const FIELDS = {
  amount: 150000,
  currency: 'PHP',
  orgName: 'Olive Dental Chapter',
  memberName: 'Dr. Olive',
  dueDate: '2026-12-31',
}

const payable = { kind: 'payable' as const, ...FIELDS }
const cancelled = { kind: 'cancelled' as const, ...FIELDS }

describe('PayCard', () => {
  it('payable: shows the amount and a "Pay now" button, no cancelled banner', () => {
    render(<PayCard state={payable} paying={false} onPay={vi.fn()} />)
    expect(screen.getByText('₱1,500.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: /pay now/i })).toBeTruthy()
    expect(screen.queryByText(/cancelled/i)).toBeNull()
  })

  it('cancelled: shows a "Payment cancelled" banner so the member knows it was not a glitch', () => {
    render(<PayCard state={cancelled} paying={false} onPay={vi.fn()} />)
    expect(screen.getByText(/payment cancelled/i)).toBeTruthy()
  })

  it('cancelled: the primary button reads "Try payment again" and still calls onPay', () => {
    const onPay = vi.fn()
    render(<PayCard state={cancelled} paying={false} onPay={onPay} />)
    const btn = screen.getByRole('button', { name: /try payment again/i })
    fireEvent.click(btn)
    expect(onPay).toHaveBeenCalledTimes(1)
  })

  it('cancelled with empty fields: shows neutral loading skeleton, not "₱0.00"', () => {
    render(
      <PayCard
        state={{ kind: 'cancelled', amount: 0, currency: '', orgName: '', memberName: '', dueDate: '' }}
        paying={false}
        onPay={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText(/cancelled/i)).toBeNull()
  })
})
