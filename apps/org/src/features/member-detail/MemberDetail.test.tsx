import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemberDetail } from './MemberDetail'

const state = vi.hoisted(() => ({
  member: undefined as any,
  isError: false,
  payments: [] as any[],
  outstanding: 0,
  openCount: 0,
  refundMutate: vi.fn(),
  renewMutate: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params: _p, search: _s, children, ...rest }: any) => <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>,
}))
vi.mock('../org/use-org', () => ({ useSelectedOrg: () => ({ orgId: 'o1' }) }))
vi.mock('./RecordPaymentDialog', () => ({ RecordPaymentDialog: () => <button>Record payment</button> }))
vi.mock('sonner', () => ({ toast }))
vi.mock('./use-member-detail', async (orig) => ({
  ...(await orig<Record<string, unknown>>()), // keep canVoid real
  useRosterMember: () => ({ member: state.member, isLoading: false, isError: state.isError, refetch: vi.fn() }),
  useMemberPayments: () => ({ payments: state.payments, isLoading: false, isError: false, refetch: vi.fn() }),
  useMemberOutstanding: () => ({ outstanding: state.outstanding, openCount: state.openCount, isLoading: false }),
  useRefundPayment: () => ({ mutate: state.refundMutate, isPending: false }),
  useRenewMembership: () => ({ mutate: state.renewMutate, isPending: false }),
}))

const MARIA = {
  personId: 'p1', name: 'Maria Santos', memberNumber: '#00142', status: 'active',
  joinedAt: '2019-05-01T00:00:00Z', tier: 'Gold', duesExpiryDate: '2026-01-12T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  state.member = MARIA; state.isError = false; state.payments = []; state.outstanding = 0; state.openCount = 0
})

describe('MemberDetail', () => {
  it('renders the profile header, status badge, and since date', () => {
    render(<MemberDetail membershipId="m1" />)
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/Member since/)).toBeInTheDocument()
    expect(screen.getByText(/Gold/)).toBeInTheDocument()
  })

  it('shows the outstanding standing when there are open invoices', () => {
    state.outstanding = 150000; state.openCount = 1
    render(<MemberDetail membershipId="m1" />)
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument()
    expect(screen.getByText(/outstanding/)).toBeInTheDocument()
  })

  it('shows a calm empty state when no payments are recorded', () => {
    render(<MemberDetail membershipId="m1" />)
    expect(screen.getByText('No payments recorded yet')).toBeInTheDocument()
  })

  it('lists a payment with a Void action and voids it on confirm', () => {
    state.payments = [{ id: 'pay1', amount: 150000, currency: 'PHP', paymentMethod: 'gcash', status: 'completed', refundedAmount: 0, paidAt: new Date().toISOString(), receiptNumber: '88' }]
    render(<MemberDetail membershipId="m1" />)
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument()
    expect(screen.getByText(/GCash/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /void \/ refund/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Void payment' }))
    expect(state.refundMutate).toHaveBeenCalledWith({ paymentId: 'pay1' }, expect.anything())
  })

  it('does not offer Void for a payment older than 30 days', () => {
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString()
    state.payments = [{ id: 'p2', amount: 150000, currency: 'PHP', paymentMethod: 'cash', status: 'completed', refundedAmount: 0, paidAt: old }]
    render(<MemberDetail membershipId="m1" />)
    expect(screen.queryByRole('button', { name: /void \/ refund/i })).not.toBeInTheDocument()
  })

  it('renews on confirm', () => {
    render(<MemberDetail membershipId="m1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Renew' }))
    fireEvent.click(screen.getByRole('button', { name: 'Renew membership' }))
    expect(state.renewMutate).toHaveBeenCalledWith({ membershipId: 'm1' }, expect.anything())
  })
})
