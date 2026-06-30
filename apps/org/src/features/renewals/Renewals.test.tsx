import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Renewals } from './Renewals'

const state = vi.hoisted(() => ({
  status: 'ready' as 'ready' | 'empty' | 'error' | 'loading',
  buckets: { dueSoon: [] as any[], grace: [] as any[], lapsed: [] as any[] },
  total: 0,
  shown: 0,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, children, ...p }: any) => (
    <a href={params ? String(to).replace(/\$(\w+)/g, (_: string, k: string) => params[k]) : to} {...p}>{children}</a>
  ),
}))
vi.mock('../org/use-org', () => ({ useSelectedOrg: () => ({ orgId: 'o1' }) }))
vi.mock('./use-renewals', () => ({ useRenewals: () => ({ ...state, refetch: vi.fn() }) }))

const m = (o: Record<string, unknown> = {}) => ({ membershipId: 'm1', personId: 'p1', name: 'Maria', memberNumber: 'A-1', status: 'active', duesExpiryDate: null, daysLeft: 5, ...o })

beforeEach(() => { state.status = 'ready'; state.buckets = { dueSoon: [], grace: [], lapsed: [] }; state.total = 0; state.shown = 0 })

describe('Renewals', () => {
  it('renders urgency sections with counts and links each member to detail', () => {
    state.buckets = {
      dueSoon: [m({ name: 'Maria', daysLeft: 5 })],
      grace: [m({ membershipId: 'm2', name: 'Grace Member', status: 'gracePeriod' })],
      lapsed: [],
    }
    render(<Renewals />)
    expect(screen.getByText('Due soon (1)')).toBeInTheDocument()
    expect(screen.getByText('In grace (1)')).toBeInTheDocument()
    expect(screen.queryByText(/^Lapsed \(/)).not.toBeInTheDocument() // empty bucket hidden
    expect(screen.getByText(/5 days left/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Maria' })).toHaveAttribute('href', '/members/m1')
  })

  it('warns that buckets may be incomplete when the roster exceeds the page', () => {
    state.buckets = { dueSoon: [m()], grace: [], lapsed: [] }
    state.total = 250
    state.shown = 100
    render(<Renewals />)
    expect(screen.getByRole('alert')).toHaveTextContent(/first 100 of 250 members .* may be incomplete/i)
  })

  it('shows the calm empty state when all up to date', () => {
    state.status = 'empty'
    render(<Renewals />)
    expect(screen.getByText(/Everyone's up to date/)).toBeInTheDocument()
  })

  it('shows a friendly error state', () => {
    state.status = 'error'
    render(<Renewals />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/officer access/i)).toBeInTheDocument()
  })
})
