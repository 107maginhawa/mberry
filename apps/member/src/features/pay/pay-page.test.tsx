import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Hoisted by Vitest — intercepts usePayLink for all imports in this file.
vi.mock('./use-pay-link', () => ({ usePayLink: vi.fn() }))
import { usePayLink } from './use-pay-link'

import { PayCard } from './PayCard'
import { PayResult } from './PayResult'
import type { PayState } from './use-pay-link'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PAYABLE: Extract<PayState, { kind: 'payable' }> = {
  kind: 'payable',
  amount: 250000,
  currency: 'PHP',
  orgName: 'PDA Manila',
  memberName: 'Olive Cruz',
  dueDate: '2026-07-01T00:00:00.000Z',
}

const CANCELLED_EMPTY: Extract<PayState, { kind: 'cancelled' }> = {
  kind: 'cancelled',
  amount: 0,
  currency: '',
  orgName: '',
  memberName: '',
  dueDate: '',
}

// Thin test harness that mirrors the route component logic — driven by the
// mocked hook so we can verify each state renders the right subtree.
function TestPayPage({ token = 'tok' }: { token?: string } = {}) {
  const { state, pay } = (usePayLink as ReturnType<typeof vi.fn>)(token)
  if (state.kind === 'loading' || state.kind === 'paying') {
    return <div role="status" aria-label="Loading payment details" />
  }
  if (state.kind === 'payable' || state.kind === 'cancelled') {
    return <PayCard state={state} paying={false} onPay={pay} />
  }
  const resultState = state as Extract<
    PayState,
    { kind: 'succeeded' | 'alreadyPaid' | 'expired' | 'invalid' | 'notConfigured' | 'temporaryError' }
  >
  return (
    <PayResult
      state={resultState}
      onRetry={state.kind === 'temporaryError' ? pay : undefined}
    />
  )
}

beforeEach(() => vi.clearAllMocks())

// ── PayCard (payable / cancelled) ──────────────────────────────────────────────

describe('PayCard', () => {
  it('payable → ₱2,500.00 visible, Pay now button enabled', () => {
    render(<PayCard state={PAYABLE} paying={false} onPay={vi.fn()} />)
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /pay now/i })
    expect(btn).toBeEnabled()
  })

  it('clicking Pay now calls onPay', () => {
    const onPay = vi.fn()
    render(<PayCard state={PAYABLE} paying={false} onPay={onPay} />)
    fireEvent.click(screen.getByRole('button', { name: /pay now/i }))
    expect(onPay).toHaveBeenCalledOnce()
  })

  it('cancelled with empty fields → no misleading ₱0.00, shows loading affordance', () => {
    render(<PayCard state={CANCELLED_EMPTY} paying={false} onPay={vi.fn()} />)
    expect(screen.queryByText('₱0.00')).not.toBeInTheDocument()
    // neutral skeleton while validate is still resolving
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

// ── Loading state via mocked hook ──────────────────────────────────────────────

it('loading state → loading affordance visible', () => {
  ;(usePayLink as ReturnType<typeof vi.fn>).mockReturnValue({
    state: { kind: 'loading' },
    pay: vi.fn(),
  })
  render(<TestPayPage />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})

// ── PayResult (all terminal states) ───────────────────────────────────────────

describe('PayResult', () => {
  it('succeeded → success copy', () => {
    render(<PayResult state={{ kind: 'succeeded' }} />)
    expect(screen.getByText(/payment successful/i)).toBeInTheDocument()
  })

  it('alreadyPaid → already paid copy', () => {
    render(<PayResult state={{ kind: 'alreadyPaid' }} />)
    expect(screen.getByText(/already paid/i)).toBeInTheDocument()
  })

  it('expired → copy with role=alert', () => {
    render(<PayResult state={{ kind: 'expired' }} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/expired/i)).toBeInTheDocument()
  })

  it('invalid → copy with role=alert', () => {
    render(<PayResult state={{ kind: 'invalid' }} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/invalid/i)).toBeInTheDocument()
  })

  it('notConfigured → copy with role=alert', () => {
    render(<PayResult state={{ kind: 'notConfigured' }} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/not yet set up/i)).toBeInTheDocument()
  })

  it('temporaryError → retry button present and clickable', () => {
    const onRetry = vi.fn()
    render(<PayResult state={{ kind: 'temporaryError' }} onRetry={onRetry} />)
    const btn = screen.getByRole('button', { name: /try again/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
