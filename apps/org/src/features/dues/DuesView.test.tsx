import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuesView } from './DuesView'

// Mock Link as a plain anchor — unit tests for presentational components
// don't need a full router; navigation is tested at E2E layer.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

it('renders dashboard tiles with formatted money + rate — no NaN', () => {
  const { container } = render(
    <DuesView
      stats={{ totalCollected: 250000, totalOutstanding: 500000, paidCount: 1, unpaidCount: 2, overdueCount: 0, collectionRate: 33, memberCount: 3 }}
      payments={[{ id: 'pay1', amount: 250000, status: 'completed' }]}
      invoices={[{ id: 'inv1', amount: 500000, status: 'sent', memberName: 'Olive Cruz' }]}
    />,
  )
  // totalCollected tile + payment row both show ₱2,500.00
  expect(screen.getAllByText('₱2,500.00').length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText(/33%/)).toBeInTheDocument()
  expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
  // NaN guard — any NaN in rendered output is a CRIT-1 style bug
  expect(container.textContent).not.toMatch(/NaN/)
})

it('shows EmptyState when no payments', () => {
  render(
    <DuesView
      stats={{ totalCollected: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, collectionRate: 0, memberCount: 0 }}
      payments={[]}
      invoices={[]}
    />,
  )
  expect(screen.getByText('No payments yet')).toBeInTheDocument()
})

it('renders payment status badge', () => {
  render(
    <DuesView
      stats={{ totalCollected: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, collectionRate: 0, memberCount: 0 }}
      payments={[{ id: 'p1', amount: 50000, status: 'pending' }]}
      invoices={[]}
    />,
  )
  expect(screen.getByText('pending')).toBeInTheDocument()
})

it('shows ErrorState instead of EmptyState when paymentsError', () => {
  render(
    <DuesView
      stats={{ totalCollected: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, collectionRate: 0, memberCount: 0 }}
      payments={[]}
      invoices={[]}
      paymentsError
    />,
  )
  // ErrorState renders a role="alert" — not the misleading "No payments yet" empty state
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText('No payments yet')).not.toBeInTheDocument()
})

it('shows invoices ErrorState when invoicesError', () => {
  render(
    <DuesView
      stats={{ totalCollected: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, collectionRate: 0, memberCount: 0 }}
      payments={[]}
      invoices={[]}
      invoicesError
    />,
  )
  expect(screen.getByRole('alert')).toBeInTheDocument()
})
